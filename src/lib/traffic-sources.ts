import type {
  EvidenceCoverage,
  OfficialSourceKey,
  PhaseOneClaim,
  PhaseOneEvidence,
  ReportVerdict,
  SourceFreshness,
  TrafficGenerationMetadata,
} from "./report-contract";
import {
  buildTrafficScopePhrase,
  buildTransportVerdictExplanation,
} from "./report-display";

export type TrafficClaimCategory =
  | "current_road_closure"
  | "current_lane_closure"
  | "road_reopened"
  | "traffic_congestion"
  | "traffic_diversion"
  | "public_transport_disruption"
  | "public_transport_normal"
  | "public_transport_resumed"
  | "public_transport_cause_claim"
  | "future_traffic_arrangement"
  | "vague_traffic_claim"
  | "non_traffic";

export type TrafficSourceSnapshot = {
  evidence: PhaseOneEvidence[];
  freshness: TrafficSourceFreshness[];
  itemsFetched: number;
  sourceKeys: OfficialSourceKey[];
  endpointKeys: string[];
};

export type TrafficSourceFreshness = {
  source_key: OfficialSourceKey;
  source_name: string;
  freshness: SourceFreshness;
  retrieved_at: string;
  updated_at: string | null;
  message: string;
};

export type TrafficEvaluation = PhaseOneClaim & {
  coverage?: EvidenceCoverage;
};

type TrafficBundle = {
  current?: TrafficSourceSnapshot;
  planned?: TrafficSourceSnapshot;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type TrafficEntity = {
  roads: string[];
  districts: string[];
  directions: string[];
  landmarks: string[];
  closureScope: ClosureScope;
  currentStatus: TrafficCurrentStatus;
  cause?: TrafficCause | string;
  eventTypes: TrafficEvidenceCategory[];
  transportMode?: NonNullable<PhaseOneEvidence["traffic_metadata"]>["transport_mode"];
  routeOrLine?: string;
  stationOrStop?: string;
  serviceStatus?: NonNullable<PhaseOneEvidence["traffic_metadata"]>["service_status"];
  isFuture: boolean;
  isCurrent: boolean;
};

export type TrafficCause =
  | "traffic_accident"
  | "road_works"
  | "vehicle_breakdown"
  | "police_operation"
  | "special_event"
  | "flooding"
  | "landslide"
  | "unknown";

type ClosureScope =
  | "unknown"
  | "one_lane"
  | "some_lanes"
  | "partial"
  | "all_lanes"
  | "complete_road";

type ScopeAssessment = {
  status: "sufficient" | "insufficient" | "contradiction";
  reason: string;
};

type TrafficEvidenceCategory =
  | "road_closure"
  | "lane_closure"
  | "road_reopened"
  | "traffic_congestion"
  | "traffic_diversion"
  | "public_transport_disruption"
  | "public_transport_resumed"
  | "planned_traffic_arrangement";

type TrafficCurrentStatus = "closed" | "reopened" | "unknown";
type PublicTransportServiceStatus =
  NonNullable<PhaseOneEvidence["traffic_metadata"]>["service_status"];

type TrafficEventState = {
  currentStatus: TrafficCurrentStatus;
  historicalPhrases: string[];
  currentPhrases: string[];
};

type TrafficXmlIncident = {
  incidentNumber: string;
  heading: string;
  detail: string;
  location: string;
  district: string;
  direction: string;
  nearLandmark: string;
  betweenLandmark: string;
  announcementDate: string | null;
  status: string;
  content: string;
  latitude: string;
  longitude: string;
};

export type TrafficCandidateDiagnostics = {
  score: number;
  title: string;
  roadMatch: boolean;
  districtMatch: boolean;
  directionMatch: boolean;
  eventTypeMatch: boolean;
  normalizedRoadNames: {
    claim: string[];
    evidence: string[];
  };
  normalizedDistrict: {
    claim: string[];
    evidence: string[];
  };
  normalizedDirections: {
    claim: string[];
    evidence: string[];
  };
  normalizedLandmarks: {
    claim: string[];
    evidence: string[];
  };
  closureScope: {
    claim: ClosureScope;
    evidence: ClosureScope;
  };
  eventState: {
    historicalPhrases: string[];
    currentPhrases: string[];
    selectedCurrentState: TrafficCurrentStatus;
  };
  scopeMatch: boolean;
  rejectionReason: string;
  contradictionDecision: string;
};

type ScoredEvidence = {
  item: PhaseOneEvidence;
  score: number;
  category: TrafficEvidenceCategory | null;
  scopeAssessment: ScopeAssessment;
  diagnostics: TrafficCandidateDiagnostics;
};

const TD_SPECIAL_NEWS_URL =
  process.env.TD_SPECIAL_NEWS_URL || "https://www.td.gov.hk/en/special_news/spnews.htm";
const TD_SPECIAL_NEWS_XML_URL =
  process.env.TD_SPECIAL_NEWS_XML_URL || "https://www.td.gov.hk/en/special_news/trafficnews.xml";
const TD_SPECIAL_NEWS_RSS_URL =
  process.env.TD_SPECIAL_NEWS_RSS_URL || "https://www.td.gov.hk/en/special_news/spnews_rss.xml";
const TD_TRAFFIC_NOTICES_RSS_URL =
  process.env.TD_TRAFFIC_NOTICES_RSS_URL ||
  "https://www.td.gov.hk/filemanager/rss/en/traffic_notices.xml";

const TRAFFIC_CURRENT_MAX_AGE_MINUTES = Number(process.env.TRAFFIC_CURRENT_MAX_AGE_MINUTES || 30);
const TRAFFIC_NOTICE_RECENT_DAYS = Number(process.env.TRAFFIC_NOTICE_RECENT_DAYS || 14);
const TRAFFIC_CACHE_MS = Number(process.env.TRAFFIC_CACHE_MS || 60 * 1000);
const CURRENT_TRAFFIC_THRESHOLD = 8;
const PLANNED_TRAFFIC_THRESHOLD = 8;
const PUBLIC_TRANSPORT_THRESHOLD = 9;

const DISTRICTS = [
  "kowloon",
  "causeway bay",
  "wan chai",
  "central",
  "admiralty",
  "mong kok",
  "tsim sha tsui",
  "yau ma tei",
  "kwun tong",
  "sham shui po",
  "sha tin",
  "yuen long",
  "tuen mun",
  "tai po",
  "north point",
  "hung hom",
  "ho man tin",
];

const DIRECTION_TERMS = [
  "northbound",
  "southbound",
  "eastbound",
  "westbound",
  "inbound",
  "outbound",
  "tsim sha tsui bound",
  "kowloon bound",
  "hong kong bound",
  "central bound",
  "airport bound",
];

const MTR_LINE_NAMES = [
  "tseung kwan o line",
  "kwun tong line",
  "tsuen wan line",
  "island line",
  "east rail line",
  "tuen ma line",
  "south island line",
  "tung chung line",
  "airport express",
  "disneyland resort line",
];

let currentTrafficCache: CacheEntry<TrafficSourceSnapshot> | null = null;
let plannedTrafficCache: CacheEntry<TrafficSourceSnapshot> | null = null;

export async function retrieveTrafficEvidence(
  claims: PhaseOneClaim[],
): Promise<TrafficSourceSnapshot | undefined> {
  const routes = getRequiredTrafficRoutes(claims);
  const [current, planned] = await Promise.all([
    routes.current ? getCachedCurrentTraffic() : Promise.resolve(undefined),
    routes.planned ? getCachedPlannedTraffic() : Promise.resolve(undefined),
  ]);
  return mergeTrafficSnapshots([current, planned].filter(Boolean) as TrafficSourceSnapshot[]);
}

export function evaluateTrafficClaimWithSources(
  claim: PhaseOneClaim,
  snapshot: TrafficSourceSnapshot | undefined,
  generationMetadata?: TrafficGenerationMetadata,
): TrafficEvaluation {
  const category = classifyTrafficClaim(claim.text);
  if (category === "non_traffic") {
    return withTrafficVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.45,
      "This claim is not a traffic claim supported by the current Transport Department verification module.",
      "Treat this as preliminary analysis only.",
      "none",
    );
  }

  const source = snapshot ?? emptyTrafficSnapshot();
  if (!source.freshness.some((item) => item.freshness === "fresh")) {
    const freshnessState = getTrafficFreshnessState(source);
    return withTrafficVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.45,
      freshnessState === "stale_with_records"
        ? "The latest retrieved Transport Department update may be outdated."
        : "The Transport Department source could not be retrieved.",
      freshnessState === "stale_with_records"
        ? "Verify again before relying on this event, or check the Transport Department source directly."
        : "Retry later or check the Transport Department source directly.",
      "none",
    );
  }

  const threshold = thresholdForTrafficCategory(category);
  const candidates = source.evidence
    .map((item) => scoreTrafficEvidenceForClaim(item, claim.text, category))
    .sort((a, b) => b.score - a.score);
  logTrafficCandidateDiagnostics(claim.text, category, candidates.slice(0, 10), threshold);

  const scored = candidates
    .filter(({ item }) => isTrafficEvidenceAllowedForClaim(item, category))
    .filter(({ item }) => item.freshness === "fresh")
    .filter(({ category: evidenceCategory }) =>
      isTrafficEventRelevantForClaim(category, evidenceCategory),
    )
    .filter(({ score }) => score >= threshold)
    .slice(0, 3);
  const evidence = scored.map(({ item, score }) => ({ ...item, relevance_score: score }));

  return buildTrafficVerdict(claim, category, scored, evidence, source, generationMetadata);
}

export function getTrafficCandidateDebugReport(
  claimText: string,
  snapshot: TrafficSourceSnapshot,
): TrafficCandidateDiagnostics[] {
  const category = classifyTrafficClaim(claimText);
  if (category === "non_traffic") return [];
  const threshold = thresholdForTrafficCategory(category);
  return snapshot.evidence
    .map((item) => scoreTrafficEvidenceForClaim(item, claimText, category))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((candidate) =>
      withTrafficRejectionReason(candidate, category, threshold).diagnostics,
    );
}

export function classifyTrafficClaim(text: string): TrafficClaimCategory {
  const value = normalizeText(text);
  const eventState = detectTrafficEventState(text);
  const trafficLike =
    /(road|rd|street|st|lane|traffic|closed|closure|reopen|reopened|diversion|congest|busy|queue|bus|mtr|tram|ferry|route|transport|service|station|train|rail|line|kowloon|causeway|princess margaret|pui ching)/.test(
      value,
    );
  if (!trafficLike) return "non_traffic";
  if (isPublicTransportText(value)) {
    if (/(caused by|cause is|due to|because of|technical fault|train fault)/.test(value)) {
      return "public_transport_cause_claim";
    }
    if (/(incident is now over|incident has been cleared|service is resuming|back to normal|gradually returning to normal|normal service has resumed|service has resumed|returned to normal)/.test(value)) {
      return "public_transport_resumed";
    }
    if (isNormalServiceText(value)) return "public_transport_normal";
    return "public_transport_disruption";
  }
  if (/(tomorrow|later|next|planned|arrangement|will|temporary traffic arrangement)/.test(value)) {
    return "future_traffic_arrangement";
  }
  if (eventState.currentStatus === "reopened") return "road_reopened";
  if (/(lane|lanes).*(closed|closure)|closed.*(lane|lanes)/.test(value)) {
    return "current_lane_closure";
  }
  if (/(closed|closure|closed to traffic|blocked)/.test(value)) return "current_road_closure";
  if (/(diversion|diverted|traffic diversion)/.test(value)) return "traffic_diversion";
  if (/(busy|congest|traffic queue|queue)/.test(value)) return "traffic_congestion";
  return "vague_traffic_claim";
}

export function getRequiredTrafficRoutes(claims: PhaseOneClaim[]): {
  current: boolean;
  planned: boolean;
} {
  let current = false;
  let planned = false;
  for (const claim of claims) {
    const category = classifyTrafficClaim(claim.text);
    if (category === "future_traffic_arrangement") planned = true;
    else if (category !== "non_traffic") current = true;
  }
  return { current, planned };
}

