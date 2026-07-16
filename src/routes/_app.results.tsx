import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  claims as mockClaims,
  evidence as mockEvidence,
  currentReport as mockCurrentReport,
  confidenceTooltip,
  distributionData as mockDistributionData,
  sourceUsageData as mockSourceUsageData,
  sourceByKey,
  type Claim,
  type Evidence,
  type EvidenceType,
} from "@/lib/mock-data";
import { SourceIcon } from "@/components/verihk/SourceIcon";
import { TrafficEvidenceMap } from "@/components/TrafficEvidenceMap";
import {
  LATEST_REPORT_KEY,
  isPhaseOneReport,
  type PhaseOneClaim,
  type PhaseOneEvidence,
  type PhaseOneReport,
} from "@/lib/report-contract";
import { formatHongKongTime } from "@/lib/live-sources";
import {
  buildClaimDisplayExplanation,
  getHeaderReportLabels,
  getOfficialUpdateLabel,
  getRetrievedByVeriHkLabel,
} from "@/lib/report-display";
import { hasMatchedTransportEvidence } from "@/lib/traffic-map-utils";

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
  "Official Weather API": "bg-primary/10 text-primary border-primary/20",
  "Government announcement": "bg-success/10 text-success border-success/20",
  "RSS notice": "bg-warning/15 text-warning-foreground border-warning/30",
  "Supporting evidence": "bg-muted text-foreground/80 border-border",
};

