import { createServerFn } from "@tanstack/react-start";
import type { PhaseOneEvidence } from "./report-contract";
import {
  retrieveCurrentTrafficSnapshot,
  type TrafficSourceSnapshot,
} from "./traffic-sources";

export interface TrafficTestFeedResponse {
  retrievedAt: string;
  officialUpdatedAt?: string;
  endpointLabel: string;
  recordsRetrieved: number;
  parsedRecordsAvailable: number;
  records: TrafficTestRecord[];
}

export interface TrafficTestRecord {
  id: string;
  title: string;
  freshness?: string;
  eventType?: string;
  currentStatus?: string;
  roadName?: string;
  direction?: string;
  nearbyLandmark?: string;
  district?: string;
  scope?: string;
  cause?: string;
  transportMode?: string;
  stationOrStop?: string;
  routeOrLine?: string;
  serviceStatus?: string;
  officialUpdatedAt?: string;
}

export type TrafficGeneratedClaims = {
  supported?: string;
  refuted?: string;
  refutedUnavailableReason?: string;
};

export function getGeneratedSemanticField(
  record: TrafficTestRecord,
  kind: "supported" | "refuted",
): string {
  if (kind === "supported") {
    if (record.currentStatus === "reopened") return "current_status:reopened";
    if (record.currentStatus === "closed") return "current_status:closed";
    if (record.eventType === "traffic_congestion") return "event_type:traffic_congestion";
    if (record.serviceStatus) return `service_status:${record.serviceStatus}`;
    if (record.cause) return "cause";
    return "record_fields";
  }

  if (record.currentStatus) return `current_status:${record.currentStatus}`;
  if (record.cause) return "cause";
  if (record.scope) return "scope";
  if (record.direction) return "direction";
  if (record.serviceStatus) return `service_status:${record.serviceStatus}`;
  return "record_fields";
}

export const loadTrafficTestFeed = createServerFn({ method: "GET" }).handler(async () => {
  const snapshot = await retrieveCurrentTrafficSnapshot();
  return buildTrafficTestFeedResponse(snapshot);
});

export function buildTrafficTestFeedResponse(
  snapshot: TrafficSourceSnapshot,
): TrafficTestFeedResponse {
  const primaryFreshness = snapshot.freshness[0];
  const records = snapshot.evidence.map(toTrafficTestRecord).filter(Boolean);

  return {
    retrievedAt: primaryFreshness?.retrieved_at ?? new Date().toISOString(),
    officialUpdatedAt: primaryFreshness?.updated_at ?? undefined,
    endpointLabel: primaryFreshness?.source_name ?? "Transport Department Special Traffic News",
    recordsRetrieved: snapshot.itemsFetched,
    parsedRecordsAvailable: records.length,
    records,
  };
}

export function generateTrafficTestClaims(record: TrafficTestRecord): TrafficGeneratedClaims {
  const supported = buildSupportedClaim(record);
  const refuted = buildRefutedClaim(record);

  return {
    supported,
    refuted,
    refutedUnavailableReason: refuted
      ? undefined
      : "A reliable refuted example is not available for this record.",
  };
}

function toTrafficTestRecord(evidence: PhaseOneEvidence): TrafficTestRecord {
  const metadata = evidence.traffic_metadata;
  return omitEmpty({
    id: evidence.id,
    title: evidence.title,
    freshness: evidence.freshness,
    eventType: metadata?.event_type ?? evidence.category,
    currentStatus: metadata?.current_status,
    roadName: metadata?.road_name,
    direction: metadata?.direction,
    nearbyLandmark: metadata?.nearby_landmark,
    district: metadata?.district,
    scope: metadata?.scope,
    cause: metadata?.cause,
    transportMode: metadata?.transport_mode,
    stationOrStop: metadata?.station_or_stop,
    routeOrLine: metadata?.route_or_line,
    serviceStatus: metadata?.service_status,
    officialUpdatedAt: evidence.updated_at ?? undefined,
  });
}