async function getCachedCurrentTraffic(): Promise<TrafficSourceSnapshot> {
  if (currentTrafficCache && currentTrafficCache.expiresAt > Date.now()) {
    return currentTrafficCache.value;
  }
  const value = await fetchCurrentTraffic();
  currentTrafficCache = { expiresAt: Date.now() + TRAFFIC_CACHE_MS, value };
  return value;
}

export async function retrieveCurrentTrafficSnapshot(): Promise<TrafficSourceSnapshot> {
  return getCachedCurrentTraffic();
}

async function getCachedPlannedTraffic(): Promise<TrafficSourceSnapshot> {
  if (plannedTrafficCache && plannedTrafficCache.expiresAt > Date.now()) {
    return plannedTrafficCache.value;
  }
  const value = await fetchPlannedTraffic();
  plannedTrafficCache = { expiresAt: Date.now() + TRAFFIC_CACHE_MS, value };
  return value;
}

async function fetchCurrentTraffic(): Promise<TrafficSourceSnapshot> {
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(TD_SPECIAL_NEWS_XML_URL, {
      headers: { accept: "application/xml, text/xml" },
    });
    if (!response.ok) throw new Error("Special Traffic News XML unavailable");
    const snapshot = tdSnapshotFromXml(await response.text(), retrievedAt);
    if (snapshot.evidence.length || snapshot.freshness[0]?.freshness === "fresh") {
      return snapshot;
    }
  } catch (error) {
    logTrafficSourceParsing("xml_fallback", { reason: errorMessage(error) });
  }

  try {
    const response = await fetch(TD_SPECIAL_NEWS_URL, { headers: { accept: "text/html" } });
    if (response.ok) {
      return tdSnapshotFromHtml(await response.text(), retrievedAt);
    }
  } catch (error) {
    logTrafficSourceParsing("html_fallback", { reason: errorMessage(error) });
    // Fall through to official RSS fallback.
  }

  try {
    const response = await fetch(TD_SPECIAL_NEWS_RSS_URL, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!response.ok) throw new Error("Special Traffic News RSS unavailable");
    return tdSnapshotFromRss(
      await response.text(),
      retrievedAt,
      TD_SPECIAL_NEWS_RSS_URL,
      "Transport Department Special Traffic News RSS",
      "td:special_news_rss",
      false,
    );
  } catch {
    return unavailableTrafficSnapshot(
      retrievedAt,
      "Transport Department Special Traffic News unavailable.",
      "td:special_news",
    );
  }
}

async function fetchPlannedTraffic(): Promise<TrafficSourceSnapshot> {
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(TD_TRAFFIC_NOTICES_RSS_URL, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!response.ok) throw new Error("Traffic Notices RSS unavailable");
    return tdSnapshotFromRss(
      await response.text(),
      retrievedAt,
      TD_TRAFFIC_NOTICES_RSS_URL,
      "Transport Department Traffic Notices RSS",
      "td:traffic_notices_rss",
      true,
    );
  } catch {
    return unavailableTrafficSnapshot(
      retrievedAt,
      "Transport Department Traffic Notices RSS unavailable.",
      "td:traffic_notices_rss",
    );
  }
}

export function tdSnapshotFromHtml(html: string, retrievedAt: string): TrafficSourceSnapshot {
  const updatedAt = parseTrafficDate(extractTdTimestamp(html));
  const items = extractCurrentTrafficItemsFromHtml(html, retrievedAt, updatedAt);
  const freshness =
    updatedAt && isOlderThanMinutes(updatedAt, TRAFFIC_CURRENT_MAX_AGE_MINUTES) ? "stale" : "fresh";

  return {
    evidence: dedupeTrafficEvidence(items.map((item) => ({ ...item, freshness }))),
    freshness: [
      {
        source_key: "td",
        source_name: "Transport Department Special Traffic News",
        freshness,
        retrieved_at: retrievedAt,
        updated_at: updatedAt,
        message: "Fetched Transport Department Special Traffic News live page.",
      },
    ],
    itemsFetched: items.length,
    sourceKeys: ["td"],
    endpointKeys: ["td:special_news"],
  };
}

export function tdSnapshotFromXml(xml: string, retrievedAt: string): TrafficSourceSnapshot {
  if (!/<list\b/i.test(xml)) {
    throw new Error("Transport Department XML root <list> not found");
  }
  const incidents = parseTrafficXmlIncidents(xml);
  if (!incidents.length && /<message\b/i.test(xml)) {
    throw new Error("Transport Department XML messages could not be parsed");
  }
  const items = incidents.map((incident, index) =>
    {
      const searchable = [incident.heading, incident.location, incident.nearLandmark, incident.content].join(
        " ",
      );
      const category = inferTrafficCategory(searchable, "");
      const titleSearchable =
        category === "public_transport_disruption" || category === "public_transport_resumed"
          ? [incident.location, incident.content].join(" ")
          : [incident.location, incident.nearLandmark, incident.content].join(" ");
      return trafficEvidence({
        id: `td-special-${incident.incidentNumber || hashStable(incident.content || String(index))}`,
        sourceType: "government_webpage",
        category,
        title: inferTrafficTitle(titleSearchable, index),
        summary: incident.content,
        url: TD_SPECIAL_NEWS_XML_URL,
        publishedAt: null,
        updatedAt: incident.announcementDate,
        retrievedAt,
        metadata: buildStructuredTrafficMetadata(incident),
      });
    },
  );
  const latestUpdatedAt = latestIso(items.map((item) => item.updated_at));
  const freshness =
    latestUpdatedAt && isOlderThanMinutes(latestUpdatedAt, TRAFFIC_CURRENT_MAX_AGE_MINUTES)
      ? "stale"
      : "fresh";

  logTrafficSourceParsing("xml_records", {
    grouping: "one <message> element becomes one Transport evidence record",
    records: items.map((item) => ({
      id: item.id,
      title: item.title,
      metadata: item.traffic_metadata,
    })),
  });

  return {
    evidence: dedupeTrafficEvidence(items.map((item) => ({ ...item, freshness }))),
    freshness: [
      {
        source_key: "td",
        source_name: "Transport Department Special Traffic News XML",
        freshness,
        retrieved_at: retrievedAt,
        updated_at: latestUpdatedAt,
        message: "Fetched Transport Department Special Traffic News v2 XML.",
      },
    ],
    itemsFetched: items.length,
    sourceKeys: ["td"],
    endpointKeys: ["td:special_news_xml"],
  };
}

export function tdSnapshotFromRss(
  xml: string,
  retrievedAt: string,
  sourceUrl: string,
  sourceName: string,
  endpointKey: string,
  planned: boolean,
): TrafficSourceSnapshot {
  const items = dedupeTrafficRssItems(parseTrafficRssItems(xml))
    .filter((item) => !item.published_at || isWithinRecentDays(item.published_at))
    .map((item, index) =>
      trafficEvidence({
        id: `td-rss-${hashStable(item.guid || item.url || `${item.title}-${index}`)}`,
        sourceType: "government_rss",
        category: planned
          ? "planned_traffic_arrangement"
          : inferTrafficCategory(item.title, item.description),
        title: item.title,
        summary: item.description,
        url: item.url || sourceUrl,
        publishedAt: item.published_at,
        updatedAt: item.published_at,
        retrievedAt,
      }),
    );
  const latestPublishedAt = latestIso(items.map((item) => item.published_at));

  return {
    evidence: dedupeTrafficEvidence(items),
    freshness: [
      {
        source_key: "td",
        source_name: sourceName,
        freshness: latestPublishedAt && !isWithinRecentDays(latestPublishedAt) ? "stale" : "fresh",
        retrieved_at: retrievedAt,
        updated_at: latestPublishedAt,
        message: "Fetched latest Transport Department RSS items at verification time.",
      },
    ],
    itemsFetched: items.length,
    sourceKeys: ["td"],
    endpointKeys: [endpointKey],
  };
}

function extractCurrentTrafficItemsFromHtml(
  html: string,
  retrievedAt: string,
  updatedAt: string | null,
): PhaseOneEvidence[] {
  const listItemMatches = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
  const chunks = listItemMatches.length
    ? listItemMatches.map((match) => normalizeTrafficText(match[1]))
    : extractCurrentTrafficItemsFromText(stripHtml(html).replace(/\s+/g, " ").trim());

  logTrafficSourceParsing("html_records", {
    grouping: listItemMatches.length
      ? "one <li> element becomes one Transport evidence record"
      : "numbered text fallback grouping",
    recordCount: chunks.length,
    records: chunks.map((chunk, index) => ({ index: index + 1, text: truncate(chunk, 180) })),
  });

  return chunks
    .filter((chunk) => chunk.length > 12)
    .slice(0, 30)
    .map((chunk, index) =>
      trafficEvidence({
        id: `td-special-${index + 1}`,
        sourceType: "government_webpage",
        category: inferTrafficCategory(chunk, ""),
        title: inferTrafficTitle(chunk, index),
        summary: chunk,
        url: TD_SPECIAL_NEWS_URL,
        publishedAt: null,
        updatedAt,
        retrievedAt,
      }),
    );
}

function extractCurrentTrafficItemsFromText(text: string): string[] {
  const withoutHeader = text
    .replace(/Special Traffic News/i, " ")
    .replace(/Transport Department has launched the "HKeMobility"[\s\S]*?App Store\./gi, " ");
  const matches = [...withoutHeader.matchAll(/\b\d+\.\s+(.+?)(?=\s+\d+\.|$)/g)];
  return matches.length
    ? matches.map((match) => normalizeTrafficText(match[1]))
    : splitTrafficSentences(withoutHeader).map(normalizeTrafficText);
}

