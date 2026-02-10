// INTERNAL ONLY – persistence for simulation runs.
// Stores results in MongoDB without affecting production collections.

import mongoose from "mongoose";
import { StoredSimulationRun, SimulationResult, EvaluationResult } from "./types";

const DEFAULT_MONGO_URI = process.env.SIM_MONGODB_URI || process.env.MONGODB_URI || "";

const simulationRunSchema = new mongoose.Schema<StoredSimulationRun>(
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
  },
  {
    collection: "simulation_runs_internal",
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const SimulationRunModel =
  mongoose.models.SimulationRunInternal ||
  mongoose.model<StoredSimulationRun>("SimulationRunInternal", simulationRunSchema);

export async function connectForSimulation(): Promise<typeof mongoose | null> {
  if (!DEFAULT_MONGO_URI) {
    console.warn(
      "[simulator] MONGODB_URI/SIM_MONGODB_URI not set – results will not be persisted."
    );
    return null;
  }
  if (mongoose.connection.readyState === 1) return mongoose;
  await mongoose.connect(DEFAULT_MONGO_URI);
  return mongoose;
}

export async function scoreAndStore(
  simulation: SimulationResult,
  evaluation: EvaluationResult
): Promise<StoredSimulationRun | null> {
  const conn = await connectForSimulation();
  if (!conn) {
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
  };

  const created = await SimulationRunModel.create(doc);
  return created.toObject();
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

