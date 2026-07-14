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
  Landmark,
  BookOpenCheck,
  Layers,
  MessageSquareQuote,
  Compass,
  Info,
  Clock,
  Database as DatabaseIcon,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  claims,
  evidence,
  currentReport,
  confidenceTooltip,
  distributionData,
  sourceUsageData,
  sourceByKey,
  type Claim,
  type Evidence,
  type EvidenceType,
} from "@/lib/mock-data";
import { SourceIcon } from "@/components/verihk/SourceIcon";

export const Route = createFileRoute("/_app/results")({
  head: () => ({
    meta: [
      { title: "Verification Report — VeriHK" },
      {
        name: "description",
        content: "Evidence-based verification report grounded in official Hong Kong sources.",
      },
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
    className: "bg-warning/15 text-warning-foreground border-warning/30",
    icon: HelpCircle,
  },
};

const evidenceTypeStyles: Record<EvidenceType, string> = {
  "Official structured data": "bg-primary/10 text-primary border-primary/20",
  "Government announcement": "bg-success/10 text-success border-success/20",
  "RSS notice": "bg-warning/15 text-warning-foreground border-warning/30",
  "Supporting evidence": "bg-muted text-foreground/80 border-border",
};

function Results() {
  const evidenceById = Object.fromEntries(evidence.map((e) => [e.id, e]));
  const supported = claims.filter((c) => c.status === "supported").length;
  const refuted = claims.filter((c) => c.status === "refuted").length;
  const insufficient = claims.filter((c) => c.status === "insufficient").length;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Verification report
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Evidence-based Explanation
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <MetaChip icon={ListChecks}>{currentReport.claimsDetected} claims detected</MetaChip>
              <MetaChip icon={Landmark}>
                {currentReport.sourcesConsulted} official sources consulted
              </MetaChip>
              <MetaChip icon={ShieldCheck}>
                Evidence coverage: {currentReport.evidenceCoverage}
              </MetaChip>
              <MetaChip icon={Clock}>Last checked {currentReport.lastCheckedAt}</MetaChip>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/history">View history</Link>
            </Button>
            <Button asChild className="rounded-full shadow-elegant">
              <Link to="/verify">New verification</Link>
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={ListChecks} label="Total claims" value={String(claims.length)} tone="primary" />
          <StatCard icon={ShieldCheck} label="Supported" value={String(supported)} tone="success" />
          <StatCard icon={XCircle} label="Refuted" value={String(refuted)} tone="destructive" />
          <StatCard icon={HelpCircle} label="Need evidence" value={String(insufficient)} tone="warning" />
        </div>

        {/* Uploaded content */}
        <Card className="mt-8 rounded-3xl border-border/60 p-6 md:p-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="h-4 w-4" /> SUBMITTED CONTENT
          </div>
          <p className="text-pretty text-base leading-relaxed">{currentReport.input}</p>
        </Card>

        {/* Two-column: claims & charts */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Claims list */}
          <div className="space-y-5">
            <SectionTitle>Extracted claims</SectionTitle>
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
                      <Badge
                        variant="outline"
                        className={`shrink-0 gap-1.5 rounded-full ${meta.className}`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </Badge>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          Confidence
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground/70 transition-colors hover:text-foreground"
                                aria-label="What is confidence?"
                              >
                                <Info className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs leading-relaxed">
                              {confidenceTooltip}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        <span className="font-semibold text-foreground">{claim.confidence}%</span>
                      </div>
                      <Progress value={claim.confidence} className="h-1.5 rounded-full" />
                    </div>

                    {/* Evidence chips */}
                    <div className="mt-5 flex flex-wrap gap-2">
                      {claim.evidenceIds.map((eid) => {
                        const ev = evidenceById[eid];
                        if (!ev) return null;
                        const src = sourceByKey[ev.sourceKey];
                        return (
                          <span
                            key={eid}
                            className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px]"
                          >
                            <SourceIcon sourceKey={ev.sourceKey} className="h-3 w-3" />
                            {src.shortName}
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
              <div className="text-xs text-muted-foreground">By claim status in this report</div>
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
                    <RTooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
                {distributionData.map((d) => (
                  <span key={d.name} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: d.color }}
                    />
                    {d.name} · {d.value}
                  </span>
                ))}
              </div>
            </Card>

            <Card className="rounded-3xl border-border/60 p-6">
              <div className="mb-1 text-sm font-semibold">Evidence source breakdown</div>
              <div className="text-xs text-muted-foreground">Evidence items retrieved per source</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceUsageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="source"
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <RTooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>

        {/* Evidence */}
        <div className="mt-12">
          <SectionTitle>Official evidence</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Every card lists the source, evidence type, publication times and a direct citation link.
          </p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {evidence.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <EvidenceCard ev={e} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Evidence-based Explanation */}
        <div className="mt-12">
          <SectionTitle>Evidence-based Explanation</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            For every claim: the official evidence retrieved, whether sources agree, why the verdict was
            reached, and an actionable recommendation.
          </p>
          <div className="mt-6 space-y-6">
            {claims.map((claim) => (
              <Card key={claim.id} className="rounded-3xl border-border/60 p-6 md:p-8">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`rounded-full ${statusMeta[claim.status].className}`}
                  >
                    {statusMeta[claim.status].label}
                  </Badge>
                  <div className="text-sm font-semibold">{claim.text}</div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <ExplanationRow icon={BookOpenCheck} label="Official evidence">
                    {claim.explanation.officialEvidence}
                  </ExplanationRow>
                  <ExplanationRow icon={Layers} label="Source consistency">
                    {claim.explanation.sourceConsistency}
                  </ExplanationRow>
                  <ExplanationRow icon={MessageSquareQuote} label="Explanation of verdict">
                    {claim.explanation.verdictExplanation}
                  </ExplanationRow>
                  <ExplanationRow icon={Compass} label="Actionable recommendation">
                    {claim.explanation.recommendation}
                  </ExplanationRow>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function EvidenceCard({ ev }: { ev: Evidence }) {
  const src = sourceByKey[ev.sourceKey];
  return (
    <Card className="flex h-full flex-col rounded-3xl border-border/60 p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border/70 bg-muted/60 text-foreground/80">
            <SourceIcon sourceKey={ev.sourceKey} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{src.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {src.shortName}
            </div>
          </div>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 gap-1 rounded-full border-success/30 bg-success/10 text-success"
        >
          <ShieldCheck className="h-3 w-3" /> Official
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={`gap-1 rounded-full text-[11px] ${evidenceTypeStyles[ev.evidenceType]}`}
        >
          <DatabaseIcon className="h-3 w-3" />
          {ev.evidenceType}
        </Badge>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/90">{ev.summary}</p>

      <div className="mt-4 rounded-2xl border-l-2 border-primary/40 bg-muted/40 p-3 pl-4">
        <Quote className="mb-1 h-3 w-3 text-primary" />
        <p className="text-xs italic leading-relaxed text-muted-foreground">{ev.citation}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[11px] text-muted-foreground">
        <div>
          <div>Published: {ev.publishedAt}</div>
          <div>Updated: {ev.updatedAt}</div>
        </div>
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <a href={ev.url} target="_blank" rel="noreferrer">
            Open source <ExternalLink className="ml-1.5 h-3 w-3" />
          </a>
        </Button>
      </div>
      <div
        className="mt-3 truncate rounded-lg bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground"
        title={ev.url}
      >
        {ev.url}
      </div>
    </Card>
  );
}

function ExplanationRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof ShieldCheck;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{children}</p>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  children,
}: {
  icon: typeof ShieldCheck;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 font-medium">
      <Icon className="h-3 w-3 text-primary" />
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{children}</h2>;
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

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
} as const;
