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
const GEMINI_MAX_ATTEMPTS = 4;
const GEMINI_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
const GEMINI_ATTEMPT_TIMEOUT_MS = Number(process.env.GEMINI_ATTEMPT_TIMEOUT_MS || 35_000);
const TRANSIENT_GEMINI_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

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

type GeminiRequestOptions = {
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  randomFn?: () => number;
  attemptTimeoutMs?: number;
};

export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly code?: string,
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
  return requestPreliminaryAnalysisWithRetry(text);
}

export async function requestPreliminaryAnalysisForTest(
  text: string,
  options: GeminiRequestOptions = {},
): Promise<RawModelReport> {
  return requestPreliminaryAnalysisWithRetry(text, options);
}

async function requestPreliminaryAnalysisWithRetry(
  text: string,
  options: GeminiRequestOptions = {},
): Promise<RawModelReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AnalysisError(
      "GEMINI_API_KEY is not configured on the server.",
      500,
      "missing_api_key",
    );
  }

  const fallbackModel = process.env.AI_FALLBACK_MODEL?.trim();
  const primaryModel = process.env.AI_MODEL || DEFAULT_AI_MODEL;
  const hasFallbackModel = Boolean(fallbackModel && fallbackModel !== primaryModel);
  const primaryMaxAttempts = hasFallbackModel ? GEMINI_MAX_ATTEMPTS - 1 : GEMINI_MAX_ATTEMPTS;
  const primary = await requestGeminiModelWithRetry(
    text,
    primaryModel,
    apiKey,
    options,
    primaryMaxAttempts,
  );
  if (primary.ok === true) return primary.report;
  const primaryError = primary;

  if (primaryError.transientExhausted && fallbackModel && fallbackModel !== primaryModel) {
    const waitMs = getRetryDelayMs(primaryMaxAttempts, primaryError.retryAfterHeader, options.randomFn);
    logGeminiRetryDiagnostics({
      model: fallbackModel,
      attempt: 1,
      status: null,
      waitMs,
      elapsedMs: 0,
      message: "Trying configured fallback Gemini model after primary transient retries.",
    });
    await (options.sleepFn ?? sleep)(waitMs);
    const fallback = await requestGeminiModelWithRetry(text, fallbackModel, apiKey, options, 1);
    if (fallback.ok === true) return fallback.report;
    throw fallback.error;
  }

  throw primaryError.error;
}

async function requestGeminiModelWithRetry(
  text: string,
  model: string,
  apiKey: string,
  options: GeminiRequestOptions,
  maxAttempts: number,
): Promise<
  | { ok: true; report: RawModelReport }
  | { ok: false; error: AnalysisError; transientExhausted: boolean; retryAfterHeader: string | null }
> {
  let lastError: AnalysisError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    const result = await requestGeminiModelOnce(text, model, apiKey, options);
    const elapsedMs = Date.now() - startedAt;
    if (result.ok === true) return result;
    const failed = result;

    lastError = failed.error;
    const retryable = isTransientStatus(failed.error.statusCode);
    const hasAttemptsLeft = attempt < maxAttempts;

    if (!retryable || !hasAttemptsLeft) {
      logGeminiRetryDiagnostics({
        model,
        attempt,
        status: failed.error.statusCode,
        waitMs: 0,
        elapsedMs,
        message: `Final Gemini failure: ${failed.error.code ?? failed.error.message}`,
      });
      return {
        ok: false,
        error:
          retryable && !hasAttemptsLeft
            ? new AnalysisError(
                "The AI service is temporarily busy. Please retry in a moment.",
                503,
                "gemini_transient_exhausted",
              )
            : failed.error,
        transientExhausted: retryable && !hasAttemptsLeft,
        retryAfterHeader: failed.retryAfterHeader,
      };
    }

    const waitMs = getRetryDelayMs(attempt, failed.retryAfterHeader, options.randomFn);
    logGeminiRetryDiagnostics({
      model,
      attempt,
      status: failed.error.statusCode,
      waitMs,
      elapsedMs,
      message: "Transient Gemini error; retrying.",
    });
    await (options.sleepFn ?? sleep)(waitMs);
  }

  return {
    ok: false,
    error:
      lastError ??
      new AnalysisError(
        "The AI service is temporarily busy. Please retry in a moment.",
        503,
        "gemini_transient_exhausted",
      ),
    transientExhausted: true,
    retryAfterHeader: null,
  };
}

