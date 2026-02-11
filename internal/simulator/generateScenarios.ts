// INTERNAL ONLY – Scenario generator for CallCrew assistant simulations.
// This module is NOT used in production request handling.

import {
  SimulationScenario,
  ScenarioIntent,
  CallerTone,
  ScenarioSuccessCriteria,
  ScenarioEdgeCases,
} from "./types";

const DEFAULT_MODEL = process.env.SIM_SCENARIO_MODEL || "gpt-4o-mini";

function getOpenAIClient(): any | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.error(
        "[simulator] OPENAI_API_KEY not set – generateScenarios will fall back to static scenarios."
      );
    }
    return null;
  }
  let OpenAIConstructor: any;
  try {
    // Optional dependency: if not installed, we fall back to static scenarios.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("openai");
    OpenAIConstructor = mod.default || mod;
  } catch (err) {
    if (process.env.DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.error(
        "[simulator] 'openai' package not found – generateScenarios will fall back to static scenarios."
      );
    }
    return null;
  }

  return new OpenAIConstructor({ apiKey });
}

export interface GenerateScenarioOptions {
  businessName?: string;
  industry?: string;
  intents?: ScenarioIntent[];
  tones?: CallerTone[];
}

/**
 * Generate a small set of synthetic caller scenarios using an LLM.
 * If OpenAI is not configured, returns a deterministic static set.
 */
export async function generateScenarios(
  count: number,
  options: GenerateScenarioOptions = {}
): Promise<SimulationScenario[]> {
  const client = getOpenAIClient();
  if (!client) {
    return getFallbackScenarios(count, options);
  }

  const businessName = options.businessName || "CallCrew Lunch-Hour Assistant";
  const industry = options.industry || "small_business_receptionist";

  const systemPrompt = `
You are generating test phone call scenarios for an AI phone receptionist called CallCrew.

OUTPUT STRICTLY AS JSON ARRAY, no commentary.
Each item MUST have these fields:
- id (string)
- title (string)
- businessName (string)
- businessIndustry (string)
- persona: { name, role, company?, description }
- intent (one of: book_appointment, reschedule, pricing_question, new_lead_general, urgent_issue, after_hours_message, other)
- tone (one of: calm, stressed, angry, confused, neutral)
- constraints (array of short strings)
- successCriteria: {
    description,
    mustCollectName,
    mustCollectPhone,
    mustCollectReason,
    shouldOfferCallbackOrBooking,
    customChecks?
  }
- edgeCases: {
    noisyBackground?,
    poorCellReception?,
    overlappingSpeakers?,
    unclearReason?,
    languageBarrier?
  }
- initialUtterance (realistic first sentence the caller says)
- notes (optional)
`;

  const userPrompt = `
Generate ${count} caller scenarios for business "${businessName}" in industry "${industry}".
STRICTLY focus on one simple use case:
- Small business lunch-hour or after-hours call
- Goal: capture a reliable callback phone number and brief reason for calling

All scenarios MUST:
- Share the same assistant configuration (no branching flows)
- Have successCriteria that explicitly require capturing the caller's phone number
- Avoid complex multi-party or multi-day situations
`.trim();

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content || "[]";
  let parsed: any[] = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch (err) {
    if (process.env.DEBUG === "1") {
      // eslint-disable-next-line no-console
      console.error("[simulator] Failed to parse scenario JSON from LLM, falling back:", err);
    }
    return getFallbackScenarios(count, options);
  }

  return parsed.slice(0, count).map(normalizeScenario);
}

function normalizeScenario(input: any): SimulationScenario {
  const id = String(input.id || input.title || Date.now().toString());
  const base: SimulationScenario = {
    id,
    title: input.title || "Unnamed Scenario",
    businessName: input.businessName || "Sample Business",
    businessIndustry: input.businessIndustry || "general_services",
    persona: {
      name: input.persona?.name || "Unknown Caller",
      role: input.persona?.role || "prospective customer",
      company: input.persona?.company,
      description: input.persona?.description || "No detailed persona description provided.",
    },
    intent: coerceIntent(input.intent),
    tone: coerceTone(input.tone),
    constraints: Array.isArray(input.constraints) ? input.constraints : [],
    successCriteria: normalizeSuccessCriteria(input.successCriteria),
    edgeCases: normalizeEdgeCases(input.edgeCases),
    initialUtterance:
      input.initialUtterance ||
      "Hi, I was hoping to learn more about your services and maybe book an appointment.",
    notes: input.notes,
  };
  return base;
}

