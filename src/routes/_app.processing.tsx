import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, FastForward } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { processingSteps } from "@/lib/mock-data";

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

// Total wall time ≈ 6 steps × 950ms = 5.7s
const STEP_MS = 950;
const TICK_MS = 60;

function ProcessingPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const totalMs = processingSteps.length * STEP_MS;

    const stepInt = setInterval(() => {
      setActive((s) => {
        const next = s + 1;
        if (next >= processingSteps.length) {
          clearInterval(stepInt);
          setTimeout(() => navigate({ to: "/results" }), 600);
        }
        return next;
      });
    }, STEP_MS);

    const progInt = setInterval(() => {
      setProgress((p) => Math.min(p + (100 * TICK_MS) / totalMs, 100));
    }, TICK_MS);

    return () => {
      clearInterval(stepInt);
      clearInterval(progInt);
    };
  }, [navigate]);

  const skip = () => navigate({ to: "/results" });

  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-4 py-10">
      <Card className="glass w-full max-w-2xl rounded-3xl p-8 shadow-elegant md:p-12">
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white shadow-elegant">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl">
            Analyzing your content
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cross-checking against timely official Hong Kong sources.
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

        {import.meta.env.DEV && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={skip}
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