function buildTrafficVerdict(
  claim: PhaseOneClaim,
  category: TrafficClaimCategory,
  scored: ScoredEvidence[],
  evidence: PhaseOneEvidence[],
  source?: TrafficSourceSnapshot,
  generationMetadata?: TrafficGenerationMetadata,
): TrafficEvaluation {
  const best = scored[0];
  const bestCategory = best?.category;

  if (
    best &&
    isClosureClaimCategory(category) &&
    best.scopeAssessment.status === "insufficient"
  ) {
    return withTrafficVerdict(
      claim,
      "insufficient_evidence",
      evidence,
      0.64,
      best.scopeAssessment.reason,
      "Check the full Transport Department notice before treating this broader closure claim as established.",
      evidence.length ? "medium" : "low",
    );
  }

  if (
    best &&
    isClosureClaimCategory(category) &&
    best.scopeAssessment.status === "contradiction"
  ) {
    return withTrafficVerdict(
      claim,
      "refuted",
      evidence,
      0.84,
      best.scopeAssessment.reason,
      "Treat the stronger closure claim as refuted unless a newer Transport Department notice says otherwise.",
      "high",
    );
  }

  if (
    (category === "current_road_closure" || category === "current_lane_closure") &&
    bestCategory === "road_reopened"
  ) {
    const matchedEvidence = evidence[0] ?? best.item;
    return withTrafficVerdict(
      claim,
      "refuted",
      evidence,
      0.88,
      buildTransportVerdictExplanation({
        claim,
        verdict: "refuted",
        evidence: matchedEvidence,
        trafficMetadata: matchedEvidence.traffic_metadata,
      }),
      "Treat the closure claim as refuted for the current Transport Department update. Check again if conditions are changing.",
      "high",
    );
  }

  if (
    (category === "current_road_closure" || category === "current_lane_closure") &&
    (bestCategory === "road_closure" || bestCategory === "lane_closure")
  ) {
    return withTrafficVerdict(
      claim,
      "supported",
      evidence,
      0.9,
      "The Transport Department currently reports that part of the road or lanes at the specified location are closed to traffic.",
      "Follow the latest Transport Department notice and allow extra travel time.",
      "high",
    );
  }

  if (category === "road_reopened" && bestCategory === "road_reopened") {
    return withTrafficVerdict(
      claim,
      "supported",
      evidence,
      0.9,
      "The latest Transport Department update states that the specified road or lanes have reopened.",
      "Treat the reopening claim as supported by the current Transport Department update.",
      "high",
    );
  }

  if (
    category === "road_reopened" &&
    (bestCategory === "road_closure" || bestCategory === "lane_closure")
  ) {
    return withTrafficVerdict(
      claim,
      "refuted",
      evidence,
      0.86,
      "The matching Transport Department item still reports an active closure rather than a reopening.",
      "Treat the reopening claim as refuted until Transport Department reports that the road has reopened.",
      "high",
    );
  }

  if (category === "traffic_congestion" && bestCategory === "traffic_congestion") {
    const causeAssessment = assessTrafficCauseForClaim(claim, evidence[0] ?? best.item);
    if (causeAssessment.status === "missing") {
      return withTrafficVerdict(
        claim,
        "insufficient_evidence",
        evidence,
        0.66,
        `The claim attributes the disruption to ${causeAssessment.claimCauseLabel}, but the matched Transport Department notice does not state a reliable cause. More evidence is required.`,
        "Check the latest Transport Department update before relying on the claimed cause.",
        "low",
      );
    }
    if (causeAssessment.status === "conflict") {
      return withTrafficVerdict(
        claim,
        "refuted",
        evidence,
        0.82,
        `The claim attributes the busy traffic to ${causeAssessment.claimCauseLabel}, but the latest Transport Department notice states that it is due to ${causeAssessment.evidenceCauseLabel}. Therefore, the claim is refuted.`,
        "Use the cause stated in the latest Transport Department update.",
        "high",
      );
    }
    if (causeAssessment.status === "match") {
      return withTrafficVerdict(
        claim,
        "supported",
        evidence,
        0.84,
        `The latest Transport Department notice states that the busy traffic on ${causeAssessment.locationLabel} is due to ${causeAssessment.evidenceCauseLabel}. Therefore, the claim is supported.`,
        "Check the latest Transport Department update before travelling.",
        "high",
      );
    }

    return withTrafficVerdict(
      claim,
      "supported",
      evidence,
      0.84,
      "The Transport Department item explicitly reports busy or congested traffic at the specified location.",
      "Check the latest Transport Department update before travelling.",
      "high",
    );
  }

  if (category === "traffic_diversion" && bestCategory === "traffic_diversion") {
    return withTrafficVerdict(
      claim,
      "supported",
      evidence,
      0.86,
      "The Transport Department item reports a traffic diversion at the specified location.",
      "Follow the latest Transport Department diversion notice.",
      "high",
    );
  }

  if (
    isPublicTransportClaimCategory(category) &&
    (bestCategory === "public_transport_disruption" || bestCategory === "public_transport_resumed")
  ) {
    const matchedEvidence = evidence[0] ?? best.item;
    const status = matchedEvidence.traffic_metadata?.service_status;
    const claimCause = extractTrafficEntities(claim.text).cause;
    const evidenceCause = matchedEvidence.traffic_metadata?.cause;

    if (category === "public_transport_cause_claim") {
      if (!claimCause || !evidenceCause) {
        return withTrafficVerdict(
          claim,
          "insufficient_evidence",
          evidence,
          0.66,
          "The current official update does not state that the incident was caused by a train technical fault.",
          "Check the latest Transport Department and operator updates before relying on the claimed cause.",
          "low",
        );
      }
      const causeScore = fuzzyTextScore(claimCause, evidenceCause);
      if (causeScore >= 0.82) {
        const displayCause = evidenceCause.toLowerCase();
        return withTrafficVerdict(
          claim,
          "supported",
          evidence,
          0.86,
          `The same official update states that the disruption is caused by a ${displayCause}.`,
          "Treat the stated disruption cause as supported by the latest Transport Department update.",
          "high",
        );
      }
      return withTrafficVerdict(
        claim,
        "refuted",
        evidence,
        0.82,
        "The matched Transport Department public transport notice states a different cause for this disruption.",
        "Use the cause stated in the latest Transport Department update.",
        "high",
      );
    }

    if (category === "public_transport_disruption" && publicTransportEventMatchesClaim(category, status)) {
      return withTrafficVerdict(
        claim,
        "supported",
        evidence,
        0.86,
        buildTransportVerdictExplanation({
          claim,
          verdict: "supported",
          evidence: evidence[0] ?? best.item,
          trafficMetadata: (evidence[0] ?? best.item).traffic_metadata,
        }),
        "Check the latest Transport Department and operator updates before travelling.",
        "high",
      );
    }
    if (
      category === "public_transport_disruption" &&
      publicTransportEventContradictsClaim(category, status)
    ) {
      return withTrafficVerdict(
        claim,
        "refuted",
        evidence,
        0.84,
        buildTransportVerdictExplanation({
          claim,
          verdict: "refuted",
          evidence: evidence[0] ?? best.item,
          trafficMetadata: (evidence[0] ?? best.item).traffic_metadata,
        }),
        "Treat the disruption claim as refuted for the latest Transport Department update.",
        "high",
      );
    }
    if (category === "public_transport_normal" && status === "resuming") {
      return withTrafficVerdict(
        claim,
        "insufficient_evidence",
        evidence,
        0.7,
        "The latest Transport Department update says service is returning to normal, but it does not state that normal service has fully resumed.",
        "Check the latest Transport Department and operator updates before travelling.",
        "medium",
      );
    }
    if (category === "public_transport_normal" && publicTransportEventContradictsClaim(category, status)) {
      return withTrafficVerdict(
        claim,
        "refuted",
        evidence,
        0.86,
        buildTransportVerdictExplanation({
          claim,
          verdict: "refuted",
          evidence: evidence[0] ?? best.item,
          trafficMetadata: (evidence[0] ?? best.item).traffic_metadata,
        }),
        "Do not rely on the normal-service claim until Transport Department reports that service has resumed.",
        "high",
      );
    }
    if (category === "public_transport_normal" && publicTransportEventMatchesClaim(category, status)) {
      return withTrafficVerdict(
        claim,
        "supported",
        evidence,
        0.84,
        buildTransportVerdictExplanation({
          claim,
          verdict: "supported",
          evidence: evidence[0] ?? best.item,
          trafficMetadata: (evidence[0] ?? best.item).traffic_metadata,
        }),
        "Treat the normal-service claim as supported by the latest Transport Department update.",
        "high",
      );
    }
    if (
      category === "public_transport_resumed" &&
      (status === "resuming" || status === "resumed" || status === "normal")
    ) {
      return withTrafficVerdict(
        claim,
        "supported",
        evidence,
        0.86,
        buildTransportVerdictExplanation({
          claim,
          verdict: "supported",
          evidence: evidence[0] ?? best.item,
          trafficMetadata: (evidence[0] ?? best.item).traffic_metadata,
        }),
        "Treat the resolved-incident claim as supported by the latest Transport Department update.",
        "high",
      );
    }
    if (
      category === "public_transport_resumed" &&
      publicTransportEventMatchesClaim("public_transport_disruption", status)
    ) {
      return withTrafficVerdict(
        claim,
        "refuted",
        evidence,
        0.84,
        "The latest Transport Department update still reports an active disruption, contradicting the claim that the incident is resolved.",
        "Check the latest Transport Department and operator updates before travelling.",
        "high",
      );
    }
    return withTrafficVerdict(
      claim,
      "insufficient_evidence",
      evidence,
      0.68,
      "The matched Transport Department public transport notice is relevant, but its current service status is not clear enough for a deterministic verdict.",
      "Check the operator and Transport Department updates before travelling.",
      "medium",
    );
  }

  if (category === "future_traffic_arrangement" && bestCategory === "planned_traffic_arrangement") {
    return withTrafficVerdict(
      claim,
      "supported",
      evidence,
      0.82,
      "The Transport Department traffic notice describes a planned traffic arrangement matching the claim.",
      "Review the attached Transport Department notice for the exact date, time and affected roads.",
      "high",
    );
  }

  return withTrafficVerdict(
    claim,
    "insufficient_evidence",
    evidence,
    evidence.length ? 0.68 : 0.58,
    getTrafficNoMatchExplanation(source, generationMetadata),
    "Check the latest Transport Department Special Traffic News or Traffic Notices before acting on this claim.",
    evidence.length ? "medium" : "low",
  );
}

function getTrafficFreshnessState(
  source: TrafficSourceSnapshot,
): "stale_with_records" | "unavailable_or_empty" {
  const hasRecords = source.itemsFetched > 0 || source.evidence.length > 0;
  const stale = source.freshness.some((item) => item.freshness === "stale");
  return hasRecords && stale ? "stale_with_records" : "unavailable_or_empty";
}

function getTrafficNoMatchExplanation(
  source: TrafficSourceSnapshot | undefined,
  generationMetadata: TrafficGenerationMetadata | undefined,
): string {
  if (generationMetadata && source) {
    const recordExists = source.evidence.some((item) => item.id === generationMetadata.sourceRecordId);
    if (!recordExists) {
      return "The official event used to create this example was not present in the latest Transport Department feed. The event may have been updated, resolved or removed between generation and verification.";
    }
    return "The official event used to create this example is still present in the latest Transport Department feed, but it did not semantically match the full submitted claim.";
  }

  if ((source?.itemsFetched ?? 0) > 0 || (source?.evidence.length ?? 0) > 0) {
    return "The Transport Department feed was retrieved successfully, but no directly relevant current record matched this claim.";
  }

  return "The selected live Transport Department sources were checked, but no directly matching current notice was found. Absence from the feed does not prove the road is open.";
}

function scoreTrafficEvidenceForClaim(
  item: PhaseOneEvidence,
  claimText: string,
  claimCategory: TrafficClaimCategory,
): ScoredEvidence {
  const claimEntities = extractTrafficEntities(claimText);
  const evidenceText = `${item.excerpt ?? ""} ${item.summary}`;
  const evidenceEntities = extractTrafficEntities(evidenceText);
  const evidenceCategory = getEvidenceTrafficCategory(item);
  const scopeAssessment = assessClosureScope(claimEntities, evidenceEntities, claimCategory);

  if (isPublicTransportClaimCategory(claimCategory)) {
    return scorePublicTransportEvidenceForClaim(
      item,
      claimCategory,
      claimEntities,
      evidenceEntities,
      evidenceCategory,
      scopeAssessment,
    );
  }

  let score = 0;

  const roadMatch = bestFuzzyMatch(claimEntities.roads, evidenceEntities.roads);
  if (roadMatch.score >= 0.82) score += 9;
  else if (roadMatch.score >= 0.65) score += 6;
  else if (claimEntities.roads.length > 0) score -= 8;

  const eventMatch =
    eventMatchesClaim(claimCategory, evidenceCategory) ||
    eventContradictsClaim(claimCategory, evidenceCategory);
  if (eventMatch) score += 6;

  const directionMatch = bestFuzzyMatch(claimEntities.directions, evidenceEntities.directions);
  if (
    claimEntities.directions.length &&
    evidenceEntities.directions.length &&
    directionMatch.score < 0.82
  ) {
    score -= 10;
  } else if (claimEntities.directions.length && directionMatch.score < 0.82) {
    score -= 2;
  }

  if (directionMatch.score >= 0.82) score += 3;

  const isContradictingReopening =
    isClosureClaimCategory(claimCategory) && evidenceCategory === "road_reopened";
  if (scopeAssessment.status === "insufficient" && !isContradictingReopening) score -= 3;
  if (scopeAssessment.status === "contradiction") score += 2;

  const districtMatch = bestFuzzyMatch(claimEntities.districts, evidenceEntities.districts);
  if (districtMatch.score >= 0.82) score += 3;

  const landmarkMatch = bestFuzzyMatch(claimEntities.landmarks, evidenceEntities.landmarks);
  if (landmarkMatch.score >= 0.82) score += 3;

  if (claimEntities.isFuture === (item.category === "planned_traffic_arrangement")) score += 2;
  if (!claimEntities.roads.length && !claimEntities.landmarks.length) score -= 4;

  return {
    item,
    score,
    category: evidenceCategory,
    scopeAssessment,
    diagnostics: {
      score,
      title: item.title,
      roadMatch: roadMatch.score >= 0.65,
      districtMatch: districtMatch.score >= 0.82,
      directionMatch:
        !claimEntities.directions.length ||
        !evidenceEntities.directions.length ||
        directionMatch.score >= 0.82,
      eventTypeMatch: eventMatch,
      normalizedRoadNames: {
        claim: claimEntities.roads,
        evidence: evidenceEntities.roads,
      },
      normalizedDistrict: {
        claim: claimEntities.districts,
        evidence: evidenceEntities.districts,
      },
      normalizedDirections: {
        claim: claimEntities.directions,
        evidence: evidenceEntities.directions,
      },
      normalizedLandmarks: {
        claim: claimEntities.landmarks,
        evidence: evidenceEntities.landmarks,
      },
      closureScope: {
        claim: claimEntities.closureScope,
        evidence: evidenceEntities.closureScope,
      },
      eventState: {
        historicalPhrases: detectTrafficEventState(evidenceText).historicalPhrases,
        currentPhrases: detectTrafficEventState(evidenceText).currentPhrases,
        selectedCurrentState: evidenceEntities.currentStatus,
      },
      scopeMatch: scopeAssessment.status === "sufficient",
      rejectionReason: "passes_threshold",
      contradictionDecision: getTrafficContradictionDecision(claimCategory, evidenceCategory),
    },
  };
}

