import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, ChevronDown, FastForward, Loader2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { processingSteps } from "@/lib/mock-data";
import { analyzeText } from "@/lib/preliminary-analysis";
import {
  LATEST_REPORT_KEY,
  PENDING_INPUT_KEY,
  PENDING_TRAFFIC_GENERATION_METADATA_KEY,
  PENDING_VERIFICATION_MODE_KEY,
  isPhaseOneReport,
  type PhaseOneReport,
  type TrafficGenerationMetadata,
  type VerificationDiagnostics,
  type VerificationMode,
} from "@/lib/report-contract";
import {
  getProcessingErrorMessage,
  saveReportAndScheduleNavigationOnce,
} from "@/lib/processing-flow";
import { formatHongKongTime } from "@/lib/live-sources";
import { getModeLabel, normalizeVerificationMode } from "@/lib/verification-mode";

export const Route = createFileRoute("/_app/processing")({
  head: () => ({
    meta: [
      { title: "Analyzing — VeriHK" },
      {
        name: "description",
        content: "VeriHK is extracting claims and searching official Hong Kong sources.",
      },
    ],
  }),
  component: ProcessingPage,
});

const STEP_MS = 950;
const TICK_MS = 60;

function ProcessingPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [busyRetrying, setBusyRetrying] = useState(false);
  const [selectedMode, setSelectedMode] = useState<VerificationMode>("auto");
  const [latestReport, setLatestReport] = useState<PhaseOneReport | null>(null);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  const viewDemoReport = useCallback(() => {
    window.sessionStorage.removeItem(LATEST_REPORT_KEY);
    navigate({ to: "/results" });
  }, [navigate]);

  const runAnalysis = useCallback(async () => {
    const text = window.sessionStorage.getItem(PENDING_INPUT_KEY)?.trim();
    const mode = normalizeVerificationMode(window.sessionStorage.getItem(PENDING_VERIFICATION_MODE_KEY));
    const trafficGenerationMetadata = readTrafficGenerationMetadata();
    setSelectedMode(mode);

    if (!text) {
      setError("No submitted text was found. Please return to Verify and enter text first.");
      setProgress(0);
      setActive(0);
      setLatestReport(null);
      return;
    }

    setError("");
    setBusyRetrying(false);
    setProgress(8);
    setActive(0);
    setLatestReport(null);
    completedRef.current = false;

    const stepInt = window.setInterval(() => {
      setActive((s) => {
        const lastStep = processingSteps.length - 1;
        return s >= lastStep ? lastStep : s + 1;
      });
    }, STEP_MS);

    const progInt = window.setInterval(() => {
      setProgress((p) => Math.min(p + 0.7, 94));
    }, TICK_MS);
    const busyRetryTimer = window.setTimeout(() => {
      setBusyRetrying(true);
    }, 1400);

    try {
      const report = await analyzeText({ data: { text, mode, trafficGenerationMetadata } });
      if (!isPhaseOneReport(report)) {
        throw new Error("The server returned an unexpected analysis format.");
      }

      setLatestReport(report);
      const saved = saveReportAndScheduleNavigationOnce({
        report,
        completedRef,
        storage: window.sessionStorage,
        historyStorage: window.localStorage,
        navigateToResults: () => navigate({ to: "/results" }),
        setTimeoutFn: window.setTimeout,
      });
      if (!saved) return;
      setActive(processingSteps.length);
      setProgress(100);
    } catch (err) {
      const message = getProcessingErrorMessage(err);
      setError(message);
      setBusyRetrying(false);
      setProgress((p) => Math.min(p, 94));
    } finally {
      window.clearInterval(stepInt);
      window.clearInterval(progInt);
      window.clearTimeout(busyRetryTimer);
    }
  }, [navigate]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runAnalysis();
  }, [runAnalysis]);

  return (
    <div className="premium-container grid min-h-[calc(100vh-4rem)] place-items-center py-10">
      <Card className="w-full max-w-3xl border-0 bg-transparent p-0 shadow-none">
        <div className="mb-8 text-center">
          <div
            className={`mx-auto grid h-12 w-12 place-items-center rounded-xl text-white ${
              error ? "bg-destructive" : "bg-foreground"
            }`}
          >
            {error ? (
              <AlertCircle className="h-6 w-6" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin" />
            )}
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-normal md:text-4xl">
            {error ? "Analysis could not finish" : "Building the evidence network"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error
              ? "You can retry the preliminary AI analysis or view the original demo report."
              : busyRetrying
                ? "The AI service is busy. Retrying securely..."
                : "Extracting claims, querying official sources, and preparing an explainable report."}
          </p>
        </div>

        <Progress value={progress} className="h-2 rounded-full" />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span>
            {Math.min(active + 1, processingSteps.length)} of {processingSteps.length}
          </span>
        </div>

        <ol className="relative mt-10 space-y-0 pl-8 before:absolute before:left-[17px] before:top-3 before:h-[calc(100%-24px)] before:w-px before:bg-[rgb(8_23_45_/_12%)]">
          {processingSteps.map((s, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <motion.li
                key={s.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative flex items-start gap-4 border-b border-[rgb(8_23_45_/_10%)] py-5 last:border-b-0"
              >
                <div
                  className={`z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full border bg-background ${
                    done
                      ? "border-success text-success"
                      : current
                        ? "border-[#0878f9] text-[#0878f9]"
                        : "border-[rgb(8_23_45_/_18%)] text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-3 w-3" />
                  ) : current ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {done ? "Completed" : current ? s.detail : "Queued"}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>

        <LiveSourceActivity
          active={active}
          completed={Boolean(latestReport)}
          error={Boolean(error)}
          mode={selectedMode}
          report={latestReport}
          diagnostics={latestReport?.diagnostics}
        />

        {error && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <button
                type="button"
                onClick={runAnalysis}
                className="inline-flex items-center gap-2 text-base font-bold text-foreground transition-colors hover:text-primary"
              >
                <RotateCcw className="h-4 w-4" />
                Retry
              </button>
              <button
                type="button"
                onClick={viewDemoReport}
                className="inline-flex items-center gap-2 text-base font-bold text-foreground transition-colors hover:text-primary"
              >
                <FastForward className="h-4 w-4" />
                View Demo Report
              </button>
            </div>

          </div>
        )}

        {import.meta.env.DEV && !error && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={viewDemoReport}
              className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              <FastForward className="h-3.5 w-3.5" />
              Skip to demo result
            </button>
          </div>

        )}
      </Card>
    </div>
  );
}

function readTrafficGenerationMetadata(): TrafficGenerationMetadata | undefined {
  const raw = window.sessionStorage.getItem(PENDING_TRAFFIC_GENERATION_METADATA_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<TrafficGenerationMetadata>;
    if (
      typeof parsed.sourceRecordId === "string" &&
      typeof parsed.generatedClaimKind === "string" &&
      typeof parsed.generatedSemanticField === "string" &&
      typeof parsed.generatedAt === "string"
    ) {
      return {
        sourceRecordId: parsed.sourceRecordId,
        sourceOfficialUpdatedAt:
          typeof parsed.sourceOfficialUpdatedAt === "string"
            ? parsed.sourceOfficialUpdatedAt
            : undefined,
        sourceCurrentStatus:
          typeof parsed.sourceCurrentStatus === "string" ? parsed.sourceCurrentStatus : undefined,
        generatedClaimKind:
          parsed.generatedClaimKind === "refuted" ? "refuted" : "supported",
        generatedSemanticField: parsed.generatedSemanticField,
        generatedAt: parsed.generatedAt,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function LiveSourceActivity({
  active,
  completed,
  error,
  mode,
  report,
  diagnostics,
}: {
  active: number;
  completed: boolean;
  error: boolean;
  mode: VerificationMode;
  report: PhaseOneReport | null;
  diagnostics?: VerificationDiagnostics;
}) {
  const activity = [
    "Claim analysed",
    "Verification mode selected",
    "Official sources connected",
    "Live records retrieved",
    "Evidence matched",
    "Verification completed",
  ];
  const completedItems = error ? Math.min(active + 1, 3) : completed ? activity.length : Math.min(active + 1, activity.length - 1);

  return (
    <section className="mt-8 rounded-[1.75rem] border bg-background/70 p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Live Source Activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            VeriHK is explaining which official-source steps are happening behind the report.
          </p>
        </div>
        <div className="text-xs font-medium text-muted-foreground">
          Mode: {getModeLabel(mode)}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {activity.map((label, index) => {
          const done = index < completedItems;
          const current = index === completedItems && !completed && !error;
          return (
            <div
              key={label}
              className="flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm"
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                  done
                    ? "border-success text-success"
                    : current
                      ? "border-foreground text-foreground"
                      : "border-border text-muted-foreground"
                }`}
                aria-hidden="true"
              >
                {done ? <Check className="h-3 w-3" /> : current ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <span className={done || current ? "text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {mode === "traffic" && <TrafficSummary diagnostics={diagnostics} />}
      {mode === "weather" && <WeatherSummary report={report} diagnostics={diagnostics} />}
      {shouldShowDeveloperDetails() && <DeveloperDetails diagnostics={diagnostics} mode={mode} />}
    </section>
  );
}

function TrafficSummary({ diagnostics }: { diagnostics?: VerificationDiagnostics }) {
  return (
    <div className="mt-4 rounded-2xl border bg-muted/35 p-4">
      <h3 className="text-sm font-semibold">Current Official Traffic Feed</h3>
      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
        <SummaryDatum label="Latest official update" value={formatOptionalTime(diagnostics?.officialUpdatedAt)} />
        <SummaryDatum label="Records retrieved" value={formatNumber(diagnostics?.recordsRetrieved)} />
        <SummaryDatum label="Relevant evidence" value={formatNumber(diagnostics?.relevantEvidence)} />
      </div>
    </div>
  );
}

function WeatherSummary({
  diagnostics,
  report,
}: {
  diagnostics?: VerificationDiagnostics;
  report: PhaseOneReport | null;
}) {
  const summary = getWeatherSummary(report);
  return (
    <div className="mt-4 rounded-2xl border bg-muted/35 p-4">
      <h3 className="text-sm font-semibold">Current HKO Status</h3>
      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-4">
        <SummaryDatum label="Temperature" value={summary.temperature} />
        <SummaryDatum label="Humidity" value={summary.humidity} />
        <SummaryDatum label="Warnings" value={summary.warnings} />
        <SummaryDatum
          label="Observation time"
          value={summary.observationTime ?? formatOptionalTime(diagnostics?.officialUpdatedAt)}
        />
      </div>
    </div>
  );
}

function DeveloperDetails({
  diagnostics,
  mode,
}: {
  diagnostics?: VerificationDiagnostics;
  mode: VerificationMode;
}) {
  const sourceRoute = diagnostics?.routedSource === "TD" ? "Transport Department" : "Hong Kong Observatory";

  return (
    <details className="group mt-4 rounded-2xl border bg-background/70 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Developer Details
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <DeveloperDatum label="Source Route" value={sourceRoute} />
        <DeveloperDatum label="Endpoint" value={diagnostics?.endpointLabel ?? "Waiting for response"} />
        <DeveloperDatum label="Records Retrieved" value={formatNumber(diagnostics?.recordsRetrieved)} />
        <DeveloperDatum label="Relevant Evidence" value={formatNumber(diagnostics?.relevantEvidence)} />
        <DeveloperDatum label="Matcher Result" value={formatMatchingStatus(diagnostics?.matchingStatus)} />
        <DeveloperDatum label="Deterministic Result" value={formatVerdict(diagnostics?.deterministicResult)} />
        <DeveloperDatum label="LLM Adjudicator" value={diagnostics?.adjudicatorCalled ? "Called" : "Skipped"} />
        <DeveloperDatum label="Freshness" value={formatFreshness(diagnostics?.freshness)} />
        <DeveloperDatum label="Official Update" value={formatOptionalTime(diagnostics?.officialUpdatedAt)} />
        <DeveloperDatum label="Selected Mode" value={getModeLabel(mode)} />
      </dl>
    </details>
  );
}

function SummaryDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-medium text-foreground">{value}</div>
      <div className="mt-1 text-muted-foreground">{label}</div>
    </div>
  );
}

function DeveloperDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function shouldShowDeveloperDetails(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_SHOW_DEVELOPER_DETAILS === "true";
}

function formatNumber(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "Waiting";
}

function formatOptionalTime(value: string | undefined): string {
  return value ? formatHongKongTime(value) : "Not stated";
}

function formatMatchingStatus(value: VerificationDiagnostics["matchingStatus"] | undefined): string {
  if (value === "matched") return "Matched";
  if (value === "no_match") return "No match";
  return "Waiting";
}

function formatVerdict(value: VerificationDiagnostics["deterministicResult"] | undefined): string {
  if (value === "supported") return "Supported";
  if (value === "refuted") return "Refuted";
  if (value === "insufficient_evidence") return "Insufficient evidence";
  return "Waiting";
}

function formatFreshness(value: VerificationDiagnostics["freshness"] | undefined): string {
  if (value === "fresh") return "Fresh";
  if (value === "stale") return "Stale";
  return "Waiting";
}

function getWeatherSummary(report: PhaseOneReport | null): {
  temperature: string;
  humidity: string;
  warnings: string;
  observationTime?: string;
} {
  if (!report) {
    return {
      temperature: "Waiting",
      humidity: "Waiting",
      warnings: "Waiting",
    };
  }

  const evidence = report.claims.flatMap((claim) => claim.evidence);
  const temperature = evidence.find(
    (item) => item.structured_facts?.metric === "temperature",
  )?.structured_facts;
  const humidity = evidence.find(
    (item) => item.structured_facts?.metric === "relative_humidity",
  )?.structured_facts;
  const warningSummary = evidence.find((item) => item.id === "hko-warnsum-current")
    ?.structured_facts;
  const warningFacts =
    warningSummary &&
    typeof warningSummary === "object" &&
    "facts" in warningSummary &&
    typeof warningSummary.facts === "object" &&
    warningSummary.facts !== null
      ? (warningSummary.facts as Record<string, unknown>)
      : null;
  const warningNames = Array.isArray(warningFacts?.active_warning_names)
    ? warningFacts.active_warning_names.filter((item): item is string => typeof item === "string")
    : [];
  const directWarnings = evidence.filter((item) => item.source_type === "hko_warning");
  const observationTime =
    getStructuredString(temperature?.observationTime) ??
    getStructuredString(humidity?.observationTime) ??
    report.source_freshness?.find((item) => item.source_key === "hko")?.updated_at ??
    undefined;

  return {
    temperature: formatStructuredMeasurement(temperature, "°C"),
    humidity: formatStructuredMeasurement(humidity, "%"),
    warnings: warningNames.length
      ? warningNames.join(", ")
      : directWarnings.length
        ? directWarnings.map((item) => item.title).join(", ")
        : "No matched warning evidence",
    observationTime: observationTime ? formatHongKongTime(observationTime) : undefined,
  };
}

function formatStructuredMeasurement(
  facts: Record<string, unknown> | undefined,
  unit: string,
): string {
  const observedValue = facts?.observedValue;
  return typeof observedValue === "number" ? `${observedValue}${unit}` : "Not in this claim";
}

function getStructuredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