function buildSupportedClaim(record: TrafficTestRecord): string | undefined {
  if (isPublicTransportRecord(record)) {
    return buildPublicTransportSupportedClaim(record);
  }

  if (record.eventType === "traffic_congestion") {
    const prefix = isStaleRecord(record)
      ? "According to the latest available Transport Department update, traffic was busy"
      : "Traffic is currently busy";
    return withPeriod(
      [prefix, buildRoadLocation(record), buildDirectionPhrase(record)]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (record.currentStatus === "reopened") {
    const statusPhrase = isStaleRecord(record) ? "had reopened to traffic" : "have reopened to traffic";
    return withPeriod(
      [capitalizeFirst(buildScopeSubject(record)), buildRoadLocation(record), statusPhrase]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (
    record.currentStatus === "closed" ||
    record.eventType === "lane_closure" ||
    record.eventType === "road_closure"
  ) {
    const statusPhrase = isStaleRecord(record) ? "were closed" : "are currently closed";
    return withPeriod(
      [capitalizeFirst(buildScopeSubject(record)), buildRoadLocation(record), statusPhrase]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (record.cause && record.roadName) {
    return withPeriod(
      `The traffic restriction on ${buildRoadIdentity(record)} was caused by ${articleFor(
        record.cause,
      )} ${record.cause.toLowerCase()}`,
    );
  }

  return undefined;
}

function buildRefutedClaim(record: TrafficTestRecord): string | undefined {
  if (record.eventType === "traffic_congestion" && record.roadName) {
    return withPeriod(`Traffic is flowing normally ${buildRoadLocation(record)}`);
  }

  if (record.currentStatus === "reopened") {
    return withPeriod(
      [capitalizeFirst(buildScopeSubject(record)), buildRoadLocation(record), "remain closed"]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (record.currentStatus === "closed") {
    return withPeriod(
      [capitalizeFirst(buildScopeSubject(record)), buildRoadLocation(record), "have reopened to traffic"]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (record.cause && record.roadName) {
    const contradictionCause = normalizedCause(record.cause) === "road works" ? "a traffic accident" : "road works";
    return withPeriod(
      `The traffic restriction on ${buildRoadIdentity(record)} was caused by ${contradictionCause}`,
    );
  }

  if (
    record.scope === "part_of_lanes" &&
    record.roadName &&
    (record.eventType === "lane_closure" || record.eventType === "road_closure")
  ) {
    return withPeriod(`All lanes of ${record.roadName} are closed`);
  }

  if (isPublicTransportRecord(record)) {
    if (isActiveServiceDisruption(record.serviceStatus)) {
      return withPeriod(`${buildPublicTransportSubject(record)} is operating normally`);
    }
    if (record.serviceStatus === "normal" || record.serviceStatus === "resumed" || record.serviceStatus === "resuming") {
      return withPeriod(`${buildPublicTransportSubject(record)} is currently suspended`);
    }
  }

  return undefined;
}

function buildPublicTransportSupportedClaim(record: TrafficTestRecord): string | undefined {
  const subject = buildPublicTransportSubject(record);
  if (!subject) return undefined;

  if (record.serviceStatus === "suspended") {
    return withPeriod(`${subject} is currently suspended`);
  }
  if (record.serviceStatus === "delayed") {
    return withPeriod(`${subject} is currently delayed`);
  }
  if (record.serviceStatus === "resumed" || record.serviceStatus === "resuming") {
    return withPeriod(`${subject} has resumed`);
  }
  if (record.serviceStatus === "normal") {
    return withPeriod(`${subject} is operating normally`);
  }
  if (record.serviceStatus === "disrupted" || record.eventType === "public_transport_disruption") {
    return withPeriod(`${subject} is experiencing a service disruption`);
  }
  return undefined;
}

function buildPublicTransportSubject(record: TrafficTestRecord): string {
  const route = record.routeOrLine ?? record.transportMode;
  const station = record.stationOrStop ? ` near ${record.stationOrStop}` : "";
  return route ? `${route} service${station}` : `Public transport service${station}`;
}

function buildRoadLocation(record: TrafficTestRecord): string {
  if (!record.roadName && !record.nearbyLandmark) return "";
  const road = record.roadName ? `on ${record.roadName}` : "";
  const landmark = record.nearbyLandmark ? `near ${record.nearbyLandmark}` : "";
  return [road, landmark].filter(Boolean).join(" ");
}

function buildRoadIdentity(record: TrafficTestRecord): string {
  return [record.roadName, record.nearbyLandmark ? `near ${record.nearbyLandmark}` : ""]
    .filter(Boolean)
    .join(" ");
}

function buildDirectionPhrase(record: TrafficTestRecord): string {
  return record.direction ? `in the ${record.direction} direction` : "";
}

function buildScopeSubject(record: TrafficTestRecord): string {
  if (record.scope === "part_of_lanes") return "part of the lanes";
  if (record.scope === "one_lane") return "one lane";
  if (record.scope === "all_lanes") return "all lanes";
  if (record.scope === "complete_road") return "the entire road";
  return record.eventType === "road_closure" ? "the road" : "the affected lanes";
}

function isPublicTransportRecord(record: TrafficTestRecord): boolean {
  return Boolean(record.transportMode || record.routeOrLine || record.stationOrStop || record.eventType?.startsWith("public_transport"));
}

function isActiveServiceDisruption(status: string | undefined): boolean {
  return ["disrupted", "suspended", "delayed", "adjusted", "cancelled"].includes(status ?? "");
}

function isStaleRecord(record: TrafficTestRecord): boolean {
  return record.freshness === "stale";
}

function omitEmpty<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""),
  ) as T;
}

function withPeriod(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

function capitalizeFirst(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function normalizedCause(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").trim();
}

function articleFor(value: string): "a" | "an" {
  return /^[aeiou]/i.test(value.trim()) ? "an" : "a";
}