type TrafficCauseAssessment =
  | { status: "none" }
  | {
      status: "match" | "conflict" | "missing";
      claimCause: TrafficCause;
      evidenceCause?: TrafficCause;
      claimCauseLabel: string;
      evidenceCauseLabel?: string;
      locationLabel: string;
    };

function assessTrafficCauseForClaim(
  claim: PhaseOneClaim,
  evidence: PhaseOneEvidence,
): TrafficCauseAssessment {
  const claimCause = extractTrafficEntities(claim.text).cause;
  if (!isKnownTrafficCause(claimCause)) return { status: "none" };

  const evidenceCause = normalizeTrafficCause(evidence.traffic_metadata?.cause) ??
    normalizeTrafficCause(extractTrafficEntities(`${evidence.excerpt ?? ""} ${evidence.summary}`).cause);
  const locationLabel = buildTrafficCauseLocationLabel(evidence);
  const claimCauseLabel = trafficCauseLabel(claimCause);

  if (!evidenceCause || evidenceCause === "unknown") {
    return { status: "missing", claimCause, claimCauseLabel, locationLabel };
  }

  const evidenceCauseLabel = trafficCauseLabel(evidenceCause);
  if (claimCause !== evidenceCause) {
    return {
      status: "conflict",
      claimCause,
      evidenceCause,
      claimCauseLabel,
      evidenceCauseLabel,
      locationLabel,
    };
  }

  return {
    status: "match",
    claimCause,
    evidenceCause,
    claimCauseLabel,
    evidenceCauseLabel,
    locationLabel,
  };
}

function isKnownTrafficCause(value: string | undefined): value is TrafficCause {
  return (
    value === "traffic_accident" ||
    value === "road_works" ||
    value === "vehicle_breakdown" ||
    value === "police_operation" ||
    value === "special_event" ||
    value === "flooding" ||
    value === "landslide" ||
    value === "unknown"
  );
}

function buildTrafficCauseLocationLabel(evidence: PhaseOneEvidence): string {
  const metadata = evidence.traffic_metadata;
  if (metadata?.road_name && metadata.nearby_landmark) {
    return `${metadata.road_name} near ${metadata.nearby_landmark}`;
  }
  if (metadata?.road_name) return metadata.road_name;
  return "the matched location";
}

function scorePublicTransportEvidenceForClaim(
  item: PhaseOneEvidence,
  claimCategory: TrafficClaimCategory,
  claimEntities: TrafficEntity,
  evidenceEntities: TrafficEntity,
  evidenceCategory: TrafficEvidenceCategory | null,
  scopeAssessment: ScopeAssessment,
): ScoredEvidence {
  const metadata = item.traffic_metadata;
  const evidenceMode = metadata?.transport_mode ?? evidenceEntities.transportMode;
  const evidenceLine = normalizeComparableText(metadata?.route_or_line ?? evidenceEntities.routeOrLine ?? "");
  const evidenceStation = normalizeComparableText(
    metadata?.station_or_stop ?? evidenceEntities.stationOrStop ?? "",
  );
  const evidenceStatus = metadata?.service_status ?? evidenceEntities.serviceStatus;
  const evidenceCause = normalizeComparableText(metadata?.cause ?? evidenceEntities.cause ?? "");
  const claimLine = normalizeComparableText(claimEntities.routeOrLine ?? "");
  const claimStation = normalizeComparableText(claimEntities.stationOrStop ?? "");
  const claimCause = normalizeComparableText(claimEntities.cause ?? "");
  let score = 0;

  const modeMatch =
    !claimEntities.transportMode ||
    !evidenceMode ||
    claimEntities.transportMode === "unknown" ||
    evidenceMode === "unknown" ||
    claimEntities.transportMode === evidenceMode;
  if (modeMatch && evidenceMode) score += 3;
  else score -= 5;

  const lineScore = fuzzyTextScore(claimLine, evidenceLine);
  if (claimLine && lineScore >= 0.82) score += 9;
  else if (claimLine) score -= 9;

  const stationScore = fuzzyTextScore(claimStation, evidenceStation);
  if (claimStation && stationScore >= 0.82) score += 5;
  else if (claimStation && evidenceStation) score -= 13;
  else if (claimStation) score -= 3;

  if (publicTransportEventMatchesClaim(claimCategory, evidenceStatus)) score += 6;
  if (publicTransportEventContradictsClaim(claimCategory, evidenceStatus)) score += 6;

  const causeScore = fuzzyTextScore(claimCause, evidenceCause);
  if (claimCause && causeScore >= 0.82) score += 2;
  else if (claimCause && evidenceCause) score -= 1;

  if (!claimLine && !claimStation) score -= 5;

  const eventMatch =
    eventMatchesClaim(claimCategory, evidenceCategory) ||
    eventContradictsClaim(claimCategory, evidenceCategory);

  return {
    item,
    score,
    category: evidenceCategory,
    scopeAssessment,
    diagnostics: {
      score,
      title: item.title,
      roadMatch: lineScore >= 0.82,
      districtMatch: false,
      directionMatch: true,
      eventTypeMatch: eventMatch,
      normalizedRoadNames: {
        claim: claimLine ? [claimLine] : [],
        evidence: evidenceLine ? [evidenceLine] : [],
      },
      normalizedDistrict: {
        claim: [],
        evidence: [],
      },
      normalizedDirections: {
        claim: [],
        evidence: [],
      },
      normalizedLandmarks: {
        claim: claimStation ? [claimStation] : [],
        evidence: evidenceStation ? [evidenceStation] : [],
      },
      closureScope: {
        claim: "unknown",
        evidence: "unknown",
      },
      eventState: {
        historicalPhrases: [],
        currentPhrases: evidenceStatus ? [evidenceStatus] : [],
        selectedCurrentState: "unknown",
      },
      scopeMatch: true,
      rejectionReason: "passes_threshold",
      contradictionDecision: getTrafficContradictionDecision(claimCategory, evidenceCategory),
    },
  };
}

function extractTrafficEntities(text: string): TrafficEntity {
  const normalized = normalizeDirectionTerms(normalizeText(text));
  const eventState = detectTrafficEventState(text);
  const publicTransport = extractPublicTransportEntities(normalized);
  const roads = extractRoadNames(normalized);
  const districts = DISTRICTS.filter((district) => normalized.includes(district));
  const directions = DIRECTION_TERMS.filter((direction) => normalized.includes(direction));
  const landmarks = extractLandmarks(normalized, roads, districts, directions);
  const category = inferTrafficCategory(normalized, "");
  return {
    roads,
    districts,
    directions,
    landmarks,
    closureScope: extractClosureScope(normalized),
    currentStatus: eventState.currentStatus,
    cause: extractTrafficCause(normalized),
    eventTypes: category ? [category] : [],
    transportMode: publicTransport.transportMode,
    routeOrLine: publicTransport.routeOrLine,
    stationOrStop: publicTransport.stationOrStop,
    serviceStatus: publicTransport.serviceStatus,
    isFuture: /(tomorrow|later|next|planned|will|from \d|between \d)/.test(normalized),
    isCurrent:
      /(currently|now|current|today|at present|is closed|are closed|is re opened|has reopened)/.test(
        normalized,
      ),
  };
}

function extractRoadNames(normalized: string): string[] {
  const withoutDirections = DIRECTION_TERMS.reduce(
    (value, direction) => value.replace(new RegExp(`\\b${escapeRegExp(direction)}\\b`, "g"), " "),
    normalized,
  );
  const matches = withoutDirections.match(
    /\b[a-z0-9]+(?:\s+[a-z0-9]+){0,5}?\s+(?:road|rd|street|st|avenue|ave|drive|dr|lane|ln|highway|tunnel|bridge|flyover|bypass|route)\b/g,
  );
  return [...new Set((matches ?? []).map(canonicalRoadName).filter(Boolean))];
}

function extractPublicTransportEntities(normalized: string): {
  transportMode?: NonNullable<PhaseOneEvidence["traffic_metadata"]>["transport_mode"];
  routeOrLine?: string;
  stationOrStop?: string;
  serviceStatus?: NonNullable<PhaseOneEvidence["traffic_metadata"]>["service_status"];
} {
  if (!isPublicTransportText(normalized)) return {};
  return {
    transportMode: detectTransportMode(normalized),
    routeOrLine: extractRouteOrLine(normalized),
    stationOrStop: extractStationOrStop(normalized),
    serviceStatus: detectServiceStatus(normalized),
  };
}

function isPublicTransportText(normalized: string): boolean {
  const roadEvent = hasRoadTrafficSubject(normalized);
  const publicTransportOperation = hasPublicTransportOperationalLanguage(normalized);
  if (roadEvent && !publicTransportOperation) return false;
  return publicTransportOperation;
}

function hasRoadTrafficSubject(normalized: string): boolean {
  return /\b(road|rd|lane|lanes|carriageway|tunnel|flyover|bridge|closed to traffic|re opened to all traffic|reopened to all traffic|motorists|vehicular traffic|vehicles|traffic is busy|traffic queue)\b/.test(
    normalized,
  );
}

function hasPublicTransportOperationalLanguage(normalized: string): boolean {
  return (
    /\b(?:mtr|train|railway|rail|bus|minibus|ferry|tram|public transport)\s+(?:service|services|operation|operations)\b/.test(
      normalized,
    ) ||
    /\b(?:train|rail|railway|mtr)\s+service\s+(?:is\s+)?(?:suspended|disrupted|delayed|resumed|normal|affected)\b/.test(
      normalized,
    ) ||
    /\b(?:service|services)\s+(?:on|of)\s+(?:the\s+)?[a-z0-9]+(?:\s+[a-z0-9]+){0,5}\s+line\b/.test(
      normalized,
    ) ||
    /\b[a-z0-9]+(?:\s+[a-z0-9]+){0,5}\s+line\s+(?:service|services)\b/.test(
      normalized,
    ) ||
    /\b[a-z0-9]+(?:\s+[a-z0-9]+){0,5}\s+line\s+(?:is\s+)?(?:operating normally|running normally|normal service|suspended|disrupted|delayed|resumed)\b/.test(
      normalized,
    ) ||
    /\bstation\s+(?:closed|closure|service|services|passenger|passengers)\b/.test(normalized) ||
    /\bplatform\s+(?:closed|closure|service|services)\b/.test(normalized) ||
    /\b(?:headway|service frequency|passenger service|train frequency)\b/.test(normalized) ||
    /\bservice disruption\b.*\b(?:mtr|train|railway|rail|line|station|technical fault)\b/.test(
      normalized,
    )
  );
}

function detectTransportMode(
  normalized: string,
): NonNullable<PhaseOneEvidence["traffic_metadata"]>["transport_mode"] {
  if (/\b(?:mtr|train|railway|rail)\b|\b[a-z0-9]+(?:\s+[a-z0-9]+){0,5}\s+line\b/.test(normalized)) {
    return "MTR";
  }
  if (/\bminibus\b/.test(normalized)) return "minibus";
  if (/\bbus\b|\broute\s+[a-z0-9]+\b/.test(normalized)) return "bus";
  if (/\bferry\b/.test(normalized)) return "ferry";
  if (/\btram\b/.test(normalized)) return "tram";
  return "unknown";
}

