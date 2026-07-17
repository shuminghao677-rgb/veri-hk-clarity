import type {
  AdjudicationInput,
  AdjudicationOutput,
  ValidatedAdjudication,
  AdjudicationFactValue,
} from "./adjudication-contract";
import type { PhaseOneClaim, PhaseOneEvidence, ReportVerdict } from "./report-contract";

const DEFAULT_AI_MODEL = "gemini-3.1-flash-lite";
const ADJUDICATOR_TIMEOUT_MS = Number(process.env.GEMINI_ADJUDICATOR_TIMEOUT_MS || 30_000);

type GeminiPart = { text?: unknown; [key: string]: unknown };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  error?: { message?: string };
};

export type EvidenceAdjudicatorOptions = {
  fetchFn?: typeof fetch;
  adjudicateFn?: (input: AdjudicationInput) => Promise<unknown>;
};

export async function adjudicateClaimWithOfficialEvidence(
  input: AdjudicationInput,
  options: EvidenceAdjudicatorOptions = {},
): Promise<ValidatedAdjudication> {
  if (input.evidence.length === 0) {
    return {
      ok: true,
      output: insufficientOutput(input, "No official evidence was supplied for adjudication."),
    };
  }

  try {
    const raw = options.adjudicateFn
      ? await options.adjudicateFn(input)
      : await requestGeminiAdjudication(input, options.fetchFn);
    return validateAdjudicationOutput(raw, input);
  } catch (error) {
    logAdjudicatorDiagnostic(input, {
      validatedFinalVerdict: "insufficient_evidence",
      rejectionReason: error instanceof Error ? error.message : "adjudicator_request_failed",
    });
    return { ok: false, reason: "adjudicator_request_failed" };
  }
}

export function buildAdjudicationInput(
  claim: PhaseOneClaim,
  category: string,
  evidence: PhaseOneEvidence[],
): AdjudicationInput {
  return {
    claim: {
      id: claim.id,
      text: claim.text,
      category,
    },
    evidence: evidence
      .filter((item) => item.source_authority === "official" || item.source_key)
      .map((item) => ({
        evidence_id: item.id,
        source: item.source_name,
        source_type: item.source_type,
        title: item.title,
        content: [item.excerpt, item.summary].filter(Boolean).join("\n"),
        published_at: item.published_at ?? undefined,
        updated_at: item.updated_at ?? undefined,
        retrieved_at: item.retrieved_at,
        freshness: item.freshness ?? "unknown",
        structured_facts: extractStructuredFacts(item),
      })),
  };
}

export function validateAdjudicationOutput(
  value: unknown,
  input: AdjudicationInput,
): ValidatedAdjudication {
  if (!isRecord(value)) return { ok: false, reason: "malformed_json" };
  if (value.claim_id !== input.claim.id) return { ok: false, reason: "claim_id_mismatch" };
  if (!isVerdict(value.verdict)) return { ok: false, reason: "invalid_verdict" };
  if (typeof value.confidence !== "number" || value.confidence < 0 || value.confidence > 1) {
    return { ok: false, reason: "invalid_confidence" };
  }
  if (!isStringArray(value.evidence_ids_used)) {
    return { ok: false, reason: "invalid_evidence_ids" };
  }
  const evidenceIdsUsed = value.evidence_ids_used;
  if (!isStringArray(value.supported_elements)) return { ok: false, reason: "invalid_supported" };
  const supportedElements = value.supported_elements;
  if (!isStringArray(value.contradicted_elements)) {
    return { ok: false, reason: "invalid_contradicted" };
  }
  const contradictedElements = value.contradicted_elements;
  if (!isStringArray(value.missing_elements)) return { ok: false, reason: "invalid_missing" };
  const missingElements = value.missing_elements;
  if (typeof value.explanation !== "string" || !value.explanation.trim()) {
    return { ok: false, reason: "missing_explanation" };
  }
  if (typeof value.recommendation !== "string" || !value.recommendation.trim()) {
    return { ok: false, reason: "missing_recommendation" };
  }
  if (/https?:\/\//i.test(value.explanation) || /https?:\/\//i.test(value.recommendation)) {
    return { ok: false, reason: "generated_url" };
  }

  const allowedEvidenceIds = new Set(input.evidence.map((item) => item.evidence_id));
  if (evidenceIdsUsed.some((id) => !allowedEvidenceIds.has(id))) {
    return { ok: false, reason: "invented_evidence_id" };
  }
  if (
    (value.verdict === "supported" || value.verdict === "refuted") &&
    evidenceIdsUsed.length === 0
  ) {
    return { ok: false, reason: "conclusive_without_evidence" };
  }
  const staleUsed = input.evidence.some(
    (item) => item.freshness === "stale" && evidenceIdsUsed.includes(item.evidence_id),
  );
  if (staleUsed && isCurrentStatusClaim(input.claim.text) && value.verdict === "supported") {
    return { ok: false, reason: "stale_current_support" };
  }
  if (mentionsInventedSource(value.explanation, input) || mentionsInventedSource(value.recommendation, input)) {
    return { ok: false, reason: "invented_source" };
  }
  if (mentionsInventedWarnsumWarning(value, input)) {
    return { ok: false, reason: "invented_warning_fact" };
  }
  if (/web search|internet|online sources|additional sources|other government sources/i.test(value.explanation)) {
    return { ok: false, reason: "broader_source_coverage" };
  }

  const output: AdjudicationOutput = {
    claim_id: value.claim_id,
    verdict: value.verdict,
    confidence: capAdjudicationConfidence(value.confidence, value.verdict, input, evidenceIdsUsed),
    evidence_ids_used: evidenceIdsUsed,
    supported_elements: supportedElements,
    contradicted_elements: contradictedElements,
    missing_elements: missingElements,
    explanation: value.explanation.trim(),
    recommendation: value.recommendation.trim(),
  };
  return { ok: true, output };
}

