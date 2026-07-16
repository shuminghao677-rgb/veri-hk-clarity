import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, Loader2, FastForward, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { processingSteps } from "@/lib/mock-data";
import { analyzeText } from "@/lib/preliminary-analysis";
import { LATEST_REPORT_KEY, PENDING_INPUT_KEY, isPhaseOneReport } from "@/lib/report-contract";
import {
  getProcessingErrorMessage,
  saveReportAndScheduleNavigationOnce,
} from "@/lib/processing-flow";

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
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  const viewDemoReport = useCallback(() => {
    window.sessionStorage.removeItem(LATEST_REPORT_KEY);
    navigate({ to: "/results" });
  }, [navigate]);

  const runAnalysis = useCallback(async () => {
    const text = window.sessionStorage.getItem(PENDING_INPUT_KEY)?.trim();

    if (!text) {
      setError("No submitted text was found. Please return to Verify and enter text first.");
      setProgress(0);
      setActive(0);
      return;
    }

    setError("");
    setBusyRetrying(false);
    setProgress(8);
    setActive(0);
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
      const report = await analyzeText({ data: { text } });
      if (!isPhaseOneReport(report)) {
        throw new Error("The server returned an unexpected analysis format.");
      }

      const saved = saveReportAndScheduleNavigationOnce({
        report,
        completedRef,
        storage: window.sessionStorage,
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
