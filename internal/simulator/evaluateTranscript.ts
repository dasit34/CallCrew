// INTERNAL ONLY – Judge/evaluator for CallCrew assistant simulations.
// This uses a SEPARATE LLM "judge" from the assistant model.
// It never modifies production prompts or behavior automatically.

import {
  SimulationResult,
  EvaluationResult,
  FailureCategory,
  DimensionScores,
} from "./types";

const JUDGE_MODEL = process.env.SIM_JUDGE_MODEL || "gpt-4o-mini";

// Stable rubric weights for deterministic 0–100 scoring across runs.
// If we change these, we know we've changed the regression baseline.
const DIMENSION_WEIGHTS: Readonly<Record<keyof DimensionScores, number>> = {
  intentUnderstanding: 0.2,
  requiredInfoCaptured: 0.2,
  flowCorrectness: 0.2,
  clarityConciseness: 0.15,
  escalationCorrectness: 0.15,
  userFriction: 0.1,
};

function getOpenAIClient(): any | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.error("[simulator] OPENAI_API_KEY not set – evaluateTranscript will be a no-op.");
    }
    return null;
  }
  let OpenAIConstructor: any;
  try {
    // Optional dependency: if not installed, evaluator will fall back to neutral scores.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("openai");
    OpenAIConstructor = mod.default || mod;
  } catch (err) {
    if (process.env.DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.error(
        "[simulator] 'openai' package not found – evaluateTranscript will fall back to neutral scores."
      );
    }
    return null;
  }

  return new OpenAIConstructor({ apiKey });
}

function clampSubScore(value: any): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5; // neutral default
  return Math.min(10, Math.max(0, n));
}

function computeTotalScore(dimensionScores: DimensionScores): number {
  const weighted =
    (dimensionScores.intentUnderstanding / 10) * DIMENSION_WEIGHTS.intentUnderstanding +
    (dimensionScores.requiredInfoCaptured / 10) * DIMENSION_WEIGHTS.requiredInfoCaptured +
    (dimensionScores.flowCorrectness / 10) * DIMENSION_WEIGHTS.flowCorrectness +
    (dimensionScores.clarityConciseness / 10) * DIMENSION_WEIGHTS.clarityConciseness +
    (dimensionScores.escalationCorrectness / 10) * DIMENSION_WEIGHTS.escalationCorrectness +
    (dimensionScores.userFriction / 10) * DIMENSION_WEIGHTS.userFriction;

  return Math.round(weighted * 100);
}

/**
 * Evaluate a single simulation run and produce a structured, rubric-based score.
 * The rubric is fixed and weighted, so identical transcripts yield stable scores
 * (temperature is kept low to minimize LLM variance).
 */