function Results() {
  const [generatedReport, setGeneratedReport] = useState<PhaseOneReport | null>(null);

  useEffect(() => {
    const storedReport = window.sessionStorage.getItem(LATEST_REPORT_KEY);
    if (!storedReport) return;

    try {
      const parsed = JSON.parse(storedReport) as unknown;
      if (isPhaseOneReport(parsed)) {
        setGeneratedReport(parsed);
      }
    } catch {
      setGeneratedReport(null);
    }
  }, []);

  const isGenerated = Boolean(generatedReport);
  const claims = useMemo(
    () => (generatedReport ? generatedReport.claims.map(toMockClaim) : mockClaims),
    [generatedReport],
  );
  const evidence = useMemo(
    () => (generatedReport ? toMockEvidence(generatedReport.claims) : mockEvidence),
    [generatedReport],
  );
  const sourcesConsulted = generatedReport
    ? new Set(generatedReport.source_freshness?.map((source) => source.source_key)).size
    : mockCurrentReport.sourcesConsulted;
  const reportMeta = generatedReport
    ? {
        input: generatedReport.input_content,
        claimsDetected: generatedReport.claims.length,
        sourcesConsulted,
        evidenceCoverage: toCoverageLabel(generatedReport.evidence_coverage),
        lastCheckedAt: formatHongKongTime(generatedReport.checked_at),
      }
    : mockCurrentReport;
  const [reportLabel] = getHeaderReportLabels(generatedReport);
  const evidenceById = Object.fromEntries(evidence.map((e) => [e.id, e]));
  const supported = claims.filter((c) => c.status === "supported").length;
  const refuted = claims.filter((c) => c.status === "refuted").length;
  const insufficient = claims.filter((c) => c.status === "insufficient").length;
  const distributionData = isGenerated
    ? [
        { name: "Supported", value: supported, color: "var(--success)" },
        { name: "Refuted", value: refuted, color: "var(--destructive)" },
        { name: "Need Evidence", value: insufficient, color: "var(--warning)" },
      ]
    : mockDistributionData;
  const sourceUsageData = isGenerated ? buildGeneratedSourceUsage(evidence) : mockSourceUsageData;
  const retrievalCounts = generatedReport?.retrieval_counts;
  const showTrafficMap = generatedReport
    ? hasMatchedTransportEvidence(generatedReport.claims)
    : false;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="premium-container py-8 md:py-14">
        {/* Header */}
        <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-foreground" /> {reportLabel}
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
              Evidence report, built from official signals.
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <MetaChip icon={ListChecks}>{reportMeta.claimsDetected} claims detected</MetaChip>
              <MetaChip icon={Landmark}>
                {reportMeta.sourcesConsulted} official sources consulted
              </MetaChip>
              <MetaChip icon={ShieldCheck}>
                Evidence coverage: {reportMeta.evidenceCoverage}
              </MetaChip>
              <MetaChip icon={Clock}>Last checked {reportMeta.lastCheckedAt}</MetaChip>
            </div>
          </div>
          <div className="flex gap-4 lg:justify-end">
            <Link
              to="/history"
              className="text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              View history
            </Link>
            <Link
              to="/verify"
              className="text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              New verification
            </Link>
          </div>

        </div>

        {/* Stat cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            icon={ListChecks}
            label="Total claims"
            value={String(claims.length)}
            tone="primary"
          />
          <StatCard icon={ShieldCheck} label="Supported" value={String(supported)} tone="success" />
          <StatCard icon={XCircle} label="Refuted" value={String(refuted)} tone="destructive" />
          <StatCard
            icon={HelpCircle}
            label="Need evidence"
            value={String(insufficient)}
            tone="warning"
          />
        </div>

        {/* Uploaded content */}
        <Card className="panel mt-8 rounded-[2rem] p-6 md:p-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <FileText className="h-4 w-4" /> SUBMITTED CONTENT
          </div>
          <p className="text-pretty text-base leading-relaxed">{reportMeta.input}</p>
          {isGenerated && (
            <p className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning-foreground">
              This prototype fetches selected live official sources at request time. It does not
              claim full historical coverage.
            </p>
          )}
          {isGenerated && retrievalCounts && (
            <div className="mt-4 grid gap-2 text-xs md:grid-cols-3">
              <div className="rounded-2xl border bg-background/65 p-3">
                <div className="font-medium">{retrievalCounts.official_sources_queried}</div>
                <div className="mt-1 text-muted-foreground">Official endpoints queried</div>
              </div>
              <div className="rounded-2xl border bg-background/65 p-3">
                <div className="font-medium">{retrievalCounts.feed_items_fetched}</div>
                <div className="mt-1 text-muted-foreground">Official records retrieved</div>
              </div>
              <div className="rounded-2xl border bg-background/65 p-3">
                <div className="font-medium">
                  {retrievalCounts.unique_relevant_evidence_records ??
                    retrievalCounts.relevant_evidence_attached}
                </div>
                <div className="mt-1 text-muted-foreground">
                  Unique relevant evidence{" "}
                  {(retrievalCounts.unique_relevant_evidence_records ??
                    retrievalCounts.relevant_evidence_attached) === 1
                    ? "item"
                    : "items"}
                </div>
                {retrievalCounts.claim_evidence_links &&
                  retrievalCounts.claim_evidence_links >
                    (retrievalCounts.unique_relevant_evidence_records ??
                      retrievalCounts.relevant_evidence_attached) && (
                    <div className="mt-1 text-muted-foreground">
                      Used across {retrievalCounts.claim_evidence_links} claims
                    </div>
                  )}
              </div>
            </div>
          )}
          {generatedReport?.source_freshness && (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {generatedReport.source_freshness.map((source) => (
                <div
                  key={`${source.source_key}-${source.retrieved_at}`}
                  className="rounded-2xl border bg-background/65 p-3 text-xs"
                >
                  <div className="font-medium">{source.source_name}</div>
                  <div className="mt-1 text-muted-foreground">Freshness: {source.freshness}</div>
                  <div className="mt-1 text-muted-foreground">
                    Official update:{" "}
                    {source.updated_at ? formatHongKongTime(source.updated_at) : "Not stated"}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Retrieved by VeriHK: {formatHongKongTime(source.retrieved_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  <Card className="panel rounded-3xl p-6">
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
                          {getConfidenceLabel(claim, evidenceById)}
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
            <Card className="panel rounded-3xl p-6">
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
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name} · {d.value}
                  </span>
                ))}
              </div>
            </Card>

            <Card className="panel rounded-3xl p-6">
              <div className="mb-1 text-sm font-semibold">Evidence source breakdown</div>
              <div className="text-xs text-muted-foreground">
                Evidence items retrieved per source
              </div>
              {sourceUsageData.length === 1 ? (
                <CompactSourceUsage item={sourceUsageData[0]} />
              ) : sourceUsageData.length > 1 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceUsageData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
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
              ) : (
                <div className="grid h-56 place-items-center rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  Selected live official sources were checked, but no directly relevant evidence was
                  attached to this report.
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Evidence */}
        <div className="mt-12">
          <SectionTitle>Official evidence</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Every card lists the source, evidence type, publication times and a direct citation
            link.
          </p>
          {evidence.length > 0 ? (
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
          ) : (
            <Card className="panel mt-5 rounded-3xl p-6 text-sm leading-relaxed text-muted-foreground">
              Selected live official sources were checked, but no directly relevant official
              evidence was found for these claims.
            </Card>
          )}
        </div>

        {showTrafficMap && (
          <TrafficEvidenceMap claims={generatedReport!.claims} formatTime={formatHongKongTime} />
        )}

        {/* Evidence-based Explanation */}
        <div className="mt-12">
          <SectionTitle>Evidence-based Explanation</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            For every claim: the official evidence retrieved, whether sources agree, why the verdict
            was reached, and an actionable recommendation.
          </p>
          <div className="mt-6 space-y-6">
            {claims.map((claim) => (
              <Card key={claim.id} className="panel rounded-3xl p-6 md:p-8">
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

function toMockClaim(claim: PhaseOneClaim): Claim {
  const explanation = buildClaimDisplayExplanation(claim);
  return {
    id: claim.id,
    text: claim.text,
    status:
      claim.verdict === "supported"
        ? "supported"
        : claim.verdict === "refuted"
          ? "refuted"
          : "insufficient",
    confidence: Math.round(claim.confidence * 100),
    evidenceIds: claim.evidence.map((item) => item.id),
    explanation,
  };
}

function toCoverageLabel(
  coverage: PhaseOneReport["evidence_coverage"],
): "High" | "Medium" | "Low" | "None" {
  if (coverage === "high") return "High";
  if (coverage === "medium") return "Medium";
  if (coverage === "low") return "Low";
  return "None";
}

function getConfidenceLabel(claim: Claim, evidenceById: Record<string, Evidence>): string {
  const hasOfficialEvidence = claim.evidenceIds.some((id) => Boolean(evidenceById[id]));
  return hasOfficialEvidence && claim.status !== "insufficient"
    ? "Verification Confidence"
    : "Analysis Confidence";
}

function toMockEvidence(claims: PhaseOneClaim[]): Evidence[] {
  const byId = new Map<string, PhaseOneEvidence>();
  for (const claim of claims) {
    for (const item of claim.evidence) byId.set(item.id, item);
  }

  return [...byId.values()].map((item) => ({
    id: item.id,
    sourceKey: item.source_key,
    evidenceType:
      item.source_type === "rss_item"
        ? "RSS notice"
        : item.source_type === "government_rss"
          ? "RSS notice"
          : item.source_type === "hko_warning"
            ? "Official Weather API"
            : item.source_type === "official_api" || item.source_type === "government_webpage"
              ? "Official structured data"
              : "Supporting evidence",
    publishedAt: item.published_at ? formatHongKongTime(item.published_at) : "Not stated by source",
    updatedAt: getOfficialUpdateLabel(item, formatHongKongTime),
    retrievedAt: getRetrievedByVeriHkLabel(item, formatHongKongTime),
    summary: `${item.summary} Freshness: ${item.freshness}. Retrieved: ${formatHongKongTime(
      item.retrieved_at,
    )}.`,
    citation: item.title,
    url: item.url,
  }));
}

function buildGeneratedSourceUsage(evidence: Evidence[]) {
  const counts = new Map<string, number>();
  for (const item of evidence) {
    const source = sourceByKey[item.sourceKey]?.shortName ?? item.sourceKey;
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()].map(([source, count]) => ({ source, count }));
}

function CompactSourceUsage({ item }: { item: { source: string; count: number } }) {
  return (
    <div className="mt-5 rounded-2xl border bg-background/65 p-4">
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{item.source}</span>
        <span className="text-muted-foreground">
          {item.count} evidence {item.count === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: "100%" }} />
      </div>
    </div>
  );
}

function EvidenceCard({ ev }: { ev: Evidence }) {
  const src = sourceByKey[ev.sourceKey];
  return (
    <Card className="panel flex h-full flex-col rounded-3xl p-6">
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

      <div className="mt-4 rounded-2xl border-l-2 border-foreground/30 bg-background/70 p-3 pl-4">
        <Quote className="mb-1 h-3 w-3 text-primary" />
        <p className="text-xs italic leading-relaxed text-muted-foreground">{ev.citation}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[11px] text-muted-foreground">
        <div>
          <div>Published: {ev.publishedAt}</div>
          <div>{ev.updatedAt}</div>
          {ev.retrievedAt && <div>{ev.retrievedAt}</div>}
        </div>
        <a
          href={ev.url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold text-foreground transition-colors hover:text-primary"
        >
          Open source <ExternalLink className="ml-1 inline h-3 w-3" />
        </a>

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
    <Card className="panel rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className={`grid h-8 w-8 place-items-center rounded-xl ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-normal">{value}</div>
    </Card>
  );
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
} as const;
