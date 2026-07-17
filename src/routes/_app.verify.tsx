import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  CloudSun,
  FileText,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageFrame, PageHeader } from "@/components/verihk/PageChrome";
import {
  MAX_ANALYSIS_INPUT_CHARS,
  PENDING_INPUT_KEY,
  PENDING_TRAFFIC_GENERATION_METADATA_KEY,
  PENDING_VERIFICATION_MODE_KEY,
  type TrafficGenerationMetadata,
  type VerificationMode,
} from "@/lib/report-contract";
import {
  VERIFICATION_MODES,
  getVerificationModeMismatchMessage,
} from "@/lib/verification-mode";
import { formatHongKongTime } from "@/lib/live-sources";
import {
  generateTrafficTestClaims,
  getGeneratedSemanticField,
  loadTrafficTestFeed,
  type TrafficGeneratedClaims,
  type TrafficTestFeedResponse,
  type TrafficTestRecord,
} from "@/lib/traffic-test-feed";

export const Route = createFileRoute("/_app/verify")({
  head: () => ({
    meta: [
      { title: "Verify — VeriHK" },
      {
        name: "description",
        content:
          "Submit a factual claim and verify it against timely official Hong Kong sources.",
      },
      { property: "og:title", content: "Verify — VeriHK" },
      {
        property: "og:description",
        content: "Explainable, source-cited verification grounded in official Hong Kong data.",
      },
    ],
  }),
  component: VerifyPage,
});

const WEATHER_TEST_CLAIMS = [
  "A Thunderstorm Warning is currently in force in Hong Kong.",
  "Typhoon Signal No. 3 is currently in force.",
  "The Amber Rainstorm Warning is currently active.",
  "There are no weather warnings currently in force in Hong Kong.",
  "At least one weather warning is currently active in Hong Kong.",
  "All weather warnings have been cancelled.",
  "The current temperature in Hong Kong is 28°C.",
  "The current temperature is around 28°C.",
  "The current relative humidity is above 50%.",
  "The current temperature is below 10°C.",
];

