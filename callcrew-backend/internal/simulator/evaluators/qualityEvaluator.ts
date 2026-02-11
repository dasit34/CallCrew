import {
  SimulationResult,
  EvaluationResult,
  SimulationScenario,
  ScenarioIntent,
  ScenarioSuccessCriteria,
} from "../../../internal/simulator/types";

export type QualityCheckKey =
  | "greeting_present"
  | "intent_captured"
  | "required_fields_captured"
  | "no_hallucinated_promises"
  | "escalation_logic_respected";

export interface PerRunQualityResult {
  simulationId: string;
  score: number;
  failedChecks: QualityCheckKey[];
}

export interface BatchQualitySummary {
  averageScore: number;
  failureCountsByType: Record<QualityCheckKey, number>;
  topFailureTypes: { check: QualityCheckKey; count: number }[];
  recommendedFixes: string[];
}

const ALL_CHECK_KEYS: QualityCheckKey[] = [
  "greeting_present",
  "intent_captured",
  "required_fields_captured",
  "no_hallucinated_promises",
  "escalation_logic_respected",
];

function getInitialFailureCounts(): Record<QualityCheckKey, number> {
  const base: Record<QualityCheckKey, number> = {
    greeting_present: 0,
    intent_captured: 0,
    required_fields_captured: 0,
    no_hallucinated_promises: 0,
    escalation_logic_respected: 0,
  };
  return base;
}

function normalizeText(text: string | undefined): string {
  return (text || "").toLowerCase();
}

function checkGreetingPresent(simulation: SimulationResult): boolean {
  const firstAssistant = simulation.transcript.find((t) => t.role === "assistant");
  if (!firstAssistant) return false;

  const content = normalizeText(firstAssistant.content);
  if (!content.trim()) return false;

  const greetingKeywords = [
    "thank you for calling",
    "thanks for calling",
    "this is",
    "you're speaking with",
    "you are speaking with",
    "hello",
    "hi ",
    "hi,",
    "welcome",
  ];

  for (const keyword of greetingKeywords) {
    if (content.includes(keyword)) {
      return true;
    }
  }

  const businessName = normalizeText(simulation.scenario.businessName);
  return !!businessName && content.includes(businessName);
}

const INTENT_KEYWORDS: Record<ScenarioIntent, string[]> = {
  book_appointment: ["appointment", "book", "schedule", "scheduling"],
  reschedule: ["reschedule", "move", "change time"],
  pricing_question: ["pricing", "price", "cost", "rates"],
  new_lead_general: ["learn more", "getting started", "sign up", "new lead"],
  urgent_issue: ["urgent", "emergency", "issue", "problem"],
  after_hours_message: ["after hours", "closed", "leave a message", "voicemail"],
  other: ["question", "help", "support"],
};

function checkIntentCaptured(simulation: SimulationResult): boolean {
  const scenario: SimulationScenario = simulation.scenario;
  const intent = scenario.intent;
  const keywords = INTENT_KEYWORDS[intent] || [];

  if (keywords.length === 0) return true;

  const assistantText = normalizeText(
    simulation.transcript
      .filter((t) => t.role === "assistant")
      .map((t) => t.content)
      .join(" ")
  );

  for (const keyword of keywords) {
    if (assistantText.includes(keyword)) {
      return true;
    }
  }

  return false;
}

function checkRequiredFieldsCaptured(
  simulation: SimulationResult,
  criteria: ScenarioSuccessCriteria
): boolean {
  const transcriptText = normalizeText(
    simulation.transcript.map((t) => `${t.role}: ${t.content}`).join(" ")
  );

  let allGood = true;

  if (criteria.mustCollectName) {
    const name = normalizeText(simulation.scenario.persona.name);
    const nameCaptured =
      transcriptText.includes("my name is") ||
      transcriptText.includes("this is") ||
      (!!name && transcriptText.includes(name));
    if (!nameCaptured) {
      allGood = false;
    }
  }

  if (criteria.mustCollectPhone) {
    const phoneRegex = /\d{3}[-\s.]?\d{3}[-\s.]?\d{4}/;
    const phoneCaptured =
      transcriptText.includes("phone") ||
      transcriptText.includes("call back") ||
      phoneRegex.test(transcriptText);
    if (!phoneCaptured) {
      allGood = false;
    }
  }

  if (criteria.mustCollectReason) {
    const intentKeywords = INTENT_KEYWORDS[simulation.scenario.intent] || [];
    let reasonMentioned = false;
    for (const keyword of intentKeywords) {
      if (transcriptText.includes(keyword)) {
        reasonMentioned = true;
        break;
      }
    }
    if (!reasonMentioned) {
      allGood = false;
    }
  }

  return allGood;
}

