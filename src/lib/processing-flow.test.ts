import {
  getProcessingErrorMessage,
  saveReportAndScheduleNavigationOnce,
} from "./processing-flow";
import { LATEST_REPORT_KEY, PENDING_INPUT_KEY } from "./report-contract";

export function runProcessingPageTests(): void {
  testBusyErrorMessage();
  testReportSavedAndNavigationScheduledOnce();
}

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
  let navigations = 0;
  const timers: Array<() => void> = [];
  const report = { report_id: "report-1", claims: [] };

  const first = saveReportAndScheduleNavigationOnce({
    report,
    completedRef,
    storage,
    navigateToResults: () => {
      navigations += 1;
    },
    setTimeoutFn: (handler) => {
      timers.push(handler);
      return 1;
    },
  });
  const second = saveReportAndScheduleNavigationOnce({
    report: { report_id: "report-2", claims: [] },
    completedRef,
    storage,
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
  assertEqual(storage.values.has(PENDING_INPUT_KEY), false, "pending input is cleared");
  assertEqual(timers.length, 1, "navigation is scheduled once");
  timers.forEach((timer) => timer());
  assertEqual(navigations, 1, "navigation occurs once");
}

function createMemoryStorage(): Pick<Storage, "setItem" | "removeItem"> & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>([[PENDING_INPUT_KEY, "pending text"]]);
  return {
    values,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}