function VerifyPage() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<VerificationMode>("auto");
  const [trafficFeed, setTrafficFeed] = useState<TrafficTestFeedResponse | null>(null);
  const [trafficFeedStatus, setTrafficFeedStatus] = useState<
    "idle" | "loading" | "success" | "empty" | "error"
  >("idle");
  const [selectedTrafficRecordId, setSelectedTrafficRecordId] = useState<string | null>(null);
  const [claimType, setClaimType] = useState<"supported" | "refuted">("supported");
  const trimmedText = text.trim();

  const analyze = () => {
    const trimmed = text.trim();

    if (!trimmed) {
      setError("Please enter some text to analyze.");
      return;
    }

    if (trimmed.length > MAX_ANALYSIS_INPUT_CHARS) {
      setError(
        `Please keep the text under ${MAX_ANALYSIS_INPUT_CHARS.toLocaleString()} characters for this first version.`,
      );
      return;
    }

    const modeMismatch = getVerificationModeMismatchMessage(trimmed, mode);
    if (modeMismatch) {
      setError(modeMismatch);
      return;
    }

    window.sessionStorage.setItem(PENDING_INPUT_KEY, trimmed);
    window.sessionStorage.setItem(PENDING_VERIFICATION_MODE_KEY, mode);
    setError("");
    navigate({ to: "/processing" });
  };

  const loadTrafficRecords = async () => {
    setTrafficFeedStatus("loading");
    try {
      const result = await loadTrafficTestFeed();
      setTrafficFeed(result);
      setTrafficFeedStatus(result.records.length ? "success" : "empty");
      setSelectedTrafficRecordId((current) =>
        current && result.records.some((record) => record.id === current) ? current : null,
      );
    } catch {
      setTrafficFeedStatus("error");
    }
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Verification workspace"
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Turn a message into an evidence network."
        description="Paste the content you want checked. VeriHK will keep the same secure backend flow: extract claims, query official sources, and build an explainable report."
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="panel overflow-hidden rounded-[2rem] p-5 md:p-8">
          <div>
            <label
              htmlFor="verification-text"
              className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <FileText className="h-4 w-4" />
              Claim text
            </label>
            <Textarea
              id="verification-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter a factual claim to verify..."
              className="min-h-72 resize-none rounded-3xl border-border/70 bg-background/80 p-6 text-base leading-relaxed shadow-inner"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {text.length} / {MAX_ANALYSIS_INPUT_CHARS.toLocaleString()} characters · English &
              繁體中文 supported
            </p>
            <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted-foreground">
              <div className="font-medium text-foreground/70">Example claims:</div>
              <p>"The current temperature in Hong Kong is above 30°C."</p>
              <p>"Traffic is busy on Nathan Road."</p>
              <p>Supports weather and transport claims verified against official Hong Kong sources.</p>
            </div>
          </div>

          <div className="mt-7">
            <fieldset>
              <legend className="text-sm font-semibold text-foreground">Verification Mode</legend>
              <div
                className="mt-3 grid rounded-2xl border bg-muted/55 p-1 sm:grid-cols-3"
                aria-label="Verification mode"
              >
                {VERIFICATION_MODES.map((item) => {
                  const selected = mode === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setMode(item.value);
                        setError("");
                      }}
                      className={`rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selected
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {mode === "weather" && (
            <WeatherTestClaimsPanel
              onUseClaim={(claim) => {
                setText(claim);
                setError("");
                window.sessionStorage.removeItem(PENDING_TRAFFIC_GENERATION_METADATA_KEY);
              }}
            />
          )}

          {mode === "traffic" && (
            <TrafficTestPanel
              feed={trafficFeed}
              status={trafficFeedStatus}
              selectedRecordId={selectedTrafficRecordId}
              claimType={claimType}
              onLoad={loadTrafficRecords}
              onSelectRecord={(recordId) => setSelectedTrafficRecordId(recordId)}
              onClaimTypeChange={setClaimType}
              onUseClaim={(claim, metadata) => {
                setText(claim);
                window.sessionStorage.setItem(
                  PENDING_TRAFFIC_GENERATION_METADATA_KEY,
                  JSON.stringify(metadata),
                );
              }}
            />
          )}

          <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Live official-source checking runs on the server. Your API keys never enter the browser.
              </p>
              {error && (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={analyze}
              disabled={!trimmedText}
              className="text-base font-bold text-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:text-muted-foreground sm:min-w-52"
            >
              Start analysis
            </button>

          </div>
        </Card>
      </motion.div>
    </PageFrame>
  );
}

function WeatherTestClaimsPanel({ onUseClaim }: { onUseClaim: (claim: string) => void }) {
  return (
    <section
      className="mt-7 rounded-[1.75rem] border bg-background/60 p-4 md:p-5"
      aria-labelledby="weather-test-claims-title"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CloudSun className="h-4 w-4" />
        </div>
        <div>
          <h2 id="weather-test-claims-title" className="text-sm font-semibold">
            Weather Test Claims
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Try current-warning, no-warning, temperature and humidity examples against live HKO data.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {WEATHER_TEST_CLAIMS.map((claim) => (
          <button
            key={claim}
            type="button"
            onClick={() => onUseClaim(claim)}
            className="rounded-2xl border bg-background/70 p-3 text-left text-sm leading-relaxed transition-colors hover:border-foreground/40 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {claim}
          </button>
        ))}
      </div>
    </section>
  );
}

function TrafficTestPanel({
  feed,
  status,
  selectedRecordId,
  claimType,
  onLoad,
  onSelectRecord,
  onClaimTypeChange,
  onUseClaim,
}: {
  feed: TrafficTestFeedResponse | null;
  status: "idle" | "loading" | "success" | "empty" | "error";
  selectedRecordId: string | null;
  claimType: "supported" | "refuted";
  onLoad: () => void;
  onSelectRecord: (recordId: string) => void;
  onClaimTypeChange: (claimType: "supported" | "refuted") => void;
  onUseClaim: (claim: string, metadata: TrafficGenerationMetadata) => void;
}) {
  const records = feed?.records ?? [];
  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? null;
  const generatedClaims = selectedRecord ? generateTrafficTestClaims(selectedRecord) : null;
  const selectedClaim =
    claimType === "supported" ? generatedClaims?.supported : generatedClaims?.refuted;
  const refutedDisabled = Boolean(selectedRecord && !generatedClaims?.refuted);
  const loading = status === "loading";
  const generatedSemanticField = selectedRecord
    ? getGeneratedSemanticField(selectedRecord, claimType)
    : "";

  return (
    <section
      className="mt-7 rounded-[1.75rem] border bg-background/60 p-4 md:p-5"
      aria-labelledby="traffic-test-panel-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="traffic-test-panel-title" className="text-sm font-semibold">
            Current Traffic Events
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Generate a verification example from the current official TD feed.
          </p>
        </div>
        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {feed ? "Refresh" : "Load Live Traffic Events"}
        </button>
      </div>

      <div className="mt-4 text-xs text-muted-foreground" aria-live="polite">
        {status === "idle" &&
          "Load the latest official Transport Department events to generate verification examples."}
        {status === "loading" && "Loading current Transport Department records..."}
        {status === "success" &&
          `${feed?.parsedRecordsAvailable ?? 0} Live ${
            (feed?.parsedRecordsAvailable ?? 0) === 1 ? "Event" : "Events"
          }`}
        {status === "empty" && "No current TD Special Traffic News records are available."}
        {status === "error" &&
          "Current Transport Department records could not be loaded. You can still enter a traffic claim manually."}
      </div>

      {feed && status !== "error" && (
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <MiniMetric label="Official records retrieved" value={String(feed.recordsRetrieved)} />
          <MiniMetric label="Parsed test records available" value={String(feed.parsedRecordsAvailable)} />
          {feed.officialUpdatedAt && (
            <MiniMetric label="Official update time" value={formatHongKongTime(feed.officialUpdatedAt)} />
          )}
          <MiniMetric label="Retrieved by VeriHK" value={formatHongKongTime(feed.retrievedAt)} />
        </div>
      )}

      {records.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {records.map((record) => (
            <TrafficRecordButton
              key={record.id}
              record={record}
              selected={record.id === selectedRecordId}
              onSelect={() => onSelectRecord(record.id)}
            />
          ))}
        </div>
      )}

      {selectedRecord && generatedClaims && (
        <div className="mt-4 rounded-2xl border bg-muted/30 p-4">
          <div className="text-xs font-medium text-muted-foreground">
            Generated from the current official TD feed.
          </div>
          <fieldset className="mt-3">
            <legend className="text-sm font-semibold">Verification example</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={claimType === "supported"}
                onClick={() => onClaimTypeChange("supported")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  claimType === "supported" ? "bg-foreground text-background" : "bg-background"
                }`}
              >
                ✓ Verify Official Claim
              </button>
              <button
                type="button"
                aria-pressed={claimType === "refuted"}
                disabled={refutedDisabled}
                onClick={() => onClaimTypeChange("refuted")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:text-muted-foreground ${
                  claimType === "refuted" ? "bg-foreground text-background" : "bg-background"
                }`}
              >
                ✗ Generate Contradiction
              </button>
              <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                ✎ Edit Manually
              </span>
            </div>
          </fieldset>
          <div className="mt-3 rounded-2xl border bg-background/70 p-3 text-sm leading-relaxed">
            {selectedClaim ?? generatedClaims.refutedUnavailableReason}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            This example is derived from an official record so you can test the verification
            workflow. The normal verification process will still retrieve and evaluate the live
            source again.
          </p>
          <button
            type="button"
            disabled={!selectedClaim}
            onClick={() =>
              selectedClaim &&
              selectedRecord &&
              onUseClaim(selectedClaim, {
                sourceRecordId: selectedRecord.id,
                sourceOfficialUpdatedAt: selectedRecord.officialUpdatedAt,
                sourceCurrentStatus: selectedRecord.currentStatus,
                generatedClaimKind: claimType,
                generatedSemanticField,
                generatedAt: new Date().toISOString(),
              })
            }
            className="mt-3 text-sm font-bold text-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            Use this claim
          </button>
          {shouldShowTrafficGenerationDebug() && selectedRecord && (
            <dl className="mt-3 grid gap-2 rounded-2xl border bg-background/60 p-3 text-xs sm:grid-cols-3">
              <MiniMetric label="Source record ID" value={selectedRecord.id} />
              <MiniMetric label="Record status used" value={selectedRecord.currentStatus ?? selectedRecord.serviceStatus ?? "Not stated"} />
              <MiniMetric label="Generated semantic field" value={generatedSemanticField} />
            </dl>
          )}
        </div>
      )}
    </section>
  );
}

function TrafficRecordButton({
  record,
  selected,
  onSelect,
}: {
  record: TrafficTestRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const fields = recordFields(record);
  const eventLabel = getTrafficEventLabel(record);
  const primaryLocation = record.roadName ?? record.routeOrLine ?? record.transportMode ?? record.title;
  const secondaryLocation = getSecondaryTrafficLocation(record);
  const updatedAt = record.officialUpdatedAt ? formatHongKongTime(record.officialUpdatedAt) : null;
  const possiblyOutdated = record.freshness === "stale";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? "border-foreground bg-background" : "bg-background/60 hover:border-foreground/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {eventLabel}
          </div>
          <div className="mt-1 break-words text-base font-semibold leading-snug">
            {primaryLocation}
          </div>
          {secondaryLocation && (
            <div className="mt-1 break-words text-sm text-muted-foreground">
              {secondaryLocation}
            </div>
          )}
        </div>
        {selected && <span className="shrink-0 text-xs font-semibold">Selected</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {record.cause && <span className="rounded-full border bg-background/70 px-2 py-1">{record.cause}</span>}
        {record.currentStatus && (
          <span className="rounded-full border bg-background/70 px-2 py-1">{record.currentStatus}</span>
        )}
        {record.scope && <span className="rounded-full border bg-background/70 px-2 py-1">{record.scope}</span>}
        {updatedAt && <span className="rounded-full border bg-background/70 px-2 py-1">Updated {updatedAt}</span>}
        {possiblyOutdated && (
          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-warning-foreground">
            Possibly outdated
          </span>
        )}
      </div>
      {possiblyOutdated && updatedAt && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Last officially updated {updatedAt}. Verify again before relying on this event.
        </p>
      )}
      <dl className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
        {fields.map((field) => (
          <div key={field.label} className="grid gap-0.5 sm:grid-cols-[8rem_1fr]">
            <dt>{field.label}</dt>
            <dd className="break-words font-medium text-foreground/80">{field.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 text-xs font-bold text-foreground">Generate Verification</div>
    </button>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background/60 p-3">
      <div className="font-medium text-foreground">{value}</div>
      <div className="mt-1 text-muted-foreground">{label}</div>
    </div>
  );
}

function shouldShowTrafficGenerationDebug(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_SHOW_DEVELOPER_DETAILS === "true";
}

function recordFields(record: TrafficTestRecord): Array<{ label: string; value: string }> {
  return [
    ["Road", record.roadName],
    ["Direction", record.direction],
    ["Nearby landmark", record.nearbyLandmark],
    ["District", record.district],
    ["Current status", record.currentStatus ?? record.serviceStatus],
    ["Event type", record.eventType],
    ["Cause", record.cause],
    ["Scope", record.scope],
    ["Transport mode", record.transportMode],
    ["Route", record.routeOrLine],
    ["Station or stop", record.stationOrStop],
    [
      "Official update",
      record.officialUpdatedAt ? formatHongKongTime(record.officialUpdatedAt) : undefined,
    ],
  ]
    .filter((field): field is [string, string] => typeof field[1] === "string" && field[1].trim() !== "")
    .map(([label, value]) => ({ label, value }));
}

function getTrafficEventLabel(record: TrafficTestRecord): string {
  if (record.eventType === "traffic_congestion") return "Busy Traffic";
  if (record.currentStatus === "reopened" || record.eventType === "road_reopened") return "Reopened";
  if (record.eventType === "lane_closure") return "Lane Closure";
  if (record.eventType === "road_closure") return "Road Closure";
  if (record.eventType?.startsWith("public_transport")) return "Public Transport Update";
  return record.eventType ? titleFromToken(record.eventType) : "Traffic Event";
}

function getSecondaryTrafficLocation(record: TrafficTestRecord): string | null {
  if (record.nearbyLandmark) return `Near ${record.nearbyLandmark}`;
  if (record.stationOrStop) return `Near ${record.stationOrStop}`;
  if (record.direction) return record.direction;
  return null;
}

function titleFromToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
