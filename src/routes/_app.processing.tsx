import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, Loader2, FastForward, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { processingSteps } from "@/lib/mock-data";
import { analyzeText } from "@/lib/preliminary-analysis";
import { LATEST_REPORT_KEY, PENDING_INPUT_KEY, isPhaseOneReport } from "@/lib/report-contract";

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
  const startedRef = useRef(false);

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
    setProgress(8);
    setActive(0);

    const stepInt = window.setInterval(() => {
      setActive((s) => {
        const lastStep = processingSteps.length - 1;
        return s >= lastStep ? lastStep : s + 1;
      });
    }, STEP_MS);

    const progInt = window.setInterval(() => {
      setProgress((p) => Math.min(p + 0.7, 94));
    }, TICK_MS);

    try {
      const report = await analyzeText({ data: { text } });
      if (!isPhaseOneReport(report)) {
        throw new Error("The server returned an unexpected analysis format.");
      }

      window.sessionStorage.setItem(LATEST_REPORT_KEY, JSON.stringify(report));
      window.sessionStorage.removeItem(PENDING_INPUT_KEY);
      setActive(processingSteps.length);
      setProgress(100);
      window.setTimeout(() => navigate({ to: "/results" }), 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The analysis request failed.";
      setError(message);
      setProgress((p) => Math.min(p, 94));
    } finally {
      window.clearInterval(stepInt);
      window.clearInterval(progInt);
    }
  }, [navigate]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runAnalysis();
  }, [runAnalysis]);

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-10">
      <Card className="glass w-full max-w-2xl rounded-3xl p-8 shadow-elegant md:p-12">
        <div className="mb-8 text-center">
          <div
            className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-elegant ${
              error ? "bg-destructive" : "gradient-primary"
            }`}
          >
            {error ? (
              <AlertCircle className="h-6 w-6" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin" />
            )}
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl">
            {error ? "Analysis could not finish" : "Analyzing your content"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error
              ? "You can retry the preliminary AI analysis or view the original demo report."
              : "Generating preliminary AI analysis. Official source checking is not enabled yet."}
          </p>
        </div>

        <Progress value={progress} className="h-2 rounded-full" />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span>
            {Math.min(active + 1, processingSteps.length)} of {processingSteps.length}
          </span>
        </div>

        <ol className="mt-8 space-y-3">
          {processingSteps.map((s, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <motion.li
                key={s.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
                  current
                    ? "border-primary/40 bg-primary/5"
                    : done
                      ? "border-success/30 bg-success/5"
                      : "border-border/60 bg-background/40"
                }`}
              >
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    done
                      ? "bg-success text-success-foreground"
                      : current
                        ? "gradient-primary text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : current ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-[11px] font-semibold">{i + 1}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
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
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={runAnalysis} className="gap-2 rounded-full">
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
              <Button variant="outline" onClick={viewDemoReport} className="gap-2 rounded-full">
                <FastForward className="h-4 w-4" />
                View Demo Report
              </Button>
            </div>
          </div>
        )}

        {import.meta.env.DEV && !error && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={viewDemoReport}
              className="gap-2 rounded-full text-xs text-muted-foreground hover:text-foreground"
            >
              <FastForward className="h-3.5 w-3.5" />
              Skip to demo result
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