export function applyAdjudicationToClaim(
  claim: PhaseOneClaim,
  evidence: PhaseOneEvidence[],
  output: AdjudicationOutput,
): PhaseOneClaim {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const usedEvidence = output.evidence_ids_used
    .map((id) => evidenceById.get(id))
    .filter((item): item is PhaseOneEvidence => Boolean(item));

  return {
    ...claim,
    verdict: output.verdict,
    confidence: output.confidence,
    evidence: usedEvidence.length ? usedEvidence : claim.evidence,
    explanation: output.explanation,
    recommendation: output.recommendation,
  };
}

export function insufficientAdjudicationClaim(
  claim: PhaseOneClaim,
  explanation = "Official evidence was checked, but it does not establish the full claim.",
): PhaseOneClaim {
  return {
    ...claim,
    verdict: "insufficient_evidence",
    confidence: Math.min(claim.confidence || 0.6, 0.6),
    explanation,
    recommendation: "Review the attached official evidence and retry with a more specific claim if needed.",
  };
}

async function requestGeminiAdjudication(
  input: AdjudicationInput,
  fetchFn: typeof fetch = fetch,
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("missing_api_key");
  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ADJUDICATOR_TIMEOUT_MS);

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(buildGeminiAdjudicationBody(input)),
    });
    const payload = (await response.json().catch(() => null)) as GeminiResponse | null;
    if (!response.ok) throw new Error(payload?.error?.message || `gemini_${response.status}`);
    const text = extractGeminiText(payload);
    if (!text) throw new Error("empty_adjudicator_output");
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function buildGeminiAdjudicationBody(input: AdjudicationInput): Record<string, unknown> {
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "You are comparing one factual claim against supplied official evidence.",
              "Use only the supplied evidence.",
              "Do not use general knowledge.",
              "Do not infer that a source was checked unless it appears in the evidence.",
              "Supported means the supplied evidence directly establishes the claim.",
              "Refuted means the supplied evidence directly contradicts the claim.",
              "Insufficient evidence means the evidence is missing, ambiguous, stale where freshness is material, only partially relevant, or does not establish the full claim.",
              "Make the verdict last.",
              "Return only valid JSON.",
              "Do not include URLs unless they already appear in supplied evidence.",
              "",
              JSON.stringify(input),
            ].join("\n"),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        required: [
          "claim_id",
          "verdict",
          "confidence",
          "evidence_ids_used",
          "supported_elements",
          "contradicted_elements",
          "missing_elements",
          "explanation",
          "recommendation",
        ],
        properties: {
          claim_id: { type: "string" },
          verdict: {
            type: "string",
            enum: ["supported", "refuted", "insufficient_evidence"],
          },
          confidence: { type: "number" },
          evidence_ids_used: { type: "array", items: { type: "string" } },
          supported_elements: { type: "array", items: { type: "string" } },
          contradicted_elements: { type: "array", items: { type: "string" } },
          missing_elements: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
          recommendation: { type: "string" },
        },
      },
    },
  };
}

function capAdjudicationConfidence(
  confidence: number,
  verdict: ReportVerdict,
  input: AdjudicationInput,
  evidenceIdsUsed: string[],
): number {
  if (verdict === "insufficient_evidence") return Math.min(confidence, 0.6);
  const usedEvidence = input.evidence.filter((item) => evidenceIdsUsed.includes(item.evidence_id));
  if (usedEvidence.some((item) => item.freshness === "stale")) return Math.min(confidence, 0.55);
  if (usedEvidence.length > 1) return Math.min(confidence, 0.94);
  return Math.min(confidence, 0.88);
}