function extractRouteOrLine(normalized: string): string | undefined {
  const knownMtrLine = MTR_LINE_NAMES.find((line) => normalized.includes(line));
  if (knownMtrLine) return knownMtrLine;

  const mtrLine = normalized.match(
    /\b([a-z0-9]+(?:\s+[a-z0-9]+){0,5})\s+line(?:\s+service\s+disruption)?\b/,
  );
  if (mtrLine) return `${trimTransportNameNoise(mtrLine[1])} line`;

  const route = normalized.match(/\broute\s+([a-z0-9]+)\b/);
  if (route) return `route ${route[1]}`;

  return undefined;
}

function extractStationOrStop(normalized: string): string | undefined {
  const stationNear = normalized.match(/\b(?:near|at|outside)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,5})\s+station\b/);
  if (stationNear) return `${trimTransportNameNoise(stationNear[1])} station`;

  const station = normalized.match(/\b([a-z0-9]+(?:\s+[a-z0-9]+){0,2})\s+station\b/);
  if (station) return `${trimTransportNameNoise(station[1])} station`;

  const stop = normalized.match(/\b(?:near|at|outside)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,5})\s+stop\b/);
  if (stop) return `${trimTransportNameNoise(stop[1])} stop`;

  return undefined;
}

function detectServiceStatus(
  normalized: string,
): NonNullable<PhaseOneEvidence["traffic_metadata"]>["service_status"] {
  return detectPublicTransportServiceState(normalized).status;
}

function detectPublicTransportServiceState(normalized: string): {
  status: NonNullable<PhaseOneEvidence["traffic_metadata"]>["service_status"];
  phrases: string[];
} {
  const matches = [
    ...collectServiceStatusMatches(normalized, "disrupted", [
      /\bservice disruption\b/g,
      /\bservice (?:is )?disrupted\b/g,
      /\btrain service disrupted\b/g,
      /\bserious delay\b/g,
      /\bservice adjustment is in force\b/g,
    ]),
    ...collectServiceStatusMatches(normalized, "suspended", [
      /\bservice suspended\b/g,
      /\bsuspend(?:ed|sion)\b/g,
    ]),
    ...collectServiceStatusMatches(normalized, "delayed", [/\bdelay(?:ed|s)?\b/g]),
    ...collectServiceStatusMatches(normalized, "adjusted", [
      /\badjust(?:ed|ment)?\b/g,
      /\btemporary service adjustment\b/g,
      /\bdivert(?:ed|s)?\b/g,
    ]),
    ...collectServiceStatusMatches(normalized, "cancelled", [
      /\bcancell?ed\b/g,
      /\bcancellation\b/g,
    ]),
    ...collectServiceStatusMatches(normalized, "resuming", [
      /\bincident is now over\b/g,
      /\bincident has been cleared\b/g,
      /\bservice is resuming\b/g,
      /\bservice will be back to normal (?:within a short period(?: of time)?|shortly)\b/g,
      /\btrain service will be back to normal (?:within a short period(?: of time)?|shortly)\b/g,
      /\btrain service gradually resumes\b/g,
      /\bservice is gradually returning to normal\b/g,
      /\btrain service is gradually returning to normal\b/g,
      /\bgradually returning to normal\b/g,
    ]),
    ...collectServiceStatusMatches(normalized, "resumed", [
      /\bnormal service has resumed\b/g,
      /\bservice has resumed\b/g,
      /\btrain service has resumed\b/g,
    ]),
    ...collectServiceStatusMatches(normalized, "normal", [
      /\bservice is operating normally\b/g,
      /\bservices are operating normally\b/g,
      /\bservice has returned to normal\b/g,
      /\bservice is normal\b/g,
      /\bnormal service\b/g,
    ]),
  ].sort((a, b) => a.index - b.index);
  const latest = matches.at(-1);
  return {
    status: latest?.status ?? "unknown",
    phrases: matches.map((match) => match.phrase),
  };
}

function collectServiceStatusMatches(
  value: string,
  status: NonNullable<PhaseOneEvidence["traffic_metadata"]>["service_status"],
  patterns: RegExp[],
): Array<{
  status: NonNullable<PhaseOneEvidence["traffic_metadata"]>["service_status"];
  phrase: string;
  index: number;
}> {
  return patterns.flatMap((pattern) =>
    [...value.matchAll(pattern)].map((match) => ({
      status,
      phrase: match[0],
      index: match.index ?? 0,
    })),
  );
}

function isNormalServiceText(normalized: string): boolean {
  return /\b(?:operating normally|normal service|service is normal|services are normal|running normally)\b/.test(
    normalized,
  );
}

function trimTransportNameNoise(value: string): string {
  const tokens = value.split(" ").filter(Boolean);
  while (tokens.length > 1 && /^(?:the|on|near|at|of|is|are|service)$/.test(tokens[0])) {
    tokens.shift();
  }
  return tokens.join(" ").trim();
}

function extractLandmarks(
  normalized: string,
  roads: string[],
  districts: string[],
  directions: string[],
): string[] {
  const excluded = new Set([...roads, ...districts, ...directions]);
  const nearMatch = normalized.match(
    /\b(?:near|at|outside|around)\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,4})/,
  );
  if (!nearMatch) return [];
  const landmark = trimLandmarkNoise(nearMatch[1].trim());
  return excluded.has(landmark) ? [] : [landmark];
}

function trimLandmarkNoise(value: string): string {
  const tokens = value.split(" ").filter(Boolean);
  const stopIndex = tokens.findIndex((token) =>
    /^(?:which|that|who|was|were|is|are|has|have|due|because|closed|re|opened|reopened|traffic|accident)$/.test(
      token,
    ),
  );
  return (stopIndex >= 0 ? tokens.slice(0, stopIndex) : tokens).join(" ").trim();
}

function extractClosureScope(normalized: string): ClosureScope {
  if (/(part\s+of\s+(?:the\s+)?(?:[a-z]+\s+bound\s+)?lanes?|partially\s+closed|partial\s+closure|part\s+of\s+(?:the\s+)?road)/.test(normalized)) {
    return "partial";
  }
  if (/(entire|whole)\s+road|complete(?:ly)?\s+closed|road\s+closed\s+to\s+all\s+traffic|closed\s+to\s+all\s+traffic/.test(normalized)) {
    return "complete_road";
  }
  if (/(all\s+(?:[a-z]+\s+bound\s+)?lanes|all\s+lanes)/.test(normalized)) {
    return "all_lanes";
  }
  if (/(one|1)\s+lane/.test(normalized)) {
    return "one_lane";
  }
  if (/(some|several)\s+lanes/.test(normalized)) {
    return "some_lanes";
  }
  return "unknown";
}

function detectTrafficEventState(text: string): TrafficEventState {
  const normalized = normalizeDirectionTerms(normalizeText(text));
  const historicalPhrases = collectPhraseMatches(normalized, [
    /\bwhich was closed\b/g,
    /\bwhich were closed\b/g,
    /\bwas closed\b/g,
    /\bwere closed\b/g,
    /\bpreviously closed\b/g,
  ]);
  const currentClosed = collectStateMatches(normalized, "closed", [
    /\bis closed\b/g,
    /\bare closed\b/g,
    /\bremains closed\b/g,
    /\bremain closed\b/g,
    /\bis temporarily closed\b/g,
    /\bare temporarily closed\b/g,
    /\blanes are closed\b/g,
    /\bclosed to traffic\b/g,
  ]);
  const currentReopened = collectStateMatches(normalized, "reopened", [
    /\bis re opened\b/g,
    /\bare re opened\b/g,
    /\bhas reopened\b/g,
    /\bhave reopened\b/g,
    /\bhas been reopened\b/g,
    /\bhave been reopened\b/g,
    /\bbeen reopened\b/g,
    /\breopened to all traffic\b/g,
    /\bre opened to all traffic\b/g,
    /\bre opened\b/g,
    /\btraffic has resumed\b/g,
  ]);
  const currentMatches = [...currentClosed, ...currentReopened].sort((a, b) => a.index - b.index);
  const latest = currentMatches.at(-1);

  return {
    currentStatus: latest?.state ?? "unknown",
    historicalPhrases,
    currentPhrases: currentMatches.map((match) => match.phrase),
  };
}

function collectPhraseMatches(value: string, patterns: RegExp[]): string[] {
  return patterns.flatMap((pattern) => [...value.matchAll(pattern)].map((match) => match[0]));
}

function collectStateMatches(
  value: string,
  state: Exclude<TrafficCurrentStatus, "unknown">,
  patterns: RegExp[],
): Array<{ state: Exclude<TrafficCurrentStatus, "unknown">; phrase: string; index: number }> {
  return patterns.flatMap((pattern) =>
    [...value.matchAll(pattern)].map((match) => ({
      state,
      phrase: match[0],
      index: match.index ?? 0,
    })),
  );
}

function extractTrafficCause(normalized: string): TrafficCause | string | undefined {
  if (/\btrain technical fault\b/.test(normalized)) return "train technical fault";
  if (/\btechnical fault\b/.test(normalized)) return "technical fault";
  const direct = normalizeTrafficCause(normalized);
  if (direct) return direct;
  const match = normalized.match(/\bdue to\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,4})/);
  if (!match) return undefined;
  const cause = trimCauseNoise(match[1]);
  return normalizeTrafficCause(cause) ?? undefined;
}

export function normalizeTrafficCause(value: string | undefined | null): TrafficCause | undefined {
  if (!value) return undefined;
  const normalized = normalizeComparableText(value);
  if (
    /\b(traffic accident|road traffic accident|accident|collision|crash)\b/.test(normalized)
  ) {
    return "traffic_accident";
  }
  if (
    /\b(road works|roadwork|roadworks|maintenance works|road maintenance|resurfacing works)\b/.test(
      normalized,
    )
  ) {
    return "road_works";
  }
  if (/\b(vehicle breakdown|broken down vehicle|stalled vehicle)\b/.test(normalized)) {
    return "vehicle_breakdown";
  }
  if (/\b(police operation|police investigation)\b/.test(normalized)) {
    return "police_operation";
  }
  if (/\b(special event|public event|parade|procession)\b/.test(normalized)) {
    return "special_event";
  }
  if (/\b(flooding|flood|water accumulation)\b/.test(normalized)) return "flooding";
  if (/\b(landslide|slope failure)\b/.test(normalized)) return "landslide";
  return undefined;
}

function trafficCauseLabel(cause: TrafficCause): string {
  if (cause === "traffic_accident") return "a traffic accident";
  if (cause === "road_works") return "road works";
  if (cause === "vehicle_breakdown") return "a vehicle breakdown";
  if (cause === "police_operation") return "a police operation";
  if (cause === "special_event") return "a special event";
  if (cause === "flooding") return "flooding";
  if (cause === "landslide") return "a landslide";
  return "an unknown cause";
}

function trafficCauseTitle(cause: TrafficCause): string {
  if (cause === "traffic_accident") return "Traffic Accident";
  if (cause === "road_works") return "Road Works";
  if (cause === "vehicle_breakdown") return "Vehicle Breakdown";
  if (cause === "police_operation") return "Police Operation";
  if (cause === "special_event") return "Special Event";
  if (cause === "flooding") return "Flooding";
  if (cause === "landslide") return "Landslide";
  return "Unknown";
}

function formatTrafficCauseForMetadata(cause: string | undefined): string | undefined {
  if (!cause) return undefined;
  const normalized = normalizeTrafficCause(cause);
  return normalized ? trafficCauseTitle(normalized) : titleCase(cause);
}

function trimCauseNoise(value: string): string {
  const tokens = value.split(" ").filter(Boolean);
  const stopIndex = tokens.findIndex((token) =>
    /^(?:is|are|was|were|has|have|re|opened|reopened|to|all|traffic|and|but|which)$/.test(token),
  );
  return (stopIndex >= 0 ? tokens.slice(0, stopIndex) : tokens).join(" ").trim();
}

