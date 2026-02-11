// INTERNAL ONLY – persistence for simulation runs.
// Stores results in MongoDB without affecting production collections.

import { StoredSimulationRun, SimulationResult, EvaluationResult } from "./types";

const DEFAULT_MONGO_URI = process.env.SIM_MONGODB_URI || process.env.MONGODB_URI || "";

let cachedMongoose: any | null = null;

function getMongoose(): any | null {
  if (cachedMongoose) return cachedMongoose;
  try {
    // Optional dependency: if not installed, simulator will simply skip persistence.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("mongoose");
    cachedMongoose = mod.default || mod;
    return cachedMongoose;
  } catch (err) {
    // Silent failure - mongoose not available is expected in some environments
    cachedMongoose = null;
    return null;
  }
}

const mongooseInstance = getMongoose();

let SimulationRunModel: any | null = null;

if (mongooseInstance) {
  const simulationRunSchema = new mongooseInstance.Schema<StoredSimulationRun>(
    {
      assistantVersion: { type: String, required: true },
      scenarioId: { type: String, required: true },
      scenarioTitle: { type: String, required: true },
      scenarioIntent: { type: String, required: true },
      score: { type: Number, required: true },
      failureCategories: [{ type: String }],
      transcript: [
        {
          role: { type: String, required: true },
          content: { type: String, required: true },
          timestamp: { type: String, required: true },
        },
      ],
      evaluationSummary: { type: String, required: true },
      evaluationSuggestions: [
        {
          title: String,
          description: String,
          impactedStages: [String],
        },
      ],
      endReason: { type: String, required: true },
      evaluation: {
        totalScore: Number,
        dimensionScores: {
          intentUnderstanding: Number,
          requiredInfoCaptured: Number,
          flowCorrectness: Number,
          clarityConciseness: Number,
          escalationCorrectness: Number,
          userFriction: Number,
        },
        failureTags: [String],
        missingData: [String],
        concreteSuggestions: [String],
      },
      timestamp: { type: Date, default: Date.now },
    },
    {
      collection: "simulation_runs_internal",
      timestamps: { createdAt: true, updatedAt: false },
    }
  );

  SimulationRunModel =
    mongooseInstance.models.SimulationRunInternal ||
    mongooseInstance.model<StoredSimulationRun>("SimulationRunInternal", simulationRunSchema);
}

export async function connectForSimulation(): Promise<any | null> {
  const mongoose = getMongoose();
  if (!mongoose) {
    // Silent failure - mongoose not available is expected in some environments
    return null;
  }

  if (!DEFAULT_MONGO_URI) {
    // Silent failure - MongoDB URI not set is expected in some environments
    return null;
  }

  try {
    if (mongoose.connection.readyState === 1) return mongoose;
    await mongoose.connect(DEFAULT_MONGO_URI);
    return mongoose;
  } catch (err) {
    // Connection failures are non-fatal - simulator continues without persistence
    return null;
  }
}

export async function scoreAndStore(
  simulation: SimulationResult,
  evaluation: EvaluationResult
): Promise<StoredSimulationRun | null> {
  try {
    const conn = await connectForSimulation();
    if (!conn || !SimulationRunModel) {
      return null;
    }

    const doc: StoredSimulationRun = {
      assistantVersion: simulation.assistantVersion,
      scenarioId: simulation.scenario.id,
      scenarioTitle: simulation.scenario.title,
      scenarioIntent: simulation.scenario.intent,
      score: evaluation.totalScore,
      failureCategories: evaluation.failureTags,
      transcript: simulation.transcript,
      evaluationSummary: evaluation.concreteSuggestions.join(" | "),
      evaluationSuggestions: evaluation.concreteSuggestions.map((desc) => ({
        title: desc.length > 60 ? `${desc.slice(0, 57)}...` : desc,
        description: desc,
        impactedStages: [],
      })),
      endReason: simulation.endReason,
      evaluation: {
        totalScore: evaluation.totalScore,
        dimensionScores: evaluation.dimensionScores,
        failureTags: evaluation.failureTags,
        missingData: evaluation.missingData,
        concreteSuggestions: evaluation.concreteSuggestions,
      },
      timestamp: new Date(),
    };

    const created = await SimulationRunModel.create(doc);
    return created.toObject();
  } catch (err) {
    // Storage failures are non-fatal - simulator continues without persistence
    return null;
  }
}

export async function getLowestPerformingScenarios(limit = 10): Promise<StoredSimulationRun[]> {
  const conn = await connectForSimulation();
  if (!conn) return [];

  const docs = await SimulationRunModel.find({})
    .sort({ score: 1, createdAt: -1 })
    .limit(limit)
    .lean<StoredSimulationRun>()
    .exec();
  return docs;
}