async function requestGeminiModelOnce(
  text: string,
  model: string,
  apiKey: string,
  options: GeminiRequestOptions,
): Promise<
  | { ok: true; report: RawModelReport }
  | { ok: false; error: AnalysisError; retryAfterHeader: string | null }
> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.attemptTimeoutMs ?? GEMINI_ATTEMPT_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await (options.fetchFn ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(buildGeminiRequestBody(text)),
    });
  } catch (error) {
    const timedOut = isAbortError(error);
    return {
      ok: false,
      error: new AnalysisError(
        timedOut
          ? "Gemini request timed out. Please retry in a moment."
          : "Gemini request failed before a response was received.",
        timedOut ? 504 : 503,
        timedOut ? "gemini_timeout" : "gemini_network_error",
      ),
      retryAfterHeader: null,
    };
  } finally {
    clearTimeout(timeout);
  }

  const retryAfterHeader = response.headers.get("retry-after");
  const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

  if (!response.ok) {
    logGeminiDiagnostics(response.status, payload);
    const message = getGeminiErrorMessage(payload);
    return {
      ok: false,
      error: new AnalysisError(
        `Gemini request failed (${response.status}): ${message}`,
        response.status,
        `gemini_http_${response.status}`,
      ),
      retryAfterHeader,
    };
  }

  try {
    return { ok: true, report: parseGeminiPayload(payload, response.status) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof AnalysisError
          ? error
          : new AnalysisError("malformed_response: Gemini returned invalid JSON."),
      retryAfterHeader,
    };
  }
}

function buildGeminiRequestBody(text: string): Record<string, unknown> {
  return {
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
    };
}

function parseGeminiPayload(
  payload: GeminiGenerateContentResponse | null,
  status: number,
): RawModelReport {
  if (!payload) {
    logGeminiDiagnostics(status, payload);
    throw new AnalysisError("malformed_response: Gemini returned a non-JSON response.");
  }

  const content = extractGeminiText(payload);
  if (!content) {
    logGeminiDiagnostics(status, payload);
    const reason = classifyNoTextGeminiResponse(payload);
    throw new AnalysisError(`${reason}: Gemini did not return a usable text response.`);
  }

  try {
    const parsed = JSON.parse(content) as RawModelReport;
    if (!isRawModelReport(parsed)) {
      logGeminiDiagnostics(status, payload);
      throw new AnalysisError("malformed_response: Gemini returned JSON with an unexpected shape.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    logGeminiDiagnostics(status, payload);
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

function logGeminiRetryDiagnostics({
  model,
  attempt,
  status,
  waitMs,
  elapsedMs,
  message,
}: {
  model: string;
  attempt: number;
  status: number | null;
  waitMs: number;
  elapsedMs: number;
  message: string;
}): void {
  if (process.env.GEMINI_DEBUG !== "true") return;
  console.info("Gemini retry diagnostic", {
    model,
    attempt,
    status,
    waitMs,
    elapsedMs,
    message,
  });
}

function isTransientStatus(status: number): boolean {
  return TRANSIENT_GEMINI_STATUSES.has(status);
}

function getRetryDelayMs(
  attempt: number,
  retryAfterHeader: string | null,
  randomFn: (() => number) | undefined,
): number {
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
  const baseMs = retryAfterMs ?? GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? 4000;
  const random = randomFn ?? Math.random;
  const jitterMultiplier = 0.8 + random() * 0.4;
  return Math.max(0, Math.round(baseMs * jitterMultiplier));
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(0, dateMs - Date.now());
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