function assessClosureScope(
  claimEntities: TrafficEntity,
  evidenceEntities: TrafficEntity,
  claimCategory: TrafficClaimCategory,
): ScopeAssessment {
  if (!isClosureClaimCategory(claimCategory)) {
    return { status: "sufficient", reason: "Traffic claim does not require closure scope matching." };
  }

  const directionMatch = bestFuzzyMatch(claimEntities.directions, evidenceEntities.directions);
  if (claimEntities.directions.length && evidenceEntities.directions.length && directionMatch.score < 0.82) {
    return {
      status: "insufficient",
      reason:
        "The Transport Department notice is related, but it identifies a different direction and does not establish the claimed direction-specific closure.",
    };
  }

  if (
    claimEntities.directions.length &&
    !evidenceEntities.directions.length &&
    !evidenceAppliesToAllDirections(evidenceEntities)
  ) {
    return {
      status: "insufficient",
      reason:
        "The Transport Department notice is related, but it does not specify the claimed direction and does not clearly apply to all directions.",
    };
  }

  if (claimEntities.closureScope === "unknown") {
    return { status: "sufficient", reason: "The claim does not assert a stronger closure scope." };
  }

  if (scopeStrength(evidenceEntities.closureScope) >= scopeStrength(claimEntities.closureScope)) {
    return { status: "sufficient", reason: "The Transport Department notice establishes the claimed closure scope." };
  }

  return {
    status: "insufficient",
    reason:
      "The Transport Department notice is related, but it does not establish the full claimed closure scope.",
  };
}

function evidenceAppliesToAllDirections(evidenceEntities: TrafficEntity): boolean {
  return evidenceEntities.closureScope === "complete_road";
}

function scopeStrength(scope: ClosureScope): number {
  if (scope === "complete_road") return 5;
  if (scope === "all_lanes") return 4;
  if (scope === "some_lanes" || scope === "partial") return 2;
  if (scope === "one_lane") return 1;
  return 0;
}

function isClosureClaimCategory(category: TrafficClaimCategory): boolean {
  return category === "current_road_closure" || category === "current_lane_closure";
}

function canonicalRoadName(value: string): string {
  let normalized = normalizeDirectionTerms(normalizeText(value))
    .replace(/\brd\b/g, "road")
    .replace(/\bst\b/g, "street")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bdr\b/g, "drive")
    .replace(/\bln\b/g, "lane");
  const tokens = normalized.split(" ").filter(Boolean);
  while (tokens.length > 1 && isRoadPrefixNoise(tokens[0])) {
    tokens.shift();
  }
  while (tokens.length > 1 && isRoadPrefixNoise(tokens[tokens.length - 2])) {
    tokens.splice(tokens.length - 2, 1);
  }
  normalized = tokens.join(" ");
  return hasSpecificRoadName(normalized) ? normalized : "";
}

function isRoadPrefixNoise(value: string): boolean {
  return (
    /^(?:the|of|on|at|near|around|outside|upper|lower|lanes?|bound|part|section|junction|traffic|busy|closed|closure|currently|current|is|are|was|were|and|from|to|towards|toward|due|implemented|diversion|works|work|be|will|for|tomorrow|today|all|one|1|some|several|major|entire|whole|previously)$/.test(
      value,
    ) || value === "kowloon"
  );
}

function hasSpecificRoadName(value: string): boolean {
  const tokens = value.split(" ").filter(Boolean);
  if (tokens.length < 2) return false;
  const suffix = tokens[tokens.length - 1];
  const nameTokens = tokens.slice(0, -1).filter((token) => !isRoadPrefixNoise(token));
  return (
    /^(?:road|street|avenue|drive|lane|highway|tunnel|bridge|flyover|bypass|route)$/.test(suffix) &&
    nameTokens.length > 0
  );
}

function inferTrafficCategory(title: string, summary: string): TrafficEvidenceCategory | null {
  const value = normalizeText(`${title} ${summary}`);
  const eventState = detectTrafficEventState(`${title} ${summary}`);
  if (isPublicTransportText(value)) {
    const serviceStatus = detectServiceStatus(value);
    if (serviceStatus === "resuming" || serviceStatus === "resumed" || serviceStatus === "normal") {
      return "public_transport_resumed";
    }
    return "public_transport_disruption";
  }
  if (eventState.currentStatus === "reopened") return "road_reopened";
  if (/(traffic diversion|diverted|diversion)/.test(value)) return "traffic_diversion";
  if (/(busy|congest|traffic queue|queue)/.test(value)) return "traffic_congestion";
  if (
    eventState.currentStatus === "closed" &&
    /(lane|lanes).*(closed|closure|closed to traffic)|closed.*(lane|lanes)/.test(value)
  ) {
    return "lane_closure";
  }
  if (
    eventState.currentStatus === "closed" ||
    /(road closure|closed to traffic|road closed|closure|closed)/.test(value)
  ) {
    return "road_closure";
  }
  if (
    /(temporary traffic arrangement|special traffic arrangement|traffic notice|will be closed|will be implemented)/.test(
      value,
    )
  ) {
    return "planned_traffic_arrangement";
  }
  return null;
}

function getEvidenceTrafficCategory(item: PhaseOneEvidence): TrafficEvidenceCategory | null {
  if (
    item.category === "road_closure" ||
    item.category === "lane_closure" ||
    item.category === "road_reopened" ||
    item.category === "traffic_congestion" ||
    item.category === "traffic_diversion" ||
    item.category === "public_transport_disruption" ||
    item.category === "public_transport_resumed" ||
    item.category === "planned_traffic_arrangement"
  ) {
    return item.category;
  }
  return inferTrafficCategory(item.title, item.summary);
}

function eventMatchesClaim(
  claimCategory: TrafficClaimCategory,
  evidenceCategory: TrafficEvidenceCategory | null,
): boolean {
  if (!evidenceCategory) return false;
  if (claimCategory === "current_road_closure") return evidenceCategory === "road_closure";
  if (claimCategory === "current_lane_closure") return evidenceCategory === "lane_closure";
  if (claimCategory === "road_reopened") return evidenceCategory === "road_reopened";
  if (claimCategory === "traffic_congestion") return evidenceCategory === "traffic_congestion";
  if (claimCategory === "traffic_diversion") return evidenceCategory === "traffic_diversion";
  if (
    claimCategory === "public_transport_disruption" ||
    claimCategory === "public_transport_resumed" ||
    claimCategory === "public_transport_cause_claim"
  ) {
    return evidenceCategory === "public_transport_disruption" || evidenceCategory === "public_transport_resumed";
  }
  if (claimCategory === "public_transport_normal") {
    return evidenceCategory === "public_transport_disruption" || evidenceCategory === "public_transport_resumed";
  }
  if (claimCategory === "future_traffic_arrangement") {
    return evidenceCategory === "planned_traffic_arrangement";
  }
  if (claimCategory === "vague_traffic_claim") return true;
  return false;
}

function eventContradictsClaim(
  claimCategory: TrafficClaimCategory,
  evidenceCategory: TrafficEvidenceCategory | null,
): boolean {
  if (!evidenceCategory) return false;
  if (isClosureClaimCategory(claimCategory)) return evidenceCategory === "road_reopened";
  if (claimCategory === "road_reopened") {
    return evidenceCategory === "road_closure" || evidenceCategory === "lane_closure";
  }
  if (
    claimCategory === "public_transport_disruption" ||
    claimCategory === "public_transport_normal" ||
    claimCategory === "public_transport_resumed" ||
    claimCategory === "public_transport_cause_claim"
  ) {
    return evidenceCategory === "public_transport_disruption" || evidenceCategory === "public_transport_resumed";
  }
  return false;
}

function getTrafficContradictionDecision(
  claimCategory: TrafficClaimCategory,
  evidenceCategory: TrafficEvidenceCategory | null,
): string {
  if (eventContradictsClaim(claimCategory, evidenceCategory)) return "contradicts_claim";
  if (eventMatchesClaim(claimCategory, evidenceCategory)) return "supports_claim";
  return "no_direct_event_decision";
}

function isTrafficEventRelevantForClaim(
  claimCategory: TrafficClaimCategory,
  evidenceCategory: TrafficEvidenceCategory | null,
): boolean {
  if (!evidenceCategory) return false;
  if (claimCategory === "current_road_closure") {
    return (
      evidenceCategory === "road_closure" ||
      evidenceCategory === "lane_closure" ||
      evidenceCategory === "road_reopened"
    );
  }
  if (claimCategory === "current_lane_closure") {
    return (
      evidenceCategory === "lane_closure" ||
      evidenceCategory === "road_closure" ||
      evidenceCategory === "road_reopened"
    );
  }
  if (claimCategory === "road_reopened") {
    return (
      evidenceCategory === "road_reopened" ||
      evidenceCategory === "road_closure" ||
      evidenceCategory === "lane_closure"
    );
  }
  if (
    claimCategory === "public_transport_disruption" ||
    claimCategory === "public_transport_normal" ||
    claimCategory === "public_transport_resumed" ||
    claimCategory === "public_transport_cause_claim"
  ) {
    return evidenceCategory === "public_transport_disruption" || evidenceCategory === "public_transport_resumed";
  }
  return eventMatchesClaim(claimCategory, evidenceCategory);
}

function isTrafficEvidenceAllowedForClaim(
  item: PhaseOneEvidence,
  category: TrafficClaimCategory,
): boolean {
  if (category === "future_traffic_arrangement") {
    return item.category === "planned_traffic_arrangement";
  }
  return item.category !== "planned_traffic_arrangement";
}

function thresholdForTrafficCategory(category: TrafficClaimCategory): number {
  if (category === "future_traffic_arrangement") return PLANNED_TRAFFIC_THRESHOLD;
  if (isPublicTransportClaimCategory(category)) return PUBLIC_TRANSPORT_THRESHOLD;
  return CURRENT_TRAFFIC_THRESHOLD;
}

function isPublicTransportClaimCategory(category: TrafficClaimCategory): boolean {
  return (
    category === "public_transport_disruption" ||
    category === "public_transport_normal" ||
    category === "public_transport_resumed" ||
    category === "public_transport_cause_claim"
  );
}

function publicTransportEventMatchesClaim(
  claimCategory: TrafficClaimCategory,
  serviceStatus: PublicTransportServiceStatus,
): boolean {
  if (claimCategory === "public_transport_disruption") {
    return (
      serviceStatus === "disrupted" ||
      serviceStatus === "suspended" ||
      serviceStatus === "delayed" ||
      serviceStatus === "adjusted" ||
      serviceStatus === "cancelled"
    );
  }
  if (claimCategory === "public_transport_cause_claim") {
    return serviceStatus !== undefined && serviceStatus !== "normal" && serviceStatus !== "resumed";
  }
  if (claimCategory === "public_transport_normal") {
    return serviceStatus === "normal" || serviceStatus === "resumed";
  }
  return false;
}

function publicTransportEventContradictsClaim(
  claimCategory: TrafficClaimCategory,
  serviceStatus: PublicTransportServiceStatus,
): boolean {
  if (claimCategory === "public_transport_disruption") {
    return serviceStatus === "normal" || serviceStatus === "resumed" || serviceStatus === "resuming";
  }
  if (claimCategory === "public_transport_normal") {
    return (
      serviceStatus === "disrupted" ||
      serviceStatus === "suspended" ||
      serviceStatus === "delayed" ||
      serviceStatus === "adjusted" ||
      serviceStatus === "cancelled"
    );
  }
  return false;
}

