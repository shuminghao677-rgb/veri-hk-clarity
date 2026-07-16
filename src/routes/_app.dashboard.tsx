import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, FileCheck2, Gauge, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { historyReports } from "@/lib/mock-data";


export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — VeriHK" },
      { name: "description", content: "A calm overview of VeriHK verification activity." },
      { property: "og:title", content: "Dashboard — VeriHK" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="premium-container py-10 md:py-16">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-foreground" />
            Competition prototype
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
            Verification operations, without the noise.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            A clean command center for recent reports, official-source coverage, and claim outcomes.
          </p>
        </div>
        <Link
          to="/verify"
          className="text-base font-bold text-foreground transition-colors hover:text-primary"
        >
          New verification
        </Link>

      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-4">
        <Metric icon={FileCheck2} label="Reports" value="5" />
        <Metric icon={ShieldCheck} label="Supported" value="12" />
        <Metric icon={XCircle} label="Refuted" value="4" />
        <Metric icon={Gauge} label="Avg. confidence" value="76%" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="panel rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-normal">Recent verifications</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Reports opened from History currently use demo metadata.
              </p>
            </div>
            <Link
              to="/history"
              className="text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              View all
            </Link>

          </div>
          <div className="divide-y">
            {historyReports.slice(0, 4).map((report) => (
              <Link
                key={report.id}
                to="/results"
                className="flex flex-wrap items-center justify-between gap-4 py-4 transition-colors hover:text-primary"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {report.date}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold">{report.title}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full">
                    {report.claims} claims
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {report.confidence}% confidence
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="panel rounded-[2rem] p-6">
          <h2 className="text-xl font-semibold tracking-normal">Evidence posture</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            VeriHK is optimized for live official-source retrieval: current HKO warnings, Transport
            Department incidents, public transport disruptions, and selected RSS notices.
          </p>
          <div className="mt-8 space-y-4">
            {["Hong Kong Observatory", "Transport Department", "GovHK", "Education Bureau future"].map(
              (source, index) => (
                <div key={source}>
                  <div className="flex justify-between text-sm">
                    <span>{source}</span>
                    <span className="text-muted-foreground">{index === 3 ? "planned" : "live"}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${index === 3 ? 38 : 82 - index * 8}%` }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileCheck2; label: string; value: string }) {
  return (
    <Card className="panel rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-6 text-3xl font-semibold tracking-normal">{value}</div>
    </Card>
  );
}