function coerceIntent(intent: any): ScenarioIntent {
  const allowed: ScenarioIntent[] = [
    "book_appointment",
    "reschedule",
    "pricing_question",
    "new_lead_general",
    "urgent_issue",
    "after_hours_message",
    "other",
  ];
  if (allowed.includes(intent)) return intent;
  return "other";
}

function coerceTone(tone: any): CallerTone {
  const allowed: CallerTone[] = ["calm", "stressed", "angry", "confused", "neutral"];
  if (allowed.includes(tone)) return tone;
  return "neutral";
}

function normalizeSuccessCriteria(input: any): ScenarioSuccessCriteria {
  return {
    description:
      input?.description ||
      "Caller feels heard, their question is answered or a clear next step is offered.",
    mustCollectName: Boolean(input?.mustCollectName ?? true),
    mustCollectPhone: Boolean(input?.mustCollectPhone ?? true),
    mustCollectReason: Boolean(input?.mustCollectReason ?? true),
    shouldOfferCallbackOrBooking: Boolean(input?.shouldOfferCallbackOrBooking ?? true),
    customChecks: Array.isArray(input?.customChecks) ? input.customChecks : undefined,
  };
}

function normalizeEdgeCases(input: any): ScenarioEdgeCases {
  return {
    noisyBackground: Boolean(input?.noisyBackground),
    poorCellReception: Boolean(input?.poorCellReception),
    overlappingSpeakers: Boolean(input?.overlappingSpeakers),
    unclearReason: Boolean(input?.unclearReason),
    languageBarrier: Boolean(input?.languageBarrier),
  };
}

/**
 * Deterministic fallback scenarios when OpenAI is not available.
 */
function getFallbackScenarios(
  count: number,
  options: GenerateScenarioOptions
): SimulationScenario[] {
  const businessName = options.businessName || "Main Street Dental";
  const base: SimulationScenario[] = [
    {
      id: "fallback-1",
      title: "New patient booking during lunch rush",
      businessName,
      businessIndustry: options.industry || "dental_clinic",
      persona: {
        name: "Sarah",
        role: "new patient",
        description: "Busy professional trying to book a first-time appointment on her lunch break.",
      },
      intent: "book_appointment",
      tone: "stressed",
      constraints: ["Has only a few minutes to talk", "Wants something this week if possible"],
      successCriteria: {
        description:
          "Appointment booked or clear follow-up with captured contact details and preferred times.",
        mustCollectName: true,
        mustCollectPhone: true,
        mustCollectReason: true,
        shouldOfferCallbackOrBooking: true,
      },
      edgeCases: {
        noisyBackground: true,
      },
      initialUtterance:
        "Hi, I'm trying to see if I can book a new patient appointment sometime this week.",
      notes: "Classic high-intent new lead; prioritize capturing details quickly.",
    },
    {
      id: "fallback-2",
      title: "After-hours emergency question",
      businessName,
      businessIndustry: options.industry || "dental_clinic",
      persona: {
        name: "Mark",
        role: "existing patient",
        description:
          "Concerned caller with pain after a recent procedure, calling outside normal hours.",
      },
      intent: "urgent_issue",
      tone: "confused",
      constraints: ["Calling after hours", "Unsure if this is an emergency"],
      successCriteria: {
        description:
          "Caller gets reassurance, clear next steps, and knows how/when the office will follow up.",
        mustCollectName: true,
        mustCollectPhone: true,
        mustCollectReason: true,
        shouldOfferCallbackOrBooking: true,
        customChecks: ["Assistant does not give medical advice beyond allowed guidance."],
      },
      edgeCases: {
        unclearReason: true,
      },
      initialUtterance:
        "Hi, I had some work done earlier today and now my tooth is really hurting. I’m not sure what to do.",
      notes: "Tests after-hours flow, tone, and safety guidance.",
    },
  ];

  if (count >= base.length) return base;
  return base.slice(0, count);
}