function withTrafficRejectionReason(
  candidate: ScoredEvidence,
  category: TrafficClaimCategory,
  threshold: number,
): ScoredEvidence {
  let rejectionReason = "passes_threshold";
  if (!isTrafficEvidenceAllowedForClaim(candidate.item, category)) {
    rejectionReason = "wrong_source_for_claim_timeframe";
  } else if (candidate.item.freshness !== "fresh") {
    rejectionReason = "stale_or_unavailable_source";
  } else if (!candidate.diagnostics.roadMatch && candidate.diagnostics.normalizedRoadNames.claim.length) {
    rejectionReason = "road_mismatch";
  } else if (
    candidate.diagnostics.normalizedDirections.claim.length &&
    candidate.diagnostics.normalizedDirections.evidence.length &&
    !candidate.diagnostics.directionMatch
  ) {
    rejectionReason = "direction_mismatch_score_reduced";
  } else if (candidate.scopeAssessment.status === "insufficient") {
    rejectionReason = "scope_too_weak";
  } else if (candidate.scopeAssessment.status === "contradiction") {
    rejectionReason = "scope_contradiction";
  } else if (!isTrafficEventRelevantForClaim(category, candidate.category)) {
    rejectionReason = "event_type_mismatch";
  } else if (candidate.score < threshold) {
    rejectionReason = "below_relevance_threshold";
  }

  return {
    ...candidate,
    diagnostics: {
      ...candidate.diagnostics,
      rejectionReason,
    },
  };
}

function logTrafficCandidateDiagnostics(
  claimText: string,
  category: TrafficClaimCategory,
  candidates: ScoredEvidence[],
  threshold: number,
): void {
  if (!shouldLogTrafficDiagnostics()) return;
  const rows = candidates
    .map((candidate) => withTrafficRejectionReason(candidate, category, threshold))
    .map(({ diagnostics }) => diagnostics);
  console.info(
    "[VeriHK traffic matcher] Top Transport candidates",
    JSON.stringify(
      {
        claim: claimText,
        category,
        threshold,
        candidates: rows,
      },
      null,
      2,
    ),
  );
}

function logTrafficSourceParsing(label: string, payload: unknown): void {
  if (!shouldLogTrafficDiagnostics()) return;
  console.info(`[VeriHK traffic source parser] ${label}`, JSON.stringify(payload, null, 2));
}

function shouldLogTrafficDiagnostics(): boolean {
  return process.env.NODE_ENV !== "production";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function trafficEvidence({
  id,
  sourceType,
  category,
  title,
  summary,
  url,
  publishedAt,
  updatedAt,
  retrievedAt,
  metadata,
}: {
  id: string;
  sourceType: "government_rss" | "government_webpage";
  category: TrafficEvidenceCategory | null;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  updatedAt: string | null;
  retrievedAt: string;
  metadata?: PhaseOneEvidence["traffic_metadata"];
}): PhaseOneEvidence {
  const cleanTitle = normalizeTrafficText(title);
  const cleanSummary = normalizeTrafficText(summary);
  const trafficMetadata = metadata ?? buildTrafficEvidenceMetadata(cleanSummary, category);
  const excerpt = formatTrafficEvidenceExcerpt(cleanSummary, trafficMetadata);
  return {
    id,
    source_key: "td",
    source_name: "Transport Department",
    source_authority: "official",
    source_type: sourceType,
    category: category ?? "traffic_congestion",
    title: cleanTitle,
    excerpt: truncate(excerpt, 300),
    summary: truncate(cleanSummary, 520),
    url,
    published_at: publishedAt,
    updated_at: updatedAt,
    retrieved_at: retrievedAt,
    freshness:
      updatedAt &&
      sourceType === "government_webpage" &&
      isOlderThanMinutes(updatedAt, TRAFFIC_CURRENT_MAX_AGE_MINUTES)
        ? "stale"
        : "fresh",
    traffic_metadata: trafficMetadata,
  };
}

function buildTrafficEvidenceMetadata(
  summary: string,
  category: TrafficEvidenceCategory | null,
): PhaseOneEvidence["traffic_metadata"] {
  const entities = extractTrafficEntities(summary);
  if (
    category === "public_transport_disruption" ||
    category === "public_transport_resumed" ||
    entities.transportMode
  ) {
    return buildPublicTransportMetadata(entities, category);
  }
  const primaryRoad = entities.roads[0];
  const nearbyRoad = entities.roads.find((road) => road !== primaryRoad);
  const nearbyLandmark = entities.landmarks[0] ?? nearbyRoad;
  if (!primaryRoad && !nearbyLandmark && !entities.directions[0] && !category) return undefined;

  return {
    road_name: primaryRoad ? titleCase(primaryRoad) : undefined,
    nearby_landmark: nearbyLandmark ? titleCase(nearbyLandmark) : undefined,
    district: entities.districts[0] ? titleCase(entities.districts[0]) : undefined,
    direction: entities.directions[0] ? formatDirection(entities.directions[0]) : undefined,
    event_type: category ?? undefined,
    scope: entities.closureScope !== "unknown" ? closureScopeCode(entities.closureScope) : undefined,
    current_status: entities.currentStatus !== "unknown" ? entities.currentStatus : undefined,
    cause: formatTrafficCauseForMetadata(entities.cause),
    map_location_key: getTrafficMapLocationKey(primaryRoad, nearbyLandmark),
  };
}

function buildStructuredTrafficMetadata(
  incident: TrafficXmlIncident,
): PhaseOneEvidence["traffic_metadata"] {
  const combinedText = [
    incident.heading,
    incident.location,
    incident.content,
  ].join(" ");
  const category = inferTrafficCategory(combinedText, "");
  const transportEntities = extractTrafficEntities(combinedText);
  const officialCoordinates = parseOfficialTrafficCoordinates(
    incident.latitude,
    incident.longitude,
  );

  if (
    category === "public_transport_disruption" ||
    category === "public_transport_resumed" ||
    transportEntities.transportMode
  ) {
    const locationEntities = extractTrafficEntities(incident.location);
    const contentEntities = extractTrafficEntities(incident.content);
    const publicTransportMetadata = buildPublicTransportMetadata(transportEntities, category);
    const metadata: PhaseOneEvidence["traffic_metadata"] = {
      ...publicTransportMetadata,
      route_or_line: locationEntities.routeOrLine
        ? titleCase(locationEntities.routeOrLine)
        : publicTransportMetadata?.route_or_line,
      station_or_stop: contentEntities.stationOrStop
        ? titleCase(contentEntities.stationOrStop)
        : undefined,
      cause: formatTrafficCauseForMetadata(contentEntities.cause),
      latitude: officialCoordinates?.latitude,
      longitude: officialCoordinates?.longitude,
      coordinate_source: officialCoordinates ? "Official TD coordinates" : undefined,
    };
    logPublicTransportMetadataDiagnostics(incident, metadata, false);
    return metadata;
  }

  const fallback = buildTrafficEvidenceMetadata(
    [
      incident.location,
      incident.direction ? `(${incident.direction} bound)` : "",
      incident.nearLandmark ? `near ${incident.nearLandmark}` : "",
      incident.content,
    ].join(" "),
    inferTrafficCategory(incident.heading, incident.content),
  );
  const roadName = incident.location || fallback?.road_name;
  const nearbyLandmark = incident.nearLandmark || incident.betweenLandmark || fallback?.nearby_landmark;
  const direction = incident.direction ? formatDirection(incident.direction) : fallback?.direction;
  const entities = extractTrafficEntities(incident.content);

  return {
    road_name: roadName ? titleCase(normalizeText(roadName)) : fallback?.road_name,
    nearby_landmark: nearbyLandmark
      ? titleCase(normalizeText(nearbyLandmark))
      : fallback?.nearby_landmark,
    district: incident.district ? titleCase(normalizeText(incident.district)) : fallback?.district,
    direction,
    event_type: category ?? fallback?.event_type,
    scope:
      entities.closureScope !== "unknown"
        ? closureScopeCode(entities.closureScope)
        : fallback?.scope,
    current_status:
      entities.currentStatus !== "unknown" ? entities.currentStatus : fallback?.current_status,
    cause: incident.detail
      ? formatTrafficCauseForMetadata(normalizeTrafficCause(incident.detail) ?? normalizeText(incident.detail))
      : fallback?.cause,
    latitude: officialCoordinates?.latitude,
    longitude: officialCoordinates?.longitude,
    coordinate_source: officialCoordinates ? "Official TD coordinates" : undefined,
    map_location_key: getTrafficMapLocationKey(
      normalizeText(roadName ?? ""),
      normalizeText(nearbyLandmark ?? ""),
    ),
  };
}

function buildPublicTransportMetadata(
  entities: TrafficEntity,
  category: TrafficEvidenceCategory | null,
): PhaseOneEvidence["traffic_metadata"] {
  if (!entities.transportMode && !entities.routeOrLine && !entities.stationOrStop) {
    return category ? { event_type: category } : undefined;
  }
  return {
    transport_mode: entities.transportMode ?? "unknown",
    route_or_line: entities.routeOrLine ? titleCase(entities.routeOrLine) : undefined,
    station_or_stop: entities.stationOrStop ? titleCase(entities.stationOrStop) : undefined,
    event_type: category ?? "public_transport_disruption",
    service_status: entities.serviceStatus ?? "unknown",
    cause: formatTrafficCauseForMetadata(entities.cause),
  };
}

function logPublicTransportMetadataDiagnostics(
  incident: TrafficXmlIncident,
  metadata: PhaseOneEvidence["traffic_metadata"],
  reusedCachedRecord: boolean,
): void {
  if (!shouldLogTrafficDiagnostics()) return;
  const normalizedContent = normalizeText(incident.content);
  const serviceState = detectPublicTransportServiceState(normalizedContent);
  const normalizedCause = extractTrafficCause(normalizedContent);
  console.info(
    "[VeriHK public transport parser] metadata",
    JSON.stringify(
      {
        incident_id: incident.incidentNumber,
        raw_current_content: incident.content,
        detected_current_status_phrases: serviceState.phrases,
        selected_final_service_status: serviceState.status,
        raw_cause_field: incident.detail,
        normalized_cause: normalizedCause ?? null,
        metadata,
        cached_record_reused: reusedCachedRecord,
      },
      null,
      2,
    ),
  );
}

function parseOfficialTrafficCoordinates(
  rawLatitude: string,
  rawLongitude: string,
): { latitude: number; longitude: number } | undefined {
  if (!rawLatitude.trim() || !rawLongitude.trim()) return undefined;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (latitude === 0 && longitude === 0) return undefined;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return undefined;
  }
  return { latitude, longitude };
}

function getTrafficMapLocationKey(roadName: string | undefined, landmark: string | undefined): string | undefined {
  const road = normalizeText(roadName ?? "");
  const near = normalizeText(landmark ?? "");
  if (road === "princess margaret road" && near === "pui ching road") {
    return "princess-margaret-road-pui-ching-road";
  }
  return undefined;
}

function closureScopeCode(scope: ClosureScope): string | undefined {
  if (scope === "complete_road") return "complete_road";
  if (scope === "all_lanes") return "all_lanes";
  if (scope === "one_lane") return "one_lane";
  if (scope === "some_lanes") return "some_lanes";
  if (scope === "partial") return "part_of_lanes";
  return undefined;
}

function unavailableTrafficSnapshot(
  retrievedAt: string,
  message: string,
  endpointKey: string,
): TrafficSourceSnapshot {
  return {
    evidence: [],
    freshness: [
      {
        source_key: "td",
        source_name: "Transport Department",
        freshness: "unavailable",
        retrieved_at: retrievedAt,
        updated_at: null,
        message,
      },
    ],
    itemsFetched: 0,
    sourceKeys: ["td"],
    endpointKeys: [endpointKey],
  };
}

function emptyTrafficSnapshot(): TrafficSourceSnapshot {
  return {
    evidence: [],
    freshness: [],
    itemsFetched: 0,
    sourceKeys: ["td"],
    endpointKeys: [],
  };
}

export function mergeTrafficSnapshots(
  snapshots: TrafficSourceSnapshot[],
): TrafficSourceSnapshot | undefined {
  if (!snapshots.length) return undefined;
  const evidence = new Map<string, PhaseOneEvidence>();
  for (const snapshot of snapshots) {
    for (const item of snapshot.evidence) evidence.set(getTrafficDedupeKey(item), item);
  }
  return {
    evidence: [...evidence.values()],
    freshness: snapshots.flatMap((snapshot) => snapshot.freshness),
    itemsFetched: snapshots.reduce((sum, snapshot) => sum + snapshot.itemsFetched, 0),
    sourceKeys: ["td"],
    endpointKeys: snapshots.flatMap((snapshot) => snapshot.endpointKeys),
  };
}

