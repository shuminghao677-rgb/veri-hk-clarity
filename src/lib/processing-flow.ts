import {
  LATEST_REPORT_KEY,
  PENDING_INPUT_KEY,
  PENDING_TRAFFIC_GENERATION_METADATA_KEY,
  PENDING_VERIFICATION_MODE_KEY,
} from "./report-contract";
import { addReportToHistory } from "./report-history";
import { isPhaseOneReport } from "./report-contract";

export function getProcessingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "The analysis request failed.";
  if (
    message.includes("gemini_transient_exhausted") ||
    message.includes("The AI service is temporarily busy") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return "The AI service is temporarily busy. Please retry in a moment.";
  }
  return message;
}

export function saveReportAndScheduleNavigationOnce({
  report,
  completedRef,
  storage,
  historyStorage,
  navigateToResults,
  setTimeoutFn,
}: {
  report: unknown;
  completedRef: { current: boolean };
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  historyStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  navigateToResults: () => void;
  setTimeoutFn: (handler: () => void, timeout: number) => unknown;
}): boolean {
  if (completedRef.current) return false;
  completedRef.current = true;
  storage.setItem(LATEST_REPORT_KEY, JSON.stringify(report));
  if (isPhaseOneReport(report)) {
    addReportToHistory(historyStorage ?? storage, report);
  }
  storage.removeItem(PENDING_INPUT_KEY);
  storage.removeItem(PENDING_VERIFICATION_MODE_KEY);
  storage.removeItem(PENDING_TRAFFIC_GENERATION_METADATA_KEY);
  setTimeoutFn(() => {
    if (completedRef.current) navigateToResults();
  }, 400);
  return true;
}
