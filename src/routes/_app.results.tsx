import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  XCircle,
  HelpCircle,
  ListChecks,
  Gauge,
  ExternalLink,
  Sparkles,
  
  FileText,
  Quote,
  Lightbulb,
  Check,
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
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  claims,
  evidence,
  suggestions,
  uploadedContent,
  distributionData,
  sourceUsageData,
  processTimelineData,
  type Claim,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_app/results")({
  head: () => ({
    meta: [
      { title: "Verification Report — VeriHK" },
      { name: "description", content: "Explainable verification report with official Hong Kong evidence." },
      { property: "og:title", content: "Verification Report — VeriHK" },
    ],
  }),
  component: Results,
});

const statusMeta: Record<
  Claim["status"],
  { label: string; className: string; icon: typeof ShieldCheck }
> = {
  supported: {
    label: "Supported",
    className: "bg-success/10 text-success border-success/20",
    icon: ShieldCheck,
  },
  refuted: {
    label: "Refuted",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XCircle,
  },
  insufficient: {
    label: "Need More Evidence",
    className: "bg-warning/10 text-warning-foreground border-warning/20",
    icon: HelpCircle,
  },
};

function Results() {
  const evidenceById = Object.fromEntries(evidence.map((e) => [e.id, e]));
  const supported = claims.filter((c) => c.status === "supported").length;
  const refuted = claims.filter((c) => c.status === "refuted").length;
  const insufficient = claims.filter((c) => c.status === "insufficient").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> Report · Just now
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Verification Report
          </h1>
          <p className="mt-1 text-muted-foreground">
            4 factual claims extracted · cross-checked against 5 official sources.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/history">View History</Link>
          </Button>
          <Button asChild className="rounded-full shadow-elegant">
            <Link to="/verify">New verification</Link>
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard icon={ListChecks} label="Total Claims" value={String(claims.length)} tone="primary" />
        <StatCard icon={ShieldCheck} label="Supported" value={String(supported)} tone="success" />
        <StatCard icon={XCircle} label="Refuted" value={String(refuted)} tone="destructive" />
        <StatCard icon={HelpCircle} label="Need Evidence" value={String(insufficient)} tone="warning" />
        <StatCard icon={Gauge} label="Overall Confidence" value="51%" tone="primary" />
      </div>

      {/* Uploaded content */}
      <Card className="mt-8 rounded-3xl border-border/60 p-6 md:p-8">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <FileText className="h-4 w-4" /> UPLOADED CONTENT
        </div>
        <p className="text-pretty text-base leading-relaxed">{uploadedContent}</p>
      </Card>

      {/* Two-column: claims & charts */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Claims list */}
        <div className="space-y-5">
          <SectionTitle>Extracted Claims</SectionTitle>
          {claims.map((claim, i) => {
            const meta = statusMeta[claim.status];
            const Icon = meta.icon;
            return (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="rounded-3xl border-border/60 p-6 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Claim {i + 1}
                      </div>
                      <div className="mt-1 text-lg font-semibold leading-snug">{claim.text}</div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 gap-1.5 rounded-full ${meta.className}`}>
                      <Icon className="h-3.5 w-3.5" /> {meta.label}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Confidence</span>
                      <span className="font-semibold text-foreground">{claim.confidence}%</span>
                    </div>
                    <Progress value={claim.confidence} className="h-1.5 rounded-full" />
                  </div>

                  {/* Evidence chips */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {claim.evidenceIds.map((eid) => {
                      const ev = evidenceById[eid];
                      return (
                        <span
                          key={eid}
                          className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px]"
                        >
                          <span className="grid h-4 w-4 place-items-center rounded-md gradient-primary text-[9px] font-bold text-white">
                            {ev.logo}
                          </span>
                          {ev.source}
                        </span>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="space-y-5">
          <SectionTitle>Insights</SectionTitle>
          <Card className="rounded-3xl border-border/60 p-6">
            <div className="mb-1 text-sm font-semibold">Verification distribution</div>
            <div className="text-xs text-muted-foreground">By claim status</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {distributionData.map((d, idx) => (
                      <Cell key={idx} fill={d.color} />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
              {distributionData.map((d) => (
                <span key={d.name} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name} · {d.value}
                </span>
              ))}
            </div>
          </Card>

          <Card className="rounded-3xl border-border/60 p-6">
            <div className="mb-1 text-sm font-semibold">Evidence sources used</div>
            <div className="text-xs text-muted-foreground">Across recent verifications</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceUsageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <RTooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-3xl border-border/60 p-6">
            <div className="mb-1 text-sm font-semibold">Verification process</div>
            <div className="text-xs text-muted-foreground">Time per step (ms)</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={processTimelineData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="step" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <RTooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ms"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#grad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* Evidence */}
      <div className="mt-12">
        <SectionTitle>Official Evidence</SectionTitle>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {evidence.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="flex h-full flex-col rounded-3xl border-border/60 p-6 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-primary text-sm font-bold text-white">
                      {e.logo}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{e.source}</div>
                      <div className="text-[11px] text-muted-foreground">{e.sourceType}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 gap-1 rounded-full border-success/30 bg-success/10 text-success">
                    <ShieldCheck className="h-3 w-3" /> Official
                  </Badge>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-foreground/90">{e.summary}</p>

                <div className="mt-4 rounded-2xl border-l-2 border-primary/40 bg-muted/40 p-3 pl-4">
                  <Quote className="mb-1 h-3 w-3 text-primary" />
                  <p className="text-xs italic leading-relaxed text-muted-foreground">
                    {e.citation}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[11px] text-muted-foreground">
                  <div>
                    <div>Published: {e.publishedAt}</div>
                    <div>Updated: {e.updatedAt}</div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <a href={e.url} target="_blank" rel="noreferrer">
                      Source <ExternalLink className="ml-1.5 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reasoning */}
      <div className="mt-12">
        <SectionTitle>AI Reasoning</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Step-by-step explanation of how each claim was verified.
        </p>
        <div className="mt-6 space-y-6">
          {claims.map((claim) => (
            <Card key={claim.id} className="rounded-3xl border-border/60 p-6 md:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`rounded-full ${statusMeta[claim.status].className}`}>
                  {statusMeta[claim.status].label}
                </Badge>
                <div className="text-sm font-semibold">{claim.text}</div>
              </div>
              <ol className="relative space-y-4 border-l border-border/70 pl-6">
                {claim.reasoning.map((r, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[29px] grid h-6 w-6 place-items-center rounded-full bg-background ring-2 ring-primary/30 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-foreground/90">{r}</p>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      <div className="mt-12">
        <SectionTitle>Suggestions</SectionTitle>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {suggestions.map((s) => (
            <Card
              key={s}
              className="flex items-start gap-3 rounded-2xl border-border/60 p-4 shadow-soft"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div className="min-w-0 text-sm leading-relaxed">{s}</div>
              <Check className="ml-auto h-4 w-4 text-success" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{children}</h2>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  tone: "primary" | "success" | "destructive" | "warning";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
  };
  return (
    <Card className="rounded-3xl border-border/60 p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={`grid h-8 w-8 place-items-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}