export async function evaluateSimulation(
  simulation: SimulationResult
): Promise<EvaluationResult> {
  const client = getOpenAIClient();
  const simulationId = simulation.scenario.id;

  if (!client) {
    // Fallback: neutral rubric scores if judge is not configured
    const neutral: DimensionScores = {
      intentUnderstanding: 5,
      requiredInfoCaptured: 5,
      flowCorrectness: 5,
      clarityConciseness: 5,
      escalationCorrectness: 5,
      userFriction: 5,
    };
    return {
      simulationId,
      totalScore: computeTotalScore(neutral),
      dimensionScores: neutral,
      failureTags: [],
      missingData: [],
      concreteSuggestions: [],
      rawJudgeJson: JSON.stringify({ reason: "OPENAI_API_KEY missing – neutral fallback" }),
    };
  }

  const transcriptText = simulation.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n");

  const systemPrompt = `
You are an expert QA evaluator for an AI phone receptionist used by small businesses.

You will receive:
- A scenario description
- A full conversation transcript between CALLER and ASSISTANT

You must score the assistant along SIX explicit dimensions, each from 0–10:

1) intentUnderstanding:
   0  = Completely misunderstood or ignored the caller's main reason for calling
   5  = Partially understood intent but missed important nuances
   10 = Clearly understood and consistently focused on the caller's main intent

2) requiredInfoCaptured:
   0  = Did not collect any required info (name, phone, reason) when appropriate
   5  = Collected some required info but missed key fields
   10 = Collected all required info when appropriate with minimal friction

3) flowCorrectness:
   0  = Jumped around, skipped key steps, or used an illogical order
   5  = Mostly followed the expected flow but with minor ordering issues
   10 = Followed the expected flow (greeting → name → phone → reason → wrap-up/handoff) cleanly

4) clarityConciseness:
   0  = Long, confusing, or contradictory responses
   5  = Generally clear but sometimes wordy or slightly confusing
   10 = Consistently clear, concise, and easy to follow (1–2 sentences per turn)

5) escalationCorrectness:
   0  = Failed to escalate when clearly needed OR escalated inappropriately
   5  = Mixed performance on when/how to escalate or hand off
   10 = Escalated or deferred only when appropriate and explained next steps clearly

6) userFriction:
   0  = High friction: repeated questions, confusion, stalls, or obvious frustration
   5  = Some friction but caller still got to a reasonable outcome
   10 = Low friction: smooth path, minimal repetition, caller likely felt helped

Your output MUST be STRICTLY JSON with this exact shape (no extra fields, no prose):
{
  "dimensionScores": {
    "intentUnderstanding": number (0-10),
    "requiredInfoCaptured": number (0-10),
    "flowCorrectness": number (0-10),
    "clarityConciseness": number (0-10),
    "escalationCorrectness": number (0-10),
    "userFriction": number (0-10)
  },
  "failureTags": string[],       // e.g. ["intent_mismatch", "missing_contact_info"]
  "missingData": string[],       // e.g. ["caller_phone", "reason_for_call"]
  "concreteSuggestions": string[] // 2–5 short, actionable suggestions (one sentence each)
}

Rules:
- DO NOT talk about changing the assistant's underlying prompt or architecture.
- DO NOT propose self-modifying behavior.
- Only comment on what went well or poorly in THIS transcript.
`.trim();

  const userPrompt = `
Scenario:
Title: ${simulation.scenario.title}
Intent: ${simulation.scenario.intent}
Tone: ${simulation.scenario.tone}
Success Criteria: ${simulation.scenario.successCriteria.description}

Transcript:
${transcriptText}
`.trim();

  const completion = await client.chat.completions.create({
    model: JUDGE_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1, // low temperature for repeatable, rubric-based scoring
  });

  const raw = completion.choices[0]?.message?.content || "{}";

  let parsed: any;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch (err) {
    if (process.env.DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.error("[simulator] Failed to parse judge JSON:", err);
    }
    parsed = {
      dimensionScores: {},
      failureTags: ["other"],
      missingData: [],
      concreteSuggestions: [],
    };
  }

  const ds = parsed.dimensionScores || {};
  const dimensionScores: DimensionScores = {
    intentUnderstanding: clampSubScore(ds.intentUnderstanding),
    requiredInfoCaptured: clampSubScore(ds.requiredInfoCaptured),
    flowCorrectness: clampSubScore(ds.flowCorrectness),
    clarityConciseness: clampSubScore(ds.clarityConciseness),
    escalationCorrectness: clampSubScore(ds.escalationCorrectness),
    userFriction: clampSubScore(ds.userFriction),
  };

  const totalScore = computeTotalScore(dimensionScores);

  const failureTags: FailureCategory[] = Array.isArray(parsed.failureTags)
    ? parsed.failureTags
    : [];

  const missingData: string[] = Array.isArray(parsed.missingData)
    ? parsed.missingData.map(String)
    : [];

  const concreteSuggestions: string[] = Array.isArray(parsed.concreteSuggestions)
    ? parsed.concreteSuggestions.map((s: any) => String(s).trim()).filter(Boolean)
    : [];

  return {
    simulationId,
    totalScore,
    dimensionScores,
    failureTags,
    missingData,
    concreteSuggestions,
    rawJudgeJson: raw,
  };
}

