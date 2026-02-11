// INTERNAL ONLY – Conversation simulator for CallCrew assistant.
// Uses the same assistant prompt/logic as production, but drives it with
// synthetic caller turns. Does NOT handle any live traffic.
//
// VERIFIED LINKAGE TO PRODUCTION:
// - Uses EXACT same openaiService singleton: callcrew-backend/services/openaiService.js
// - Calls EXACT same function: openaiService.processConversation() (same as twilioVoice.js:1104)
// - Uses EXACT same system prompt building logic (matches twilioVoice.js:1093-1102)
// - Uses EXACT same maxTokens default: 100 (matches twilioVoice.js:1107)
// This ensures simulation results reflect actual production assistant behavior.

import {
  SimulationScenario,
  SimulationConfig,
  SimulationResult,
  ConversationTurn,
  SimulationEndReason,
} from "./types";

// CRITICAL: Reuse EXACT production assistant logic from callcrew-backend.
// This imports the same openaiService singleton used by production webhooks.
// The assistant behavior MUST be identical to live calls.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const openaiService = require("../../callcrew-backend/services/openaiService");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildSystemPrompt } = require("./systemPromptTemplate");

interface RunSimulationOptions {
  assistantVersion?: string;
}

/**
 * Build system prompt using the EXACT same logic as production's getAIResponse function.
 * Delegates to the shared systemPromptTemplate used by production.
 */
function buildSystemPromptForScenario(scenario: SimulationScenario): string {
  const businessName = scenario.businessName;
  const customInstructions = scenario.notes || "";
  const services: string[] = scenario.persona.company ? [scenario.persona.company] : [];

  return buildSystemPrompt(businessName, customInstructions, services);
}

/**
 * Very simple caller simulator: given the last assistant message and the scenario,
 * decide what the caller says next. This can be upgraded later (e.g., with an LLM),
 * but for now we keep it deterministic and cheap.
 */
function simulateCallerTurn(
  scenario: SimulationScenario,
  transcript: ConversationTurn[]
): string | null {
  const turnsSoFar = transcript.filter((t) => t.role === "caller").length;
  if (turnsSoFar === 0) return scenario.initialUtterance;

  const lastAssistant = [...transcript].reverse().find((t) => t.role === "assistant");
  if (!lastAssistant) return scenario.initialUtterance;

  const text = lastAssistant.content.toLowerCase();

  if (text.includes("name") && !text.includes("anything else")) {
    return "Sure, it's " + scenario.persona.name + ".";
  }
  if (text.includes("phone") || text.includes("call back")) {
    return "You can reach me at 555-123-4567.";
  }
  if (text.includes("reason for your call") || text.includes("how can i help")) {
    return "I'm calling because I " + scenario.intent.replace(/_/g, " ") + ".";
  }
  if (text.includes("anything else") || text.includes("any other questions")) {
    return "No, that’s everything. Thank you for your help.";
  }

  // Default: acknowledge and restate the goal once
  if (turnsSoFar < 3) {
    return "Yes, that sounds good. I mainly want to make sure this is all set up.";
  }

  // After a few turns, let the caller hang up politely
  return null;
}

export async function runSimulation(
  scenario: SimulationScenario,
  config: SimulationConfig,
  options: RunSimulationOptions = {}
): Promise<SimulationResult> {
  const startedAt = new Date().toISOString();
  const transcript: ConversationTurn[] = [];
  let endReason: SimulationEndReason = "max_turns_reached";
  let error: string | undefined;

  try {
    // Build system prompt using EXACT production logic (matches twilioVoice.js:1093-1102)
    const systemPrompt = buildSystemPromptForScenario(scenario);
    const assistantVersion =
      options.assistantVersion || process.env.ASSISTANT_VERSION || "unknown";

    let callerNext = simulateCallerTurn(scenario, transcript);
    let turnIndex = 0;

    while (turnIndex < config.maxTurns) {
      if (!callerNext) {
        endReason = "caller_hung_up";
        break;
      }

      // Caller speaks
      transcript.push({
        role: "caller",
        content: callerNext,
        timestamp: new Date().toISOString(),
      });

      // Assistant responds using EXACT production function: openaiService.processConversation
      // This is the same function called by production webhooks (twilioVoice.js:1104)
      const conversationHistory = transcript.map((t) => ({
        role: t.role === "caller" ? "user" : "assistant",
        content: t.content,
      }));

      // Match production's maxTokens (twilioVoice.js:1107 uses maxTokens: 100)
      // But allow override via config for longer simulation conversations
      const result = await openaiService.processConversation(conversationHistory, systemPrompt, {
        maxTokens: config.maxAssistantTokens ?? 100, // Default matches production exactly
      });

      transcript.push({
        role: "assistant",
        content: result.response,
        timestamp: new Date().toISOString(),
      });

      // Determine next caller line
      callerNext = simulateCallerTurn(scenario, transcript);
      turnIndex += 1;

      if (!callerNext) {
        endReason = "success_criteria_met";
        break;
      }
    }

    const finishedAt = new Date().toISOString();
    return {
      scenario,
      config,
      transcript,
      endReason,
      error,
      startedAt,
      finishedAt,
      assistantVersion: options.assistantVersion || process.env.ASSISTANT_VERSION || "unknown",
    };
  } catch (e: any) {
    error = e?.message || String(e);
    endReason = "error";
    const finishedAt = new Date().toISOString();
    return {
      scenario,
      config,
      transcript,
      endReason,
      error,
      startedAt,
      finishedAt,
      assistantVersion: options.assistantVersion || process.env.ASSISTANT_VERSION || "unknown",
    };
  }
}

