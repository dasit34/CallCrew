// INTERNAL ONLY – simulation/QA types for CallCrew assistant
// This module does not modify production behavior.

export type CallerTone = "calm" | "stressed" | "angry" | "confused" | "neutral";

export type ScenarioIntent =
  | "book_appointment"
  | "reschedule"
  | "pricing_question"
  | "new_lead_general"
  | "urgent_issue"
  | "after_hours_message"
  | "other";

export interface ScenarioSuccessCriteria {
  description: string;
  mustCollectName: boolean;
  mustCollectPhone: boolean;
  mustCollectReason: boolean;
  shouldOfferCallbackOrBooking: boolean;
  customChecks?: string[];
}

export interface ScenarioEdgeCases {
  noisyBackground?: boolean;
  poorCellReception?: boolean;
  overlappingSpeakers?: boolean;
  unclearReason?: boolean;
  languageBarrier?: boolean;
}

export interface SimulationScenario {
  id: string;
  title: string;
  businessName: string;
  businessIndustry: string;
  persona: {
    name: string;
    role: string;
    company?: string;
    description: string;
  };
  intent: ScenarioIntent;
  tone: CallerTone;
  constraints: string[];
  successCriteria: ScenarioSuccessCriteria;
  edgeCases: ScenarioEdgeCases;
  initialUtterance: string;
  notes?: string;
}

export type SpeakerRole = "caller" | "assistant";

export interface ConversationTurn {
  role: SpeakerRole;
  content: string;
  timestamp: string;
}

export interface SimulationConfig {
  maxTurns: number;
  maxAssistantTokens?: number;
  maxCallerTokens?: number;
}

export type SimulationEndReason =
  | "success_criteria_met"
  | "caller_hung_up"
  | "assistant_gave_up"
  | "escalated_to_human"
  | "max_turns_reached"
  | "error";

export interface SimulationResult {
  scenario: SimulationScenario;
  config: SimulationConfig;
  transcript: ConversationTurn[];
  endReason: SimulationEndReason;
  error?: string;
  startedAt: string;
  finishedAt: string;
  assistantVersion: string;
}

export type FailureCategory =
  | "intent_mismatch"
  | "missing_contact_info"
  | "failed_to_offer_next_step"
  | "incorrect_information"
  | "tone_mismatch"
  | "handoff_problem"
  | "latency_or_hesitation"
  | "policy_violation"
  | "other";

export interface EvaluationSuggestion {
  title: string;
  description: string;
  impactedStages: string[];
}

export interface DimensionScores {
  /** 0–10: Did the assistant correctly infer and stick to the caller’s main intent? */
  intentUnderstanding: number;
  /** 0–10: Did it capture required fields (name, phone, reason) when appropriate? */
  requiredInfoCaptured: number;
  /** 0–10: Did it follow the expected flow (greeting → name → phone → reason → wrap-up/handoff)? */
  flowCorrectness: number;
  /** 0–10: Were responses clear, concise, and easy to follow (no rambling or contradictions)? */
  clarityConciseness: number;
  /** 0–10: Did it escalate or hand off correctly when needed (or avoid unnecessary escalation)? */
  escalationCorrectness: number;
  /** 0–10: How much friction did the caller experience (repetition, confusion, stalls) – higher = less friction. */
  userFriction: number;
}

export interface EvaluationResult {
  simulationId: string;
  /** 0–100 deterministic weighted score derived from dimensionScores */
  totalScore: number;
  /** Per-dimension sub-scores (0–10 each) */
  dimensionScores: DimensionScores;
  /** High-level failure tags for quick filtering/aggregation */
  failureTags: FailureCategory[];
  /** Which critical data points were missing (e.g. "caller_phone", "reason_for_call") */
  missingData: string[];
  /** Concrete, actionable suggestions (one sentence each) */
  concreteSuggestions: string[];
  /** Raw JSON response from the judge model (for debugging/regression investigations) */
  rawJudgeJson?: string;
}

export interface StoredSimulationRun {
  _id?: string;
  assistantVersion: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioIntent: ScenarioIntent;
  score: number;
  failureCategories: FailureCategory[];
  transcript: ConversationTurn[];
  evaluationSummary: string;
  evaluationSuggestions: EvaluationSuggestion[];
  endReason: SimulationEndReason;
  createdAt?: Date;
}

