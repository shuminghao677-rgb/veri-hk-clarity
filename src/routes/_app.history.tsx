import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, XCircle, History as HistoryIcon, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { historyReports } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/history")({
  head: () => ({
    meta: [
      { title: "History — VeriHK" },
      { name: "description", content: "Your previous VeriHK verification reports." },
      { property: "og:title", content: "History — VeriHK" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <HistoryIcon className="h-3 w-3 text-primary" /> History
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Previous verifications
          </h1>
          <p className="mt-1 text-muted-foreground">
            A running log of every report — fully traceable and re-openable.
          </p>
        </div>
        <Button asChild className="rounded-full shadow-elegant">
          <Link to="/verify">
            New verification <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="relative pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border">
        {historyReports.map((r) => (
          <div key={r.id} className="relative mb-5">
            <span className="absolute -left-[26px] top-6 grid h-6 w-6 place-items-center rounded-full bg-background ring-2 ring-primary/40">
              <span className="h-2 w-2 rounded-full gradient-primary" />
            </span>
            <Card className="rounded-3xl border-border/60 p-5 shadow-soft transition hover:shadow-elegant">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {r.date}
                  </div>
                  <div className="mt-1 truncate text-base font-semibold">{r.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="rounded-full">
                      {r.claims} claims
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-success/30 bg-success/10 text-success gap-1">
                      <ShieldCheck className="h-3 w-3" /> {r.supported} supported
                    </Badge>
                    {r.refuted > 0 && (
                      <Badge variant="outline" className="rounded-full border-destructive/30 bg-destructive/10 text-destructive gap-1">
                        <XCircle className="h-3 w-3" /> {r.refuted} refuted
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ConfidenceRing value={r.confidence} />
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/results">View report</Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke="var(--muted)" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke="var(--primary)"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-[11px] font-semibold">{value}%</div>
    </div>
  );
}
