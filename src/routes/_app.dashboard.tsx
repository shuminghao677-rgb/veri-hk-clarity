import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ScanSearch,
  ShieldCheck,
  XCircle,
  Gauge,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  distributionData,
  sourceUsageData,
  historyReports,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — VeriHK" },
      { name: "description", content: "Verification activity overview and quick access to VeriHK tools." },
      { property: "og:title", content: "Dashboard — VeriHK" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Overview
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome back
          </h1>
          <p className="mt-1 text-muted-foreground">
            Here's your verification activity across official Hong Kong sources.
          </p>
        </div>
        <Button asChild className="rounded-full shadow-elegant">
          <Link to="/verify">New verification</Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi icon={ScanSearch} label="Verifications" value="24" trend="+18%" />
        <Kpi icon={ShieldCheck} label="Claims supported" value="46" trend="+9%" />
        <Kpi icon={XCircle} label="Claims refuted" value="8" trend="-3%" />
        <Kpi icon={Gauge} label="Avg. truth score" value="79%" trend="+1.2%" />
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="rounded-3xl border-border/60 p-6">
          <div className="text-sm font-semibold">Verification distribution</div>
          <div className="text-xs text-muted-foreground">This week</div>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="none"
                >
                  {distributionData.map((d, idx) => (
                    <Cell key={idx} fill={d.color} />
                  ))}
                </Pie>
                <RTooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            {distributionData.map((d) => (
              <span key={d.name} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
            ))}
          </div>
        </Card>

        <Card className="rounded-3xl border-border/60 p-6">
          <div className="text-sm font-semibold">Evidence sources</div>
          <div className="text-xs text-muted-foreground">Most used across your reports</div>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceUsageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="source" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <RTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Recent activity</h2>
          <Button asChild variant="ghost" className="text-primary">
            <Link to="/history">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <Card className="rounded-3xl border-border/60 divide-y">
          {historyReports.slice(0, 4).map((r) => (
            <Link
              key={r.id}
              to="/results"
              className="flex flex-wrap items-center justify-between gap-3 p-5 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {r.date}
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">{r.title}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {r.claims} claims
                </Badge>
                <Badge variant="outline" className="rounded-full border-success/30 bg-success/10 text-success">
                  {r.confidence}% conf.
                </Badge>
              </div>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
} as const;

function Kpi({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: typeof ScanSearch;
  label: string;
  value: string;
  trend: string;
}) {
  const up = trend.startsWith("+");
  return (
    <Card className="rounded-3xl border-border/60 p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <span
          className={`text-[11px] font-medium ${
            up ? "text-success" : "text-destructive"
          }`}
        >
          {trend}
        </span>
      </div>
    </Card>
  );
}
