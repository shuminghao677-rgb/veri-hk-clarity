import { createServerFn } from "@tanstack/react-start";
import {
  MAX_ANALYSIS_INPUT_CHARS,
  isPhaseOneReport,
  type AnalyzeTextInput,
  type PhaseOneClaim,
  type PhaseOneReport,
} from "@/lib/report-contract";
import {
  retrieveLiveEvidence,
  type EvidenceRetrievalResult,
  type SourceFreshnessSummary,
} from "@/lib/live-sources";

const DEFAULT_AI_MODEL = "gemini-3.5-flash";

type RawModelClaim = {
  id?: unknown;
  text?: unknown;
  verdict?: unknown;
  confidence?: unknown;
  explanation?: unknown;
  recommendation?: unknown;
  evidence?: unknown;
};

type RawModelReport = {
  overall_confidence?: unknown;
  claims?: unknown;
};

type GeminiPart = {
  text?: unknown;
  [key: string]: unknown;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
  finishMessage?: string;
};

type GeminiGenerateContentResponse = {
  promptFeedback?: unknown;
  candidates?: GeminiCandidate[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GeminiNoTextReason =
  | "safety_blocked"
  | "no_candidates"
  | "max_tokens"
  | "malformed_response"
  | "empty_model_output"
  | "unknown_finish_reason";

export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

export const analyzeText = createServerFn({ method: "POST" })
  .validator((input: AnalyzeTextInput) => validateAnalyzeInput(input))
  .handler(async ({ data }) => {
    return buildReport(data.text);
  });

function validateAnalyzeInput(input: AnalyzeTextInput): AnalyzeTextInput {
  if (!input || typeof input.text !== "string") {
    throw new AnalysisError("Please enter text to analyze.", 400);
  }

  const text = input.text.trim();
  if (!text) {
    throw new AnalysisError("Please enter text to analyze.", 400);
  }

  if (text.length > MAX_ANALYSIS_INPUT_CHARS) {
    throw new AnalysisError(
      `Please keep the text under ${MAX_ANALYSIS_INPUT_CHARS.toLocaleString()} characters for this first version.`,
      413,
    );
  }

  return { text };
}

async function buildReport(text: string): Promise<PhaseOneReport> {
  const extractedClaims = await extractClaims(text);
  const evidenceSnapshot = await retrieveEvidence(extractedClaims);
  const report = assembleReport(
    text,
    evidenceSnapshot.claims,
    evidenceSnapshot.freshness,
    evidenceSnapshot.counts,
    evidenceSnapshot.coverage,
  );

  if (!isPhaseOneReport(report)) {
    throw new AnalysisError("The analysis response was not in the expected format.");
  }

  return report;
}

async function extractClaims(text: string): Promise<PhaseOneClaim[]> {
  const rawReport = await requestPreliminaryAnalysis(text);
  const claims = normalizeClaims(rawReport.claims);

  if (claims.length < 1) {
    throw new AnalysisError("No factual claims were found in the submitted text.", 422);
  }

  return claims.slice(0, 3);
}

async function retrieveEvidence(claims: PhaseOneClaim[]): Promise<EvidenceRetrievalResult> {
  return retrieveLiveEvidence(claims);
}

function assembleReport(
  text: string,
  claims: PhaseOneClaim[],
  sourceFreshness: SourceFreshnessSummary[],
  counts: EvidenceRetrievalResult["counts"],
  coverage: EvidenceRetrievalResult["coverage"],
): PhaseOneReport {
  const averageConfidence =
    claims.reduce((total, claim) => total + claim.confidence, 0) / Math.max(claims.length, 1);

  return {
    report_id: `phase1-${crypto.randomUUID()}`,
    analysis_type: "preliminary_ai_analysis",
    input_content: text,
    checked_at: new Date().toISOString(),
    overall_confidence: clampConfidence(averageConfidence),
    evidence_coverage: coverage,
    source_freshness: sourceFreshness,
    retrieval_counts: counts,
    claims,
  };
}

async function requestPreliminaryAnalysis(text: string): Promise<RawModelReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalysisError("GEMINI_API_KEY is not configured on the server.");
  }

  const model = process.env.AI_MODEL || DEFAULT_AI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "You create preliminary AI analysis for VeriHK.",
                "Extract 1 to 3 factual claims from user text.",
                "Do not claim that Hong Kong official evidence, live sources, databases, RSS feeds, or external facts were checked.",
                "Because no official evidence is retrieved in this phase, prefer insufficient_evidence.",
                "Use supported or refuted only when the submitted text itself contains enough wording, internal contradiction, or direct context to justify that label.",
                "Return concise explanations and recommendations.",
                "Return only JSON matching the requested schema.",
                "",
                "Analyze this text for preliminary claim extraction and classification only:",
                text,
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          required: ["overall_confidence", "claims"],
          properties: {
            overall_confidence: {
              type: "number",
            },
            claims: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: {
                type: "object",
                required: [
                  "id",
                  "text",
                  "verdict",
                  "confidence",
                  "explanation",
                  "recommendation",
                  "evidence",
                ],
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                  verdict: {
                    type: "string",
                    enum: ["supported", "refuted", "insufficient_evidence"],
                  },
                  confidence: {
                    type: "number",
                  },
                  explanation: { type: "string" },
                  recommendation: { type: "string" },
                  evidence: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {},
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

  if (!response.ok) {
    logGeminiDiagnostics(response.status, payload);
    const message = getGeminiErrorMessage(payload);
    throw new AnalysisError(
      `Gemini request failed (${response.status}): ${message}`,
      response.status,
    );
  }

  if (!payload) {
    logGeminiDiagnostics(response.status, payload);
    throw new AnalysisError("malformed_response: Gemini returned a non-JSON response.");
  }

  const content = extractGeminiText(payload);
  if (!content) {
    logGeminiDiagnostics(response.status, payload);
    const reason = classifyNoTextGeminiResponse(payload);
    throw new AnalysisError(`${reason}: Gemini did not return a usable text response.`);
  }

  try {
    const parsed = JSON.parse(content) as RawModelReport;
    if (!isRawModelReport(parsed)) {
      logGeminiDiagnostics(response.status, payload);
      throw new AnalysisError("malformed_response: Gemini returned JSON with an unexpected shape.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    logGeminiDiagnostics(response.status, payload);
    console.error("Gemini JSON parse failed", error);
    throw new AnalysisError("malformed_response: Gemini returned invalid JSON.");
  }
}

function extractGeminiText(payload: GeminiGenerateContentResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function classifyNoTextGeminiResponse(payload: GeminiGenerateContentResponse): GeminiNoTextReason {
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return hasPromptBlock(payload) ? "safety_blocked" : "no_candidates";
  }

  const finishReason = candidates[0]?.finishReason;
  if (
    finishReason === "SAFETY" ||
    finishReason === "RECITATION" ||
    finishReason === "PROHIBITED_CONTENT"
  ) {
    return "safety_blocked";
  }
  if (finishReason === "MAX_TOKENS") return "max_tokens";
  if (!candidates[0]?.content || !Array.isArray(candidates[0].content.parts)) {
    return "malformed_response";
  }
  if (finishReason && finishReason !== "STOP") return "unknown_finish_reason";
  return "empty_model_output";
}

function logGeminiDiagnostics(status: number, payload: GeminiGenerateContentResponse | null): void {
  if (process.env.GEMINI_DEBUG !== "true") return;

  const candidates = payload?.candidates;
  const candidateDiagnostics = Array.isArray(candidates)
    ? candidates.map((candidate) => {
        const parts = candidate.content?.parts;
        return {
          finishReason: candidate.finishReason ?? null,
          finishMessage: candidate.finishMessage ?? null,
          partTypes: Array.isArray(parts) ? parts.map(getGeminiPartTypes) : [],
          hasTextPart: Array.isArray(parts)
            ? parts.some((part) => typeof part.text === "string" && part.text.length > 0)
            : false,
        };
      })
    : [];

  console.error("Gemini diagnostic", {
    status,
    promptFeedback: payload?.promptFeedback ?? null,
    candidatesLength: Array.isArray(candidates) ? candidates.length : 0,
    candidates: candidateDiagnostics,
    errorStatus: payload?.error?.status ?? null,
    errorMessage: payload?.error?.message ?? null,
  });
}

function getGeminiPartTypes(part: GeminiPart): string[] {
  return Object.keys(part).filter((key) => part[key] !== undefined);
}

function getGeminiErrorMessage(payload: GeminiGenerateContentResponse | null): string {
  return payload?.error?.message || "Unknown Gemini API error";
}

function hasPromptBlock(payload: GeminiGenerateContentResponse): boolean {
  const promptFeedback = payload.promptFeedback;
  return (
    typeof promptFeedback === "object" && promptFeedback !== null && "blockReason" in promptFeedback
  );
}

function isRawModelReport(value: unknown): value is RawModelReport {
  if (typeof value !== "object" || value === null) return false;
  const report = value as RawModelReport;
  if (typeof report.overall_confidence !== "number") return false;
  return Array.isArray(report.claims);
}

function normalizeClaims(rawClaims: unknown): PhaseOneClaim[] {
  if (!Array.isArray(rawClaims)) return [];

  return rawClaims
    .map((claim, index) => normalizeClaim(claim, index))
    .filter((claim): claim is PhaseOneClaim => claim !== null);
}

function normalizeClaim(rawClaim: unknown, index: number): PhaseOneClaim | null {
  if (!isRawClaim(rawClaim)) return null;

  const text = String(rawClaim.text).trim();
  const explanation = String(rawClaim.explanation).trim();
  const recommendation = String(rawClaim.recommendation).trim();

  if (!text || !explanation || !recommendation) return null;

  return {
    id:
      typeof rawClaim.id === "string" && rawClaim.id.trim()
        ? rawClaim.id.trim()
        : `claim-${index + 1}`,
    text,
    verdict:
      rawClaim.verdict === "supported" || rawClaim.verdict === "refuted"
        ? rawClaim.verdict
        : "insufficient_evidence",
    confidence: clampConfidence(Number(rawClaim.confidence)),
    explanation,
    recommendation,
    evidence: [],
  };
}

function isRawClaim(value: unknown): value is RawModelClaim {
  return typeof value === "object" && value !== null;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
