import { AnalysisError, requestPreliminaryAnalysisForTest } from "./preliminary-analysis";

export async function runPreliminaryAnalysisTests(): Promise<void> {
  await test503ThenSuccess();
  await test429ThenSuccess();
  await testRepeated503EndsInHandledError();
  await test400IsNotRetried();
  await testRetryAfterIsRespected();
  await testTimeoutIsHandled();
}

async function test503ThenSuccess(): Promise<void> {
  const calls: string[] = [];
  const waits: number[] = [];
  const report = await withGeminiEnv(() =>
    requestPreliminaryAnalysisForTest("Hong Kong Observatory issued a warning.", {
      fetchFn: sequenceFetch([
        response(503, { error: { message: "UNAVAILABLE" } }),
        response(200, geminiSuccessPayload()),
      ], calls),
      sleepFn: async (ms) => {
        waits.push(ms);
      },
      randomFn: () => 0.5,
    }),
  );

  assertEqual(calls.length, 2, "503 is retried once before success");
  assertEqual(waits[0], 1000, "first retry waits about 1 second without jitter change");
  assertEqual(Array.isArray(report.claims), true, "valid Gemini response is returned");
}

async function test429ThenSuccess(): Promise<void> {
  const calls: string[] = [];
  await withGeminiEnv(() =>
    requestPreliminaryAnalysisForTest("MTR service is disrupted.", {
      fetchFn: sequenceFetch([
        response(429, { error: { message: "RATE_LIMIT" } }),
        response(200, geminiSuccessPayload()),
      ], calls),
      sleepFn: async () => undefined,
      randomFn: () => 0.5,
    }),
  );

  assertEqual(calls.length, 2, "429 is retried before success");
}

async function testRepeated503EndsInHandledError(): Promise<void> {
  const calls: string[] = [];
  const waits: number[] = [];

  await assertRejects(
    () =>
      withGeminiEnv(() =>
        requestPreliminaryAnalysisForTest("The AI service is busy.", {
          fetchFn: sequenceFetch(
            [
              response(503, { error: { message: "UNAVAILABLE" } }),
              response(503, { error: { message: "UNAVAILABLE" } }),
              response(503, { error: { message: "UNAVAILABLE" } }),
              response(503, { error: { message: "UNAVAILABLE" } }),
            ],
            calls,
          ),
          sleepFn: async (ms) => {
            waits.push(ms);
          },
          randomFn: () => 0.5,
        }),
      ),
    "The AI service is temporarily busy. Please retry in a moment.",
    "four 503 responses end in handled busy error",
  );

  assertEqual(calls.length, 4, "503 is attempted at most four times");
  assertEqual(waits.join(","), "1000,2000,4000", "503 uses 1s, 2s, 4s retry waits");
}

async function test400IsNotRetried(): Promise<void> {
  const calls: string[] = [];

  await assertRejects(
    () =>
      withGeminiEnv(() =>
        requestPreliminaryAnalysisForTest("Bad request.", {
          fetchFn: sequenceFetch([response(400, { error: { message: "Bad request" } })], calls),
          sleepFn: async () => undefined,
        }),
      ),
    "Gemini request failed (400): Bad request",
    "400 is not retried",
  );

  assertEqual(calls.length, 1, "400 has a single attempt");
}

async function testRetryAfterIsRespected(): Promise<void> {
  const waits: number[] = [];

  await withGeminiEnv(() =>
    requestPreliminaryAnalysisForTest("Retry after header.", {
      fetchFn: sequenceFetch([
        response(429, { error: { message: "RATE_LIMIT" } }, { "retry-after": "3" }),
        response(200, geminiSuccessPayload()),
      ]),
      sleepFn: async (ms) => {
        waits.push(ms);
      },
      randomFn: () => 0.5,
    }),
  );

  assertEqual(waits[0], 3000, "Retry-After seconds are respected");
}

async function testTimeoutIsHandled(): Promise<void> {
  await assertRejects(
    () =>
      withGeminiEnv(() =>
        requestPreliminaryAnalysisForTest("Timeout test.", {
          fetchFn: abortingFetch(),
          sleepFn: async () => undefined,
          attemptTimeoutMs: 1,
        }),
      ),
    "The AI service is temporarily busy. Please retry in a moment.",
    "timeouts become handled transient failures",
  );
}

function sequenceFetch(responses: Response[], calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const next = responses.shift();
    if (!next) throw new Error("No mock response configured");
    return next;
  }) as typeof fetch;
}

function abortingFetch(): typeof fetch {
  return ((_: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    })) as typeof fetch;
}

function response(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(headers ?? {}) },
  });
}

function geminiSuccessPayload() {
  return {
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            {
              text: JSON.stringify({
                overall_confidence: 0.7,
                claims: [
                  {
                    id: "claim-1",
                    text: "A factual claim.",
                    verdict: "insufficient_evidence",
                    confidence: 0.7,
                    explanation: "Preliminary analysis only.",
                    recommendation: "Check official sources.",
                    evidence: [],
                  },
                ],
              }),
            },
          ],
        },
      },
    ],
  };
}

async function withGeminiEnv<T>(callback: () => Promise<T>): Promise<T> {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.AI_MODEL;
  const originalFallback = process.env.AI_FALLBACK_MODEL;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.AI_MODEL = "test-model";
  delete process.env.AI_FALLBACK_MODEL;
  try {
    return await callback();
  } finally {
    restoreEnv("GEMINI_API_KEY", originalKey);
    restoreEnv("AI_MODEL", originalModel);
    restoreEnv("AI_FALLBACK_MODEL", originalFallback);
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function assertRejects(
  callback: () => Promise<unknown>,
  expectedMessage: string,
  message: string,
): Promise<void> {
  try {
    await callback();
  } catch (error) {
    if (error instanceof AnalysisError || error instanceof Error) {
      assertEqual(error.message, expectedMessage, message);
      return;
    }
    throw new Error(`${message}: unexpected rejection ${String(error)}`);
  }
  throw new Error(`${message}: expected rejection`);
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}
