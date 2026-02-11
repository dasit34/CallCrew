// Backend-local CLI entrypoint for running the internal CallCrew simulator.
// This reuses the core simulator logic from the repo root and adds env loading
// plus a stable JSON summary output for CI / local runs.

// CRITICAL: Load environment variables BEFORE any imports that might create OpenAI clients.
// Use require() to ensure synchronous execution before ES6 imports are processed.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadEnv } = require("./loadEnv");

function preflightCheck(): void {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  if (majorVersion < 18) {
    const err: any = new Error(`Node.js 18+ required, found ${nodeVersion}`);
    err.code = "NODE_VERSION_INVALID";
    throw err;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("openai");
  } catch {
    const err: any = new Error("Missing required dependency: openai");
    err.code = "MISSING_DEPENDENCY";
    throw err;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("ts-node");
  } catch {
    const err: any = new Error("Missing required dependency: ts-node");
    err.code = "MISSING_DEPENDENCY";
    throw err;
  }
}

let initialEnvError: any | null = null;
try {
  preflightCheck();
  loadEnv();
} catch (err) {
  initialEnvError = err;
}

import {
  runBatchSimulation as runBatchCore,
  BatchRunResult,
} from "../../../internal/simulator/runBatchSimulation";
import { EvaluationResult } from "../../../internal/simulator/types";
import { evaluateBatchQuality } from "./evaluators/qualityEvaluator";

function buildSummaryPayload(result: BatchRunResult) {
  const { simulations, evaluations, summary } = result;

  const failureTagCounts: Record<string, number> = {};
  const missingDataCounts: Record<string, number> = {};
  const suggestionCounts: Record<string, number> = {};

  for (const e of evaluations as EvaluationResult[]) {
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

  // runsWithErrors counts only fatal failures that prevented producing a result
  // Since we always produce results (even with errors), this should be 0
  // Errors are represented in failureTagCounts.runtime_error instead
  const runsWithErrors = 0;
  const evalsMissingScores = evaluations.filter(
    (e: EvaluationResult) => typeof e.totalScore !== "number" || !e.dimensionScores
  ).length;

  const warnings: string[] = [];

  let quality;
  try {
    quality = evaluateBatchQuality(simulations, evaluations as EvaluationResult[]);
  } catch {
    // Fallback to defaults if quality evaluation fails
    quality = {
      averageScore: 0,
      topFailureTypes: [],
      recommendedFixes: [],
      failureCountsByType: {
        greeting_present: 0,
        intent_captured: 0,
        required_fields_captured: 0,
        no_hallucinated_promises: 0,
        escalation_logic_respected: 0,
      },
    };
  }

  const runtimeErrorCount = failureTagCounts.runtime_error || 0;

  const gateFailures = {
    greeting_present: quality.failureCountsByType?.greeting_present || 0,
    intent_captured: quality.failureCountsByType?.intent_captured || 0,
    required_fields_captured:
      quality.failureCountsByType?.required_fields_captured || 0,
    runtime_error: runtimeErrorCount,
  };

  const averageScore = quality.averageScore || 0;
  const readyForBeta =
    averageScore >= 80 &&
    gateFailures.greeting_present === 0 &&
    gateFailures.intent_captured === 0 &&
    gateFailures.required_fields_captured === 0 &&
    gateFailures.runtime_error === 0;

  return {
    label: "baseline",
    totalRuns: summary.totalRuns,
    averageTotalScore: summary.averageScore,
    readyForBeta,
    failureTagCounts,
    missingDataCounts,
    topSuggestions,
    health: {
      runsWithErrors,
      evalsMissingScores,
      warnings,
    },
    quality: {
      averageScore: quality.averageScore || 0,
      topFailures: quality.topFailureTypes || [],
      recommendedFixes: quality.recommendedFixes || [],
    },
    gateFailures,
  };
}

async function main() {
  if (initialEnvError) {
    throw initialEnvError;
  }

  const BATCH_SIZE = 20;
  const result = await runBatchCore(BATCH_SIZE, {
    maxTurns: 6,
  });

  const summaryPayload = buildSummaryPayload(result);

  // CRITICAL: This is the ONLY console.log allowed. It must be the final output.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summaryPayload, null, 2));
}

if (require.main === module) {
  // Wrap entire execution in try/catch to ensure deterministic error handling
  (async () => {
    try {
      await main();
      process.exit(0);
    } catch (err: any) {
      let message: string;
      const anyErr = err as any;

      if (anyErr && anyErr.code === "MISSING_OPENAI_API_KEY") {
        message = "[SIMULATOR_FATAL] Missing OPENAI_API_KEY";
      } else if (anyErr && anyErr.code === "NODE_VERSION_INVALID") {
        message = `[SIMULATOR_FATAL] ${anyErr.message}`;
      } else if (anyErr && anyErr.code === "MISSING_DEPENDENCY") {
        message = `[SIMULATOR_FATAL] ${anyErr.message}. Run: npm install`;
      } else if (process.env.DEBUG === "1" && anyErr && anyErr.stack) {
        message = anyErr.stack;
      } else {
        message = `[SIMULATOR_FATAL] ${
          anyErr && anyErr.message ? anyErr.message : String(anyErr)
        }`;
      }

      // Error output must come BEFORE any potential JSON summary
      // eslint-disable-next-line no-console
      console.error(message);
      process.exit(1);
    }
  })();
}