function checkNoHallucinatedPromises(simulation: SimulationResult): boolean {
  const hallucinationPatterns = [
    "i'll refund",
    "100% satisfaction",
    "guarantee",
    "guaranteed",
    "24/7",
    "always available",
    "i can upgrade your plan",
    "i'll sign you up right now",
    "i've already fixed that for you",
  ];

  const assistantText = normalizeText(
    simulation.transcript
      .filter((t) => t.role === "assistant")
      .map((t) => t.content)
      .join(" ")
  );

  for (const pattern of hallucinationPatterns) {
    if (assistantText.includes(pattern)) {
      return false;
    }
  }

  return true;
}

function checkEscalationLogic(simulation: SimulationResult): boolean {
  const criteria = simulation.scenario.successCriteria;

  if (!criteria.shouldOfferCallbackOrBooking) {
    return true;
  }

  const assistantText = normalizeText(
    simulation.transcript
      .filter((t) => t.role === "assistant")
      .map((t) => t.content)
      .join(" ")
  );

  const escalationPhrases = [
    "have our team follow up",
    "someone from our team",
    "we'll follow up",
    "we will follow up",
    "we'll give you a call back",
    "we will give you a call back",
    "our team will reach out",
    "i'll pass this along",
  ];

  for (const phrase of escalationPhrases) {
    if (assistantText.includes(phrase)) {
      return true;
    }
  }

  return false;
}

export function evaluateRunQuality(
  simulation: SimulationResult,
  _evaluation: EvaluationResult
): PerRunQualityResult {
  const criteria = simulation.scenario.successCriteria;

  const checks: Record<QualityCheckKey, boolean> = {
    greeting_present: checkGreetingPresent(simulation),
    intent_captured: checkIntentCaptured(simulation),
    required_fields_captured: checkRequiredFieldsCaptured(simulation, criteria),
    no_hallucinated_promises: checkNoHallucinatedPromises(simulation),
    escalation_logic_respected: checkEscalationLogic(simulation),
  };

  const failedChecks: QualityCheckKey[] = [];
  for (const key of ALL_CHECK_KEYS) {
    if (!checks[key]) {
      failedChecks.push(key);
    }
  }

  const passedCount = ALL_CHECK_KEYS.length - failedChecks.length;
  const rawScore =
    ALL_CHECK_KEYS.length === 0 ? 0 : (passedCount / ALL_CHECK_KEYS.length) * 100;

  const score = Math.round(rawScore);

  return {
    simulationId: simulation.scenario.id,
    score,
    failedChecks,
  };
}

export function evaluateBatchQuality(
  simulations: SimulationResult[],
  evaluations: EvaluationResult[]
): BatchQualitySummary {
  const failureCounts = getInitialFailureCounts();

  if (!simulations.length || !evaluations.length) {
    return {
      averageScore: 0,
      failureCountsByType: failureCounts,
      topFailureTypes: [],
      recommendedFixes: [],
    };
  }

  const perRunResults: PerRunQualityResult[] = [];

  for (let i = 0; i < simulations.length; i += 1) {
    const sim = simulations[i];
    const evalResult = evaluations[i];

    try {
      const quality = evaluateRunQuality(sim, evalResult);
      perRunResults.push(quality);

      for (const key of quality.failedChecks) {
        failureCounts[key] = (failureCounts[key] || 0) + 1;
      }
    } catch {
      failureCounts.escalation_logic_respected += 1;
    }
  }

  const totalRuns = perRunResults.length || simulations.length || 1;

  const avgScore =
    perRunResults.length === 0
      ? 0
      : perRunResults.reduce((sum, r) => sum + r.score, 0) / perRunResults.length;

  const averageScore = Math.round(avgScore);

  const topFailureTypes = ALL_CHECK_KEYS
    .map((key) => ({ check: key, count: failureCounts[key] || 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const recommendedFixes: string[] = [];

  const failureRate = (key: QualityCheckKey): number =>
    totalRuns === 0 ? 0 : (failureCounts[key] || 0) / totalRuns;

  if (failureRate("intent_captured") > 0.2) {
    recommendedFixes.push(
      "Improve intent extraction prompt so the assistant explicitly restates why the caller is reaching out."
    );
  }

  if (failureRate("required_fields_captured") > 0.2) {
    recommendedFixes.push(
      "Tighten intake schema enforcement so name, phone, and reason are always collected before wrap-up."
    );
  }

  if (failureRate("greeting_present") > 0.2) {
    recommendedFixes.push(
      "Standardize the opening script so every call starts with a clear, friendly greeting mentioning the business name."
    );
  }

  if (failureRate("no_hallucinated_promises") > 0.1) {
    recommendedFixes.push(
      "Review assistant responses for overpromising and remove any guarantees or commitments that the business cannot reliably honor."
    );
  }

  if (failureRate("escalation_logic_respected") > 0.2) {
    recommendedFixes.push(
      "Clarify escalation rules so the assistant reliably offers a callback or handoff when scenarios require human follow-up."
    );
  }

  return {
    averageScore,
    failureCountsByType: failureCounts,
    topFailureTypes,
    recommendedFixes,
  };
}

