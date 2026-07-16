import { LATEST_REPORT_KEY, PENDING_INPUT_KEY } from "./report-contract";

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
  navigateToResults,
  setTimeoutFn,
}: {
  report: unknown;
  completedRef: { current: boolean };
  storage: Pick<Storage, "setItem" | "removeItem">;
  navigateToResults: () => void;
  setTimeoutFn: (handler: () => void, timeout: number) => unknown;
}): boolean {
  if (completedRef.current) return false;
  completedRef.current = true;
  storage.setItem(LATEST_REPORT_KEY, JSON.stringify(report));
  storage.removeItem(PENDING_INPUT_KEY);
  setTimeoutFn(() => {
    if (completedRef.current) navigateToResults();
  }, 400);
  return true;
}
