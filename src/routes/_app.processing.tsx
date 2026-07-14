import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ScanText,
  Brain,
  ListChecks,
  Search,
  ShieldCheck,
  FileSignature,
  Check,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/processing")({
  head: () => ({
    meta: [
      { title: "Analyzing — VeriHK" },
      { name: "description", content: "VeriHK is extracting claims and searching official Hong Kong sources." },
    ],
  }),
  component: ProcessingPage,
});

const steps = [
  { icon: ScanText, label: "Extracting information" },
  { icon: Brain, label: "Understanding content" },
  { icon: ListChecks, label: "Extracting factual claims" },
  { icon: Search, label: "Searching official evidence" },
  { icon: ShieldCheck, label: "Verifying claims" },
  { icon: FileSignature, label: "Generating explainable report" },
];

function ProcessingPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepMs = 1600;
    const interval = setInterval(() => {
      setActive((s) => {
        if (s + 1 >= steps.length) {
          clearInterval(interval);
          setProgress(100);
          setTimeout(() => navigate({ to: "/results" }), 700);
          return s + 1;
        }
        return s + 1;
      });
    }, stepMs);

    const progInt = setInterval(() => {
      setProgress((p) => Math.min(p + 100 / ((steps.length * stepMs) / 100), 100));
    }, 100);

    return () => {
      clearInterval(interval);
      clearInterval(progInt);
    };
  }, [navigate]);

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
            Estimated 8–15 seconds · cross-checking official Hong Kong sources
          </p>
        </div>

        <Progress value={progress} className="h-2 rounded-full" />
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span>{Math.min(active + 1, steps.length)} of {steps.length}</span>
        </div>

        <ol className="mt-8 space-y-3">
          {steps.map((s, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <motion.li
                key={s.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
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
                    <s.icon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {done ? "Completed" : current ? "In progress..." : "Queued"}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
