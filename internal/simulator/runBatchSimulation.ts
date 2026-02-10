// INTERNAL ONLY – batch orchestrator for CallCrew simulations.
// Can be used from a CLI script or a protected internal endpoint.
// Does NOT handle any live customer traffic.

import { generateScenarios } from "./generateScenarios";
import { runSimulation } from "./runSimulation";
import { evaluateSimulation } from "./evaluateTranscript";
import { scoreAndStore } from "./scoreAndStore";
import {
  SimulationConfig,
  SimulationScenario,
  SimulationResult,
  EvaluationResult,
  FailureCategory,
} from "./types";

export interface BatchSummary {
  totalRuns: number;
  averageScore: number;
  worstTenPercent: { scenarioId: string; score: number; title: string }[];
  failureCategoryCounts: Record<FailureCategory | "other", number>;
  topSuggestions: string[];
}

export interface BatchRunResult {
  scenarios: SimulationScenario[];
  simulations: SimulationResult[];
  evaluations: EvaluationResult[];
  summary: BatchSummary;
}

export async function runBatchSimulation(
  count: number,
  config: SimulationConfig
): Promise<BatchRunResult> {
  const scenarios = await generateScenarios(count);
  const simulations: SimulationResult[] = [];
  const evaluations: EvaluationResult[] = [];

  for (const scenario of scenarios) {
    const simulation = await runSimulation(scenario, config);
    simulations.push(simulation);

    const evaluation = await evaluateSimulation(simulation);
    evaluations.push(evaluation);

    // Persist each run (best-effort; ignore storage errors)
    try {
      await scoreAndStore(simulation, evaluation);
    } catch (err) {
      console.warn("[simulator] Failed to store simulation run:", err);
    }
  }

  const summary = summarizeBatch(scenarios, simulations, evaluations);
  return { scenarios, simulations, evaluations, summary };
}

function summarizeBatch(
  scenarios: SimulationScenario[],
  simulations: SimulationResult[],
  evaluations: EvaluationResult[]
): BatchSummary {
  const scores = evaluations.map((e) => e.totalScore);
  const averageScore = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  const combined = evaluations.map((e) => {
    const scenario = scenarios.find((s) => s.id === e.simulationId);
    return {
      simulationId: e.simulationId,
      title: scenario?.title || e.simulationId,
      score: e.totalScore,
    };
  });

  const sorted = [...combined].sort((a, b) => a.score - b.score);
  const tenPercentCount = Math.max(1, Math.floor(sorted.length * 0.1));
  const worstTenPercent = sorted.slice(0, tenPercentCount).map((c) => ({
    scenarioId: c.simulationId,
    score: c.score,
    title: c.title,
  }));

  const failureCategoryCounts: Record<FailureCategory | "other", number> = {
    intent_mismatch: 0,
    missing_contact_info: 0,
    failed_to_offer_next_step: 0,
    incorrect_information: 0,
    tone_mismatch: 0,
    handoff_problem: 0,
    latency_or_hesitation: 0,
    policy_violation: 0,
    other: 0,
  };

  for (const evalResult of evaluations) {
    if (!evalResult.failureTags || evalResult.failureTags.length === 0) continue;
    for (const cat of evalResult.failureTags) {
      if (cat in failureCategoryCounts) {
        failureCategoryCounts[cat as FailureCategory] += 1;
      } else {
        failureCategoryCounts.other += 1;
      }
    }
  }

  const suggestionTexts = new Set<string>();
  for (const evalResult of evaluations) {
    for (const desc of evalResult.concreteSuggestions) {
      if (desc) suggestionTexts.add(desc);
    }
  }

  return {
    totalRuns: simulations.length,
    averageScore,
    worstTenPercent,
    failureCategoryCounts,
    topSuggestions: Array.from(suggestionTexts).slice(0, 10),
  };
}

// Optional CLI entrypoint (internal use only).
// Example:
//   ts-node internal/simulator/runBatchSimulation.ts 20
if (require.main === module) {
  const n = Number(process.argv[2] || "10");
  runBatchSimulation(n, { maxTurns: 6 }).then((result) => {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          totalRuns: result.summary.totalRuns,
          averageScore: result.summary.averageScore,
          worstTenPercent: result.summary.worstTenPercent,
          failureCategoryCounts: result.summary.failureCategoryCounts,
        },
        null,
        2
      )
    );
    process.exit(0);
  });
}

