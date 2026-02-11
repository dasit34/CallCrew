// INTERNAL ONLY – batch orchestrator for CallCrew simulations.
// Can be used from a CLI script or a protected internal endpoint.
// Does NOT handle any live customer traffic.
// To run from backend: `cd callcrew-backend && npm run sim:batch`

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
  // For baseline runs we typically use a single small-business / lunch-hour assistant configuration.
  const scenarios = await generateScenarios(count, {
    businessName: "CallCrew Small Business Receptionist",
    industry: "small_business_lunch_hour",
  });
  const simulations: SimulationResult[] = [];
  const evaluations: EvaluationResult[] = [];

  for (const scenario of scenarios) {
    let simulation: SimulationResult;
    let evaluation: EvaluationResult;

    try {
      // Run simulation - wrap in try/catch to catch any unexpected errors
      try {
        simulation = await runSimulation(scenario, config);
      } catch (simErr: any) {
        // If runSimulation throws (shouldn't happen due to internal try/catch, but guard against it)
        const now = new Date().toISOString();
        simulation = {
          scenario,
          config,
          transcript: [],
          endReason: "error",
          error: simErr?.message || String(simErr),
          startedAt: now,
          finishedAt: now,
          assistantVersion: process.env.ASSISTANT_VERSION || "unknown",
        };
      }

      simulations.push(simulation);

      // Always attempt evaluation, even if simulation had errors
      try {
        evaluation = await evaluateSimulation(simulation);
        // If simulation had a runtime error, ensure runtime_error tag is present
        if (simulation.error || simulation.endReason === "error") {
          if (!evaluation.failureTags.includes("runtime_error")) {
            evaluation.failureTags.push("runtime_error");
          }
        }
      } catch (evalErr: any) {
        // If evaluation throws, create a minimal evaluation result with runtime_error tag
        const errorMessage = evalErr?.message || String(evalErr);
        evaluation = {
          simulationId: scenario.id,
          totalScore: 0,
          dimensionScores: {
            intentUnderstanding: 0,
            requiredInfoCaptured: 0,
            flowCorrectness: 0,
            clarityConciseness: 0,
            escalationCorrectness: 0,
            userFriction: 0,
          },
          failureTags: ["runtime_error"],
          missingData: [],
          concreteSuggestions: [],
          rawJudgeJson: JSON.stringify({
            error: "Evaluation failed",
            message: process.env.DEBUG === "1" ? errorMessage : undefined,
          }),
        };
      }

      evaluations.push(evaluation);

      // Persist each run (best-effort; ignore storage errors)
      try {
        await scoreAndStore(simulation, evaluation);
      } catch (err) {
        // Storage failures are non-fatal; continue batch
      }
    } catch (fatalErr: any) {
      // This catch block should only trigger for truly unexpected fatal errors
      // that prevent us from creating minimal results. Re-throw to fail the batch.
      throw fatalErr;
    }
  }

  const summary = summarizeBatch(scenarios, simulations, evaluations);
  return { scenarios, simulations, evaluations, summary };
}

/**
 * CLI entrypoint for running a small baseline batch and printing a single JSON summary.
 * This is intentionally minimal so it can be used in CI/regression checks.
 */
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "[simulator] OPENAI_API_KEY is required to run simulations. Please set it in your environment."
    );
  }

  const BATCH_SIZE = 5;
  const { simulations, evaluations, summary } = await runBatchSimulation(BATCH_SIZE, {
    maxTurns: 6,
  });

  // Aggregate failureTags, missingData, and concreteSuggestions across evaluations
  const failureTagCounts: Record<string, number> = {};
  const missingDataCounts: Record<string, number> = {};
  const suggestionCounts: Record<string, number> = {};

  for (const e of evaluations) {
    for (const tag of e.failureTags) {
      failureTagCounts[tag] = (failureTagCounts[tag] || 0) + 1;
    }
    for (const field of e.missingData) {
      missingDataCounts[field] = (missingDataCounts[field] || 0) + 1;
    }
    for (const suggestion of e.concreteSuggestions) {
      suggestionCounts[suggestion] = (suggestionCounts[suggestion] || 0) + 1;
    }
  }

  const topSuggestions = Object.entries(suggestionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  // Basic health checks for missing fields / crashes
  const runsWithErrors = simulations.filter((s) => s.error).length;
  const evalsMissingScores = evaluations.filter(
    (e) => typeof e.totalScore !== "number" || !e.dimensionScores
  ).length;

  const summaryPayload = {
    label: "baseline",
    totalRuns: summary.totalRuns,
    averageTotalScore: summary.averageScore,
    failureTagCounts,
    missingDataCounts,
    topSuggestions,
    health: {
      runsWithErrors,
      evalsMissingScores,
    },
  };

  // IMPORTANT: single structured line for downstream tools
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summaryPayload, null, 2));
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
    runtime_error: 0,
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

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

