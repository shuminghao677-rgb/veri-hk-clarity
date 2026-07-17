import { describe, it } from "vitest";
import {
  getProcessingErrorMessage,
  saveReportAndScheduleNavigationOnce,
} from "./processing-flow";
import {
  LATEST_REPORT_KEY,
  PENDING_INPUT_KEY,
  PENDING_TRAFFIC_GENERATION_METADATA_KEY,
  PENDING_VERIFICATION_MODE_KEY,
} from "./report-contract";
import { REPORT_HISTORY_KEY } from "./report-history";

export function runProcessingPageTests(): void {
  testBusyErrorMessage();
  testReportSavedAndNavigationScheduledOnce();
}

describe("processing flow", () => {
  it("saves one report and navigates once", () => {
    runProcessingPageTests();
  });
});

function testBusyErrorMessage(): void {
  assertEqual(
    getProcessingErrorMessage(new Error("The AI service is temporarily busy. Please retry in a moment.")),
    "The AI service is temporarily busy. Please retry in a moment.",
    "transient Gemini failure uses friendly final message",
  );
}

function testReportSavedAndNavigationScheduledOnce(): void {
  const completedRef = { current: false };
  const storage = createMemoryStorage();
  const historyStorage = createMemoryStorage();
  let navigations = 0;
  const timers: Array<() => void> = [];
  const report = createReport("report-1");

  const first = saveReportAndScheduleNavigationOnce({
    report,
    completedRef,
    storage,
    historyStorage,
    navigateToResults: () => {
      navigations += 1;
    },
    setTimeoutFn: (handler) => {
      timers.push(handler);
      return 1;
    },
  });
  const second = saveReportAndScheduleNavigationOnce({
    report: createReport("report-2"),
    completedRef,
    storage,
    historyStorage,
    navigateToResults: () => {
      navigations += 1;
    },
    setTimeoutFn: (handler) => {
      timers.push(handler);
      return 2;
    },
  });

  assertEqual(first, true, "first valid response is saved");
  assertEqual(second, false, "second valid response is ignored");
  assertEqual(storage.values.get(LATEST_REPORT_KEY), JSON.stringify(report), "latest report is saved once");
  const history = JSON.parse(historyStorage.values.get(REPORT_HISTORY_KEY) ?? "[]") as unknown[];
  assertEqual(history.length, 1, "latest report is added to history once");
  assertEqual(storage.values.has(PENDING_INPUT_KEY), false, "pending input is cleared");
  assertEqual(storage.values.has(PENDING_VERIFICATION_MODE_KEY), false, "pending mode is cleared");
  assertEqual(
    storage.values.has(PENDING_TRAFFIC_GENERATION_METADATA_KEY),
    false,
    "pending traffic generation metadata is cleared",
  );
  assertEqual(timers.length, 1, "navigation is scheduled once");
  timers.forEach((timer) => timer());
  assertEqual(navigations, 1, "navigation occurs once");
}

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>([
    [PENDING_INPUT_KEY, "pending text"],
    [PENDING_VERIFICATION_MODE_KEY, "traffic"],
    [PENDING_TRAFFIC_GENERATION_METADATA_KEY, "{}"],
  ]);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function createReport(reportId: string) {
  return {
    report_id: reportId,
    analysis_type: "preliminary_ai_analysis",
    input_content: "The Hong Kong Observatory has issued a Black Rainstorm Warning.",
    checked_at: "2026-07-16T08:00:00.000Z",
    overall_confidence: 0.8,
    evidence_coverage: "low",
    claims: [
      {
        id: "claim-1",
        text: "The Hong Kong Observatory has issued a Black Rainstorm Warning.",
        verdict: "refuted",
        confidence: 0.8,
        explanation: "The latest warning summary does not include an active Black Rainstorm Warning.",
        recommendation: "Continue monitoring official updates.",
        evidence: [],
      },
    ],
  };
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}