function insufficientOutput(input: AdjudicationInput, explanation: string): AdjudicationOutput {
  return {
    claim_id: input.claim.id,
    verdict: "insufficient_evidence",
    confidence: 0.45,
    evidence_ids_used: [],
    supported_elements: [],
    contradicted_elements: [],
    missing_elements: ["Official evidence was not available for this claim."],
    explanation,
    recommendation: "Check official sources directly or retry with a more specific claim.",
  };
}

function extractStructuredFacts(evidence: PhaseOneEvidence): Record<string, AdjudicationFactValue> {
  const facts: Record<string, AdjudicationFactValue> = {};
  if (evidence.structured_facts) {
    for (const [key, value] of Object.entries(evidence.structured_facts)) {
      if (isAdjudicationFactValue(value)) facts[key] = value;
    }
  }
  if (evidence.relevance_score !== undefined) facts.relevance_score = evidence.relevance_score;
  if (evidence.category) facts.category = evidence.category;
  if (evidence.traffic_metadata) {
    for (const [key, value] of Object.entries(evidence.traffic_metadata)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        facts[`traffic_${key}`] = value;
      }
    }
  }
  return facts;
}

function isAdjudicationFactValue(value: unknown): value is AdjudicationFactValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) return value.every(isAdjudicationFactValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isAdjudicationFactValue);
}

function extractGeminiText(payload: GeminiResponse | null): string {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => (typeof part.text === "string" ? part.text : "")).join("").trim();
}

function isVerdict(value: unknown): value is ReportVerdict {
  return value === "supported" || value === "refuted" || value === "insufficient_evidence";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCurrentStatusClaim(text: string): boolean {
  return /\b(current|currently|now|active|in force|operating normally|closed|reopened)\b/i.test(text);
}

function mentionsInventedSource(text: string, input: AdjudicationInput): boolean {
  const officialNames = [
    "Hong Kong Observatory",
    "Transport Department",
    "Government News",
    "Education Bureau",
    "GovHK",
    "HKO",
    "TD",
    "EDB",
  ];
  const allowed = new Set(input.evidence.flatMap((item) => [item.source, item.title]));
  return officialNames.some((name) => text.includes(name) && ![...allowed].some((item) => item.includes(name)));
}

function mentionsInventedWarnsumWarning(value: Record<string, unknown>, input: AdjudicationInput): boolean {
  const warnsumEvidence = input.evidence.find((item) => item.evidence_id === "hko-warnsum-current");
  if (!warnsumEvidence) return false;

  const facts = warnsumEvidence.structured_facts;
  const nestedFacts = isRecord(facts?.facts) ? facts.facts : {};
  const activeNames = getStringArray(nestedFacts.active_warning_names);
  const activeCodes = getStringArray(nestedFacts.active_warning_codes);
  const allowed = new Set([...activeNames, ...activeCodes, "HKO", "Hong Kong Observatory"]);
  const text = [
    value.explanation,
    value.recommendation,
    ...(Array.isArray(value.supported_elements) ? value.supported_elements : []),
    ...(Array.isArray(value.contradicted_elements) ? value.contradicted_elements : []),
    ...(Array.isArray(value.missing_elements) ? value.missing_elements : []),
  ]
    .filter((item): item is string => typeof item === "string")
    .join(" ");

  const knownWarnings = [
    "Thunderstorm Warning",
    "Black Rainstorm Warning",
    "Red Rainstorm Warning",
    "Amber Rainstorm Warning",
    "Tropical Cyclone Warning Signal",
    "Very Hot Weather Warning",
    "Cold Weather Warning",
    "Landslip Warning",
    "WTS",
    "WRAINB",
    "WRAINR",
    "WRAINA",
    "TC1",
    "TC3",
    "TC8NE",
    "TC8SE",
    "TC8SW",
    "TC8NW",
    "TC9",
    "TC10",
  ];

  return knownWarnings.some((warning) => text.includes(warning) && !allowed.has(warning));
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function logAdjudicatorDiagnostic(
  input: AdjudicationInput,
  result: { deterministicResult?: string; validatedFinalVerdict?: string; rejectionReason?: string },
): void {
  if (process.env.GEMINI_DEBUG !== "true") return;
  console.info("Evidence adjudicator diagnostic", {
    claimId: input.claim.id,
    deterministicResult: result.deterministicResult ?? "insufficient_evidence",
    adjudicatorCalled: true,
    evidenceCount: input.evidence.length,
    evidenceIds: input.evidence.map((item) => item.evidence_id),
    validatedFinalVerdict: result.validatedFinalVerdict ?? null,
    validationRejectionReason: result.rejectionReason ?? null,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