function parseTrafficXmlIncidents(xml: string): TrafficXmlIncident[] {
  return [...xml.matchAll(/<message\b[^>]*>([\s\S]*?)<\/message>/gi)].map((match) => {
    const messageXml = match[1];
    return {
      incidentNumber: getXmlText(messageXml, "INCIDENT_NUMBER"),
      heading: getXmlText(messageXml, "INCIDENT_HEADING_EN"),
      detail: getXmlText(messageXml, "INCIDENT_DETAIL_EN"),
      location: getXmlText(messageXml, "LOCATION_EN"),
      district: getXmlText(messageXml, "DISTRICT_EN"),
      direction: getXmlText(messageXml, "DIRECTION_EN"),
      nearLandmark: getXmlText(messageXml, "NEAR_LANDMARK_EN"),
      betweenLandmark: getXmlText(messageXml, "BETWEEN_LANDMARK_EN"),
      announcementDate: parseTrafficDate(getXmlText(messageXml, "ANNOUNCEMENT_DATE")),
      status: getXmlText(messageXml, "INCIDENT_STATUS_EN"),
      content: normalizeTrafficText(getXmlText(messageXml, "CONTENT_EN")),
      latitude: getXmlText(messageXml, "LATITUDE"),
      longitude: getXmlText(messageXml, "LONGITUDE"),
    };
  });
}

function dedupeTrafficEvidence(items: PhaseOneEvidence[]): PhaseOneEvidence[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getTrafficDedupeKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getTrafficDedupeKey(item: PhaseOneEvidence): string {
  const metadata = item.traffic_metadata;
  if (metadata?.transport_mode || metadata?.route_or_line || metadata?.station_or_stop) {
    const transportParts = [
      normalizeComparableText(metadata?.transport_mode ?? ""),
      normalizeComparableText(metadata?.route_or_line ?? ""),
      normalizeComparableText(metadata?.station_or_stop ?? ""),
      normalizeComparableText(metadata?.service_status ?? ""),
      item.updated_at ?? "",
    ];
    if (transportParts.filter(Boolean).length >= 4) {
      return ["transport", ...transportParts].join("|");
    }
  }
  const compositeParts = [
    normalizeComparableText(metadata?.road_name ?? ""),
    normalizeComparableText(metadata?.direction ?? ""),
    normalizeComparableText(metadata?.nearby_landmark ?? ""),
    normalizeComparableText(metadata?.current_status ?? ""),
    item.updated_at ?? "",
  ];
  if (compositeParts.filter(Boolean).length >= 4) {
    return ["traffic", ...compositeParts].join("|");
  }
  const idMatch = item.id.match(/\bIN-\d{2}-\d+\b/i);
  if (idMatch) return `incident:${idMatch[0].toUpperCase()}`;
  return ["traffic", ...compositeParts].join("|");
}

function parseTrafficRssItems(xml: string): Array<{
  guid: string;
  title: string;
  description: string;
  published_at: string | null;
  url: string;
}> {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => {
    const itemXml = match[0];
    const url = getXmlText(itemXml, "link");
    return {
      guid: getXmlText(itemXml, "guid") || url,
      title: getXmlText(itemXml, "title"),
      description: stripHtml(getXmlText(itemXml, "description")),
      published_at: parseTrafficDate(getXmlText(itemXml, "pubDate")),
      url,
    };
  });
}

function dedupeTrafficRssItems<T extends { guid: string; url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.guid || item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitTrafficSentences(text: string): string[] {
  return text
    .split(/(?<=\.)\s+|(?=\b(?:Road|Lane|Traffic|Bus|Route)\b)/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferTrafficTitle(summary: string, index: number): string {
  const category = inferTrafficCategory(summary, "");
  const entities = extractTrafficEntities(summary);
  const label = trafficCategoryLabel(category);
  const primaryRoad = entities.roads[0];
  const nearbyRoad = entities.roads.find((road) => road !== primaryRoad);
  const direction = entities.directions[0];

  if (category === "public_transport_disruption" || category === "public_transport_resumed") {
    const statusLabel = publicTransportTitleLabel(entities.serviceStatus);
    const parts = [statusLabel];
    if (entities.routeOrLine) parts.push(`on the ${titleCase(entities.routeOrLine)}`);
    if (entities.stationOrStop) parts.push(`near ${titleCase(entities.stationOrStop)}`);
    return parts.join(" ") || `Public Transport Update ${index + 1}`;
  }

  if (category === "road_reopened" && primaryRoad) {
    const reopeningLabel = entities.closureScope === "partial" ? "Lane Reopening" : "Road Reopening";
    const parts = [`${reopeningLabel} on ${titleCase(primaryRoad)}`];
    if (nearbyRoad) parts.push(`near ${titleCase(nearbyRoad)}`);
    return parts.join(" ");
  }

  const parts = [label];

  if (primaryRoad) parts.push(`on ${titleCase(primaryRoad)}`);
  if (nearbyRoad) parts.push(`near ${titleCase(nearbyRoad)}`);
  if (direction) parts.push(`, ${titleCase(direction)}`);

  return parts.join(" ") || `Transport Department Traffic Update ${index + 1}`;
}

function publicTransportTitleLabel(
  status?: NonNullable<PhaseOneEvidence["traffic_metadata"]>["service_status"],
): string {
  if (status === "resuming") return "Service Resuming";
  if (status === "resumed" || status === "normal") return "Service Resumption";
  if (status === "suspended") return "Service Suspension";
  if (status === "delayed") return "Service Delay";
  if (status === "adjusted") return "Service Adjustment";
  if (status === "cancelled") return "Service Cancellation";
  return "Service Disruption";
}

function formatTrafficEvidenceExcerpt(
  summary: string,
  metadata: PhaseOneEvidence["traffic_metadata"],
): string {
  if (
    metadata?.event_type === "public_transport_resumed" &&
    metadata.route_or_line &&
    metadata.service_status === "resuming"
  ) {
    return `The Transport Department reports that the incident on the ${metadata.route_or_line} is now over and train service will return to normal within a short period.`;
  }

  if (
    metadata?.current_status === "reopened" &&
    metadata.road_name &&
    metadata.nearby_landmark
  ) {
    const direction = metadata.direction ? ` (${metadata.direction})` : "";
    const cause = metadata.cause ? ` due to a ${metadata.cause.toLowerCase()}` : "";
    const scope = sentenceCase(buildTrafficScopePhrase(metadata.scope));
    return `${scope} of ${metadata.road_name}${direction} near ${metadata.nearby_landmark}, previously closed${cause}, have reopened to all traffic. Traffic queues may take time to disperse.`;
  }

  return summary;
}

function trafficCategoryLabel(category: TrafficEvidenceCategory | null): string {
  if (category === "road_closure") return "Road Closure";
  if (category === "lane_closure") return "Lane Closure";
  if (category === "road_reopened") return "Road Reopening";
  if (category === "traffic_congestion") return "Busy Traffic";
  if (category === "traffic_diversion") return "Traffic Diversion";
  if (category === "public_transport_disruption") return "Public Transport Disruption";
  if (category === "public_transport_resumed") return "Service Resuming";
  if (category === "planned_traffic_arrangement") return "Traffic Arrangement";
  return "Transport Department Traffic Update";
}

function overlap(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).length;
}

function bestFuzzyMatch(left: string[], right: string[]): { score: number; left?: string; right?: string } {
  let best = { score: 0, left: undefined as string | undefined, right: undefined as string | undefined };
  for (const leftItem of left) {
    for (const rightItem of right) {
      const score = fuzzyTextScore(leftItem, rightItem);
      if (score > best.score) best = { score, left: leftItem, right: rightItem };
    }
  }
  return best;
}

function fuzzyTextScore(left: string, right: string): number {
  const a = normalizeComparableText(left);
  const b = normalizeComparableText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const leftTokens = tokenSet(a);
  const rightTokens = tokenSet(b);
  if (!leftTokens.size || !rightTokens.size) return 0;

  const smaller = leftTokens.size <= rightTokens.size ? leftTokens : rightTokens;
  const larger = leftTokens.size > rightTokens.size ? leftTokens : rightTokens;
  const containedTokens = [...smaller].filter((token) => larger.has(token)).length;
  const containment = containedTokens / smaller.size;
  const jaccard = containedTokens / new Set([...leftTokens, ...rightTokens]).size;

  if ((a.includes(b) || b.includes(a)) && smaller.size >= 2) return Math.max(0.9, jaccard);
  return Math.max(jaccard, containment >= 0.8 ? 0.82 : containment);
}

function tokenSet(value: string): Set<string> {
  return new Set(value.split(" ").filter(Boolean));
}

function normalizeComparableText(value: string): string {
  return normalizeDirectionTerms(normalizeText(value))
    .replace(/\brd\b/g, "road")
    .replace(/\bst\b/g, "street")
    .replace(/\bave\b/g, "avenue")
    .replace(/\bdr\b/g, "drive")
    .replace(/\bln\b/g, "lane")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDirectionTerms(value: string): string {
  return value
    .replace(/\be\s+bound\b/g, "eastbound")
    .replace(/\bw\s+bound\b/g, "westbound")
    .replace(/\bn\s+bound\b/g, "northbound")
    .replace(/\bs\s+bound\b/g, "southbound")
    .replace(/\beast\s+bound\b/g, "eastbound")
    .replace(/\bwest\s+bound\b/g, "westbound")
    .replace(/\bnorth\s+bound\b/g, "northbound")
    .replace(/\bsouth\s+bound\b/g, "southbound");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTdTimestamp(html: string): string | null {
  return (
    stripHtml(html).match(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?/i)?.[0] ??
    null
  );
}

function parseTrafficDate(value: string | null): string | null {
  if (!value) return null;
  const hkIsoWithoutZoneMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (hkIsoWithoutZoneMatch) {
    const [, y, m, d, hh, mm, ss = "00"] = hkIsoWithoutZoneMatch;
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`).toISOString();
  }
  const hkLocalMatch = value.match(
    /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i,
  );
  if (hkLocalMatch) {
    const [, y, m, d, hh, mm, ss, meridiem] = hkLocalMatch;
    let hour = Number(hh);
    if (String(meridiem).toUpperCase() === "PM" && hour < 12) hour += 12;
    if (String(meridiem).toUpperCase() === "AM" && hour === 12) hour = 0;
    const normalized = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${mm}:${ss}+08:00`;
    return new Date(normalized).toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function isOlderThanMinutes(value: string, minutes: number): boolean {
  return Date.now() - Date.parse(value) > minutes * 60 * 1000;
}

function isWithinRecentDays(value: string): boolean {
  return Date.now() - Date.parse(value) <= TRAFFIC_NOTICE_RECENT_DAYS * 24 * 60 * 60 * 1000;
}

function latestIso(values: Array<string | null>): string | null {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function withTrafficVerdict(
  claim: PhaseOneClaim,
  verdict: ReportVerdict,
  evidence: PhaseOneEvidence[],
  confidence: number,
  explanation: string,
  recommendation: string,
  coverage: EvidenceCoverage,
): TrafficEvaluation {
  return {
    ...claim,
    verdict,
    confidence,
    evidence,
    explanation,
    recommendation,
    coverage,
  };
}

function getXmlText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeEntities(match?.[1] ?? "")
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .trim();
}

function stripHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function normalizeTrafficText(value: string): string {
  return decodeEntities(stripHtml(value)).replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return decodeEntities(value)
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/[，。；：、（）【】「」『』《》]/g, " ")
    .replace(/[‐‑‒–—―-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z0-9]/g, (match) => match.toUpperCase());
}

function sentenceCase(value: string): string {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function formatDirection(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized.endsWith(" bound")) {
    return `${titleCase(normalized.replace(/\s+bound$/, ""))} bound`;
  }
  if (/^(?:northbound|southbound|eastbound|westbound|inbound|outbound)$/.test(normalized)) {
    return titleCase(normalized);
  }
  return `${titleCase(normalized)} bound`;
}

function hashStable(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
