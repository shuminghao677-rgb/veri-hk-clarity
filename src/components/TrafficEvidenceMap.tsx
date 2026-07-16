import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, MapPinned, Navigation, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PhaseOneClaim } from "@/lib/report-contract";
import {
  getTrafficEvidenceMapItems,
  getTrafficCoordinateSourceText,
  getTrafficVerdictLabel,
  type TrafficMapEvidenceItem,
} from "@/lib/traffic-map-utils";

const LazyTrafficEvidenceMapLeaflet = lazy(() => import("./TrafficEvidenceMapLeaflet"));

type TrafficEvidenceMapProps = {
  claims: PhaseOneClaim[];
  formatTime: (value: string) => string;
};

type TrafficEvidenceMapState = {
  hasError: boolean;
};

class TrafficMapErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  TrafficEvidenceMapState
> {
  state: TrafficEvidenceMapState = { hasError: false };

  static getDerivedStateFromError(): TrafficEvidenceMapState {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function TrafficEvidenceMap({ claims, formatTime }: TrafficEvidenceMapProps) {
  const items = useMemo(() => getTrafficEvidenceMapItems(claims), [claims]);
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [mapFailed, setMapFailed] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const locatedItems = items.filter((item) => item.location);

  if (!items.length) return null;

  const activeItem = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <section className="mt-12" aria-labelledby="traffic-evidence-map-title">
      <div className="mx-auto max-w-[1160px]">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="traffic-evidence-map-title" className="text-2xl font-semibold tracking-tight">
              Affected Location
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Visual explanation of matched Transport Department evidence. The map does not affect
              the verification result.
            </p>
          </div>
          <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">
            <MapPinned className="mr-1.5 h-3.5 w-3.5" />
            Evidence layer
          </Badge>
        </div>

        <Card className="overflow-hidden rounded-[24px] border-white/60 bg-white/75 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden">
          <TrafficMapFallback items={items} activeItem={activeItem} formatTime={formatTime} />
        </Card>

        <Card className="hidden overflow-hidden rounded-[24px] border-white/60 bg-white/75 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:block">
          <div className="grid h-[420px] grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
            {locatedItems.length > 0 && !mapFailed && !prefersReducedMotion ? (
              <TrafficMapErrorBoundary
                fallback={<TrafficMapFallback items={items} activeItem={activeItem} formatTime={formatTime} />}
              >
                <Suspense fallback={<TrafficMapLoading />}>
                  <LazyTrafficEvidenceMapLeaflet
                    items={locatedItems}
                    activeId={activeItem.id}
                    onSelect={setActiveId}
                    onMapFailure={() => setMapFailed(true)}
                    formatTime={formatTime}
                  />
                </Suspense>
              </TrafficMapErrorBoundary>
            ) : (
              <TrafficMapFallback items={items} activeItem={activeItem} formatTime={formatTime} />
            )}

            <div className="min-w-0 border-l border-border/50 bg-background/80 p-5">
              <TrafficMapInfoPanel
                items={items}
                activeItem={activeItem}
                onSelect={setActiveId}
                formatTime={formatTime}
              />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function TrafficMapLoading() {
  return (
    <div className="grid h-full place-items-center bg-gradient-to-br from-sky-50 via-white to-slate-100">
      <div className="rounded-2xl border bg-white/80 px-4 py-3 text-sm text-muted-foreground shadow-soft">
        Loading location layer...
      </div>
    </div>
  );
}

function TrafficMapFallback({
  items,
  activeItem,
  formatTime,
}: {
  items: TrafficMapEvidenceItem[];
  activeItem: TrafficMapEvidenceItem;
  formatTime: (value: string) => string;
}) {
  return (
    <div className="grid h-full place-items-center bg-gradient-to-br from-sky-50 via-white to-slate-100 p-8">
      <div className="max-w-md rounded-[24px] border border-white/70 bg-white/80 p-6 shadow-soft backdrop-blur">
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MapPinned className="h-5 w-5" />
        </div>
        <div className="text-lg font-semibold">
          {isPublicTransportItem(activeItem)
            ? "Public Transport Location Summary"
            : "Location Summary"}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Coordinates are not available for every matched TD evidence item. The report remains fully
          usable without the map.
        </p>
        <div className="mt-5 space-y-2 text-sm">
          {isPublicTransportItem(activeItem) ? (
            <>
              <SummaryLine label="Mode" value={activeItem.metadata.transport_mode} />
              <SummaryLine label="Line or Route" value={activeItem.metadata.route_or_line} />
              <SummaryLine label="Station or Stop" value={activeItem.metadata.station_or_stop} />
              <SummaryLine label="Service Status" value={activeItem.metadata.service_status} />
            </>
          ) : (
            <>
              <SummaryLine label="Road" value={activeItem.metadata.road_name} />
              <SummaryLine label="Nearby landmark" value={activeItem.metadata.nearby_landmark} />
              <SummaryLine label="Direction" value={activeItem.metadata.direction} />
            </>
          )}
          <SummaryLine label="Event type" value={activeItem.metadata.event_type} />
          <SummaryLine label="Coordinate Source" value={getTrafficCoordinateSourceText(activeItem)} />
          <SummaryLine label="Official update" value={formatOptionalTime(activeItem.evidence.updated_at, formatTime)} />
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          {items.length} matched Transport Department evidence {items.length === 1 ? "item" : "items"}.
        </div>
      </div>
    </div>
  );
}

function TrafficMapInfoPanel({
  items,
  activeItem,
  onSelect,
  formatTime,
}: {
  items: TrafficMapEvidenceItem[];
  activeItem: TrafficMapEvidenceItem;
  onSelect: (id: string) => void;
  formatTime: (value: string) => string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Transport Department Evidence
          </div>
          <div className="mt-1 text-xl font-semibold leading-tight">
            {activeItem.metadata.route_or_line ??
              activeItem.metadata.road_name ??
              "Matched Transport evidence"}
          </div>
          {activeItem.location?.approximate && (
            <div className="mt-1 text-xs font-medium text-primary">Approximate demo location</div>
          )}
        </div>
        <StatusBadge verdict={activeItem.verdict} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {isPublicTransportItem(activeItem) ? (
          <>
            <SummaryLine label="Mode" value={activeItem.metadata.transport_mode} />
            <SummaryLine label="Line or Route" value={activeItem.metadata.route_or_line} />
            <SummaryLine label="Station or Stop" value={activeItem.metadata.station_or_stop} />
            <SummaryLine label="Service Status" value={activeItem.metadata.service_status} />
          </>
        ) : (
          <>
            <SummaryLine label="Road" value={activeItem.metadata.road_name} />
            <SummaryLine label="Nearby Landmark" value={activeItem.metadata.nearby_landmark} />
            <SummaryLine label="District" value={activeItem.metadata.district ?? activeItem.location?.district} />
            <SummaryLine label="Direction" value={activeItem.metadata.direction} />
          </>
        )}
        <SummaryLine label="Event Type" value={activeItem.metadata.event_type} />
        <SummaryLine label="Scope" value={activeItem.metadata.scope} />
        <SummaryLine label="Coordinate Source" value={getTrafficCoordinateSourceText(activeItem)} />
        <SummaryLine label="Official Update" value={formatOptionalTime(activeItem.evidence.updated_at, formatTime)} />
        <SummaryLine label="Retrieved by VeriHK" value={formatTime(activeItem.evidence.retrieved_at)} />
      </div>

      {activeItem.location?.approximate && (
        <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
          This coordinate comes from a small demo registry and is shown only because matched TD
          evidence confirms the same road and nearby landmark. It is not official TD geometry.
        </div>
      )}

      <Button asChild variant="outline" className="mt-4 w-full rounded-full">
        <a href={activeItem.evidence.url} target="_blank" rel="noreferrer">
          Open Official Notice <ExternalLink className="ml-2 h-3.5 w-3.5" />
        </a>
      </Button>

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {items.map((item) => (
          <motion.button
            id={`traffic-map-card-${item.id}`}
            key={item.id}
            type="button"
            whileHover={{ y: -1 }}
            onClick={() => onSelect(item.id)}
            className={`w-full rounded-2xl border p-3 text-left transition ${
              item.id === activeItem.id
                ? "border-primary/40 bg-primary/10 shadow-soft"
                : "border-border/60 bg-muted/30 hover:bg-muted/50"
            }`}
            aria-pressed={item.id === activeItem.id}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-sm font-medium">{item.evidence.title}</div>
              {item.metadata.direction && <Navigation className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {item.evidence.excerpt ?? item.evidence.summary}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function isPublicTransportItem(item: TrafficMapEvidenceItem): boolean {
  return Boolean(
    item.metadata.transport_mode || item.metadata.route_or_line || item.metadata.station_or_stop,
  );
}

function SummaryLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-white/50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value || "Not stated"}</div>
    </div>
  );
}

function StatusBadge({ verdict }: { verdict: TrafficMapEvidenceItem["verdict"] }) {
  const className =
    verdict === "supported"
      ? "border-success/20 bg-success/10 text-success"
      : verdict === "refuted"
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : "border-warning/30 bg-warning/15 text-warning-foreground";

  return (
    <Badge variant="outline" className={`rounded-full ${className}`}>
      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
      {getTrafficVerdictLabel(verdict)}
    </Badge>
  );
}

function formatOptionalTime(value: string | null, formatTime: (value: string) => string): string {
  return value ? formatTime(value) : "Not stated";
}
