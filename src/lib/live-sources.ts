import type {
  EvidenceCoverage,
  OfficialSourceKey,
  PhaseOneClaim,
  PhaseOneEvidence,
  ReportVerdict,
  SourceFreshness,
} from "./report-contract";
import {
  evaluateTrafficClaimWithSources,
  retrieveTrafficEvidence,
  type TrafficSourceSnapshot,
} from "./traffic-sources";

const HKO_WEATHER_BASE = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";
const HKO_WARNINGS_PAGE = "https://www.hko.gov.hk/en/wxinfo/currwx/warning.htm";
const TD_SPECIAL_NEWS_URL =
  process.env.TD_SPECIAL_NEWS_URL || "https://www.td.gov.hk/en/special_news/spnews.htm";
const HKO_CACHE_MS = Number(process.env.HKO_CACHE_MS || 3 * 60 * 1000);
const RSS_CACHE_MS = Number(process.env.RSS_CACHE_MS || 3 * 60 * 1000);
const RECENT_ITEM_DAYS = Number(process.env.OFFICIAL_SOURCE_RECENT_DAYS || 14);
const MIN_RELEVANCE_SCORE = 4;
const HK_TIME_ZONE = "Asia/Hong_Kong";

const DEFAULT_RSS_FEEDS: RssFeedConfig[] = [
  {
    source_key: "govnews",
    source_name: "Government News",
    url: "https://www.news.gov.hk/eng/rss/news.xml",
  },
  {
    source_key: "edb",
    source_name: "Education Bureau",
    url: "https://www.edb.gov.hk/en/news/rss/press.xml",
  },
];

const EDUCATION_TERMS = [
  "school suspension",
  "class suspension",
  "classes suspended",
  "suspend classes",
  "suspension of classes",
  "school closure",
  "education bureau",
  "edb",
];

const TRAFFIC_TERMS = [
  "road closure",
  "road closed",
  "lane closed",
  "closed to traffic",
  "traffic diversion",
  "traffic diversions",
  "traffic queue",
  "re-opened",
  "reopened",
  "special traffic news",
];

const KOWLOON_TERMS = [
  "kowloon",
  "tsim sha tsui",
  "mong kok",
  "kwun tong",
  "yau ma tei",
  "sham shui po",
  "wong tai sin",
  "waterloo road",
  "lung cheung road",
  "nathan road",
  "lion rock tunnel",
];

const WARNING_GROUP_BY_CODE: Record<string, string> = {
  WRAINA: "WRAIN",
  WRAINR: "WRAIN",
  WRAINB: "WRAIN",
  TC1: "WTCSGNL",
  TC3: "WTCSGNL",
  TC8NE: "WTCSGNL",
  TC8SE: "WTCSGNL",
  TC8SW: "WTCSGNL",
  TC8NW: "WTCSGNL",
  TC9: "WTCSGNL",
  TC10: "WTCSGNL",
  WHOT: "WHOT",
  WCOLD: "WCOLD",
  WTS: "WTS",
  WL: "WL",
  WMSGNL: "WMSGNL",
  WFNTSA: "WFNTSA",
  WTMW: "WTMW",
  WFIREY: "WFIRE",
  WFIRER: "WFIRE",
};

export type WeatherClaimCategory =
  | "active_weather_warning"
  | "future_weather_forecast"
  | "current_weather_observation"
  | "recent_rainfall"
  | "visibility"
  | "lightning"
  | "weather_general"
  | "non_weather";

export type ClaimCategory =
  | WeatherClaimCategory
  | "education_suspension"
  | "traffic_road_closure"
  | "public_transport_disruption"
  | "public_transport_service_normal"
  | "public_transport_delay"
  | "public_transport_suspension"
  | "public_transport_cancellation"
  | "public_transport_adjustment"
  | "public_transport_resumed"
  | "public_transport_cause_claim"
  | "general_government"
  | "unsupported_category";

type HkoWeatherDataType = "warnsum" | "warningInfo" | "swt" | "flw" | "fnd" | "rhrread";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export type SourceBundle = {
  hko?: HkoBundle;
  rss?: SourceSnapshot;
  td?: SourceSnapshot | TrafficSourceSnapshot;
};

export type HkoBundle = Partial<Record<HkoWeatherDataType, SourceSnapshot>>;

export type SourceSnapshot = {
  evidence: PhaseOneEvidence[];
  freshness: SourceFreshnessSummary[];
  itemsFetched: number;
  sourceKeys: OfficialSourceKey[];
  endpointKeys: string[];
  raw?: unknown;
};

export type EvidenceRetrievalResult = {
  claims: PhaseOneClaim[];
  freshness: SourceFreshnessSummary[];
  coverage: EvidenceCoverage;
    counts: {
      official_sources_queried: number;
      feed_items_fetched: number;
      relevant_evidence_attached: number;
      unique_relevant_evidence_records?: number;
      claim_evidence_links?: number;
    };
};

export type SourceFreshnessSummary = {
  source_key: OfficialSourceKey;
  source_name: string;
  freshness: SourceFreshness;
  retrieved_at: string;
  updated_at: string | null;
  message: string;
};

export type RssFeedConfig = {
  source_key: Extract<OfficialSourceKey, "edb" | "govnews">;
  source_name: string;
  url: string;
};

export type RssItem = {
  guid: string;
  title: string;
  description: string;
  published_at: string | null;
  url: string;
};

type EvaluatedClaim = PhaseOneClaim & {
  coverage?: EvidenceCoverage;
};

type ClaimedWarning = {
  displayName: string;
  group: string;
  codes: string[];
};

let hkoCache = new Map<HkoWeatherDataType, CacheEntry<SourceSnapshot>>();
let rssCache: CacheEntry<SourceSnapshot> | null = null;

export async function retrieveLiveEvidence(
  claims: PhaseOneClaim[],
): Promise<EvidenceRetrievalResult> {
  const routes = getRequiredRoutes(claims);
  const [initialHko, rss, td] = await Promise.all([
    fetchHkoBundle(routes.hko),
    routes.rss ? getCachedRssItems() : Promise.resolve(undefined),
    routes.td ? retrieveTrafficEvidence(claims) : Promise.resolve(undefined),
  ]);
  const detailRoutes = getRequiredHkoDetailRoutes(claims, initialHko);
  const hkoDetails = await fetchHkoBundle(detailRoutes);
  const hko = { ...(initialHko ?? {}), ...(hkoDetails ?? {}) };

  return evaluateClaimsWithSources(claims, { hko, rss, td });
}

export function evaluateClaimsWithSources(
  claims: PhaseOneClaim[],
  sources: SourceBundle,
): EvidenceRetrievalResult {
  const evaluatedClaims = claims.map((claim) => evaluateClaimWithSources(claim, sources));
  const attachedCount = evaluatedClaims.reduce((sum, claim) => sum + claim.evidence.length, 0);
  const uniqueAttachedCount = countUniqueEvidenceRecords(evaluatedClaims.flatMap((claim) => claim.evidence));
  const snapshots = flattenSnapshots(sources);

  return {
    claims: evaluatedClaims,
    freshness: snapshots.flatMap((snapshot) => snapshot.freshness),
    coverage: calculateCoverage(evaluatedClaims, snapshots),
    counts: {
      official_sources_queried: snapshots.reduce(
        (sum, snapshot) => sum + snapshot.endpointKeys.length,
        0,
      ),
      feed_items_fetched: snapshots.reduce((sum, snapshot) => sum + snapshot.itemsFetched, 0),
      relevant_evidence_attached: uniqueAttachedCount,
      unique_relevant_evidence_records: uniqueAttachedCount,
      claim_evidence_links: attachedCount,
    },
  };
}

function countUniqueEvidenceRecords(evidence: PhaseOneEvidence[]): number {
  return new Set(
    evidence.map((item) =>
      [item.source_key, item.id, item.url, item.updated_at ?? "", item.title].join("|"),
    ),
  ).size;
}

function getRequiredRoutes(claims: PhaseOneClaim[]): {
  hko: Set<HkoWeatherDataType>;
  rss: boolean;
  td: boolean;
} {
  const hko = new Set<HkoWeatherDataType>();
  let rss = false;
  let td = false;

  for (const claim of claims) {
    const category = classifyClaim(claim.text);
    if (category === "active_weather_warning") {
      hko.add("warnsum");
      if (isSpecialWeatherTipRelevant(claim.text)) hko.add("swt");
    } else if (category === "future_weather_forecast") {
      hko.add("flw");
      hko.add("fnd");
      hko.add("swt");
    } else if (category === "current_weather_observation") {
      hko.add("rhrread");
    } else if (category === "recent_rainfall") {
      hko.add("rhrread");
    } else if (category === "weather_general") {
      hko.add("flw");
      hko.add("swt");
      hko.add("rhrread");
    } else if (category === "education_suspension") {
      rss = true;
    } else if (isTransportDepartmentClaimCategory(category)) {
      td = true;
    }
  }

  return { hko, rss, td };
}

function getRequiredHkoDetailRoutes(
  claims: PhaseOneClaim[],
  hko: HkoBundle | undefined,
): Set<HkoWeatherDataType> {
  const routes = new Set<HkoWeatherDataType>();
  const warnsum = hko?.warnsum;
  if (!warnsum || !isFreshAvailable(warnsum)) return routes;

  for (const claim of claims) {
    if (classifyClaim(claim.text) !== "active_weather_warning") continue;
    const claimedWarning = getClaimedWeatherWarning(claim.text);
    if (!claimedWarning) continue;
    const activeMatch = warnsum.evidence.find((item) =>
      claimedWarning.codes.includes(getEvidenceCode(item)),
    );
    if (activeMatch) routes.add("warningInfo");
  }

  return routes;
}

function evaluateClaimWithSources(claim: PhaseOneClaim, sources: SourceBundle): EvaluatedClaim {
  const category = classifyClaim(claim.text);

  if (category === "active_weather_warning") {
    return evaluateActiveWeatherWarningClaim(claim, sources.hko ?? {});
  }
  if (category === "future_weather_forecast") {
    return evaluateFutureWeatherClaim(claim, sources.hko ?? {});
  }
  if (category === "current_weather_observation" || category === "recent_rainfall") {
    return evaluateCurrentWeatherClaim(claim, sources.hko?.rhrread);
  }
  if (category === "visibility") {
    return withVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.5,
      "This claim concerns visibility. The LTMV connector is planned but not fully integrated in this pass.",
      "Check HKO visibility data directly until this connector is enabled.",
      "none",
    );
  }
  if (category === "lightning") {
    return withVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.5,
      "This claim concerns lightning. The LHL connector is planned but not fully integrated in this pass.",
      "Check HKO lightning data directly until this connector is enabled.",
      "none",
    );
  }
  if (category === "weather_general") {
    return evaluateGeneralWeatherClaim(claim, sources.hko ?? {});
  }
  if (category === "education_suspension") {
    return evaluateEducationClaim(
      claim,
      sources.rss ?? emptySnapshot("govnews", "Government News"),
    );
  }
  if (isTransportDepartmentClaimCategory(category)) {
    return evaluateTrafficClaimWithSources(claim, sources.td);
  }

  return withVerdict(
    claim,
    "insufficient_evidence",
    [],
    0.45,
    "No matching live official source category was selected for this claim.",
    "Treat this as preliminary analysis only until a suitable official source connector is available.",
    "none",
  );
}

export function classifyClaim(text: string): ClaimCategory {
  const normalized = normalizeText(text);

  if (
    /(school|class|classes|education bureau|edb).*(suspend|suspension|closed|closure)|suspend.*(school|class|classes)/.test(
      normalized,
    )
  ) {
    return "education_suspension";
  }
  const publicTransportCategory = classifyPublicTransportClaim(normalized);
  if (publicTransportCategory) return publicTransportCategory;
  if (
    /(road|rd|street|lane|traffic|closure|closed|diversion|kowloon|tunnel|highway|bus|mtr|tram|ferry|route|public transport|congest|busy|reopen)/.test(
      normalized,
    )
  ) {
    return "traffic_road_closure";
  }

  const weatherLike =
    !hasPublicTransportWeatherGuard(normalized) &&
    /(weather|rain|rainstorm|typhoon|cyclone|monsoon|thunderstorm|observatory|hko|temperature|degrees|forecast|visibility|lightning|wind|humidity|hot|cold)/.test(
      normalized,
    );
  if (!weatherLike) {
    if (/(government|department|bureau|policy|public)/.test(normalized)) {
      return "general_government";
    }
    return "unsupported_category";
  }

  if (
    /(warning|signal|rainstorm|typhoon|cyclone|thunderstorm|monsoon|landslip|tsunami|fire danger|very hot|cold weather|black rain|red rain|amber rain)/.test(
      normalized,
    ) &&
    /(active|issued|in force|hoisted|currently|now|has issued|is issued|signal no)/.test(normalized)
  ) {
    return "active_weather_warning";
  }
  if (
    /(tomorrow|later|next|forecast|will|expected|may affect|coming|nine day|9 day)/.test(normalized)
  ) {
    return "future_weather_forecast";
  }
  if (/(visibility|visible|fog|haze|mist|below \d+ ?km)/.test(normalized)) return "visibility";
  if (/(lightning|thunderstorm activity|strike)/.test(normalized)) return "lightning";
  if (/(heavy rain|rainfall|past hour|last hour|mm|flood|flooding)/.test(normalized)) {
    return "recent_rainfall";
  }
  if (/(currently|now|current|experiencing|temperature|humidity|uv index|rain)/.test(normalized)) {
    return "current_weather_observation";
  }
  return "weather_general";
}

function classifyPublicTransportClaim(normalized: string): ClaimCategory | null {
  if (!isPublicTransportLike(normalized)) return null;
  if (/(caused by|cause is|due to|because of|technical fault|train fault)/.test(normalized)) {
    return "public_transport_cause_claim";
  }
  if (/(operating normally|normal service|services are normal|running normally)/.test(normalized)) {
    return "public_transport_service_normal";
  }
  if (/(resumed|service has resumed|traffic has resumed)/.test(normalized)) {
    return "public_transport_resumed";
  }
  if (/(suspend|suspension|suspended)/.test(normalized)) return "public_transport_suspension";
  if (/(cancel|cancelled|canceled|cancellation)/.test(normalized)) {
    return "public_transport_cancellation";
  }
  if (/(delay|delayed)/.test(normalized)) return "public_transport_delay";
  if (/(adjust|adjusted|temporary|divert|diverted)/.test(normalized)) {
    return "public_transport_adjustment";
  }
  if (/(disrupt|disruption|service disruption|service affected|service).*/.test(normalized)) {
    return "public_transport_disruption";
  }
  return null;
}

function isPublicTransportLike(normalized: string): boolean {
  return (
    /(mtr|railway|metro|train|station|service disruption|technical fault|ferry|bus|tram|minibus|public transport)/.test(
      normalized,
    ) ||
    /\bdisruption\b.*\b(caused by|cause|technical fault)\b/.test(normalized) ||
    /\b[a-z0-9]+(?:\s+[a-z0-9]+){0,5}\s+line\b/.test(normalized)
  );
}

function hasPublicTransportWeatherGuard(normalized: string): boolean {
  return /(train|railway|mtr|metro|station|service disruption|technical fault|ferry|bus|tram|minibus)/.test(
    normalized,
  );
}

function isTransportDepartmentClaimCategory(category: ClaimCategory): boolean {
  return (
    category === "traffic_road_closure" ||
    category === "public_transport_disruption" ||
    category === "public_transport_service_normal" ||
    category === "public_transport_delay" ||
    category === "public_transport_suspension" ||
    category === "public_transport_cancellation" ||
    category === "public_transport_adjustment" ||
    category === "public_transport_resumed" ||
    category === "public_transport_cause_claim"
  );
}

function evaluateActiveWeatherWarningClaim(claim: PhaseOneClaim, hko: HkoBundle): EvaluatedClaim {
  const warnsum = hko.warnsum;
  if (!warnsum || !isFreshAvailable(warnsum)) {
    return withVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.45,
      "The HKO current weather warning summary was unavailable, stale or malformed, so VeriHK could not verify this warning claim.",
      "Check the HKO warning page directly and retry when the official warning summary is available.",
      "none",
    );
  }

  const claimedWarning = getClaimedWeatherWarning(claim.text);
  if (!claimedWarning) {
    return withVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.55,
      "The claim appears to concern an active weather warning, but VeriHK could not identify a specific warning code to compare with HKO.",
      "Use a specific warning name or signal number, then retry the verification.",
      "low",
    );
  }

  const activeMatch = warnsum.evidence.find((item) =>
    claimedWarning.codes.includes(getEvidenceCode(item)),
  );
  if (activeMatch) {
    const evidence = [
      { ...activeMatch, relevance_score: 10 },
      ...findDetailedWarningEvidence(claimedWarning, hko.warningInfo),
    ].slice(0, 2);
    return withVerdict(
      claim,
      "supported",
      evidence,
      0.94,
      `The Hong Kong Observatory Warning Summary currently lists an active ${claimedWarning.displayName}.`,
      "Continue monitoring the Hong Kong Observatory for any warning updates if weather conditions change.",
      "high",
    );
  }

  const groupEvidence = warnsum.evidence.find(
    (item) => getEvidenceWarningGroup(item) === claimedWarning.group,
  );
  const negativeEvidence = createNegativeWarningEvidence(
    claimedWarning,
    groupEvidence,
    warnsum,
    claim.id,
  );
  return withVerdict(
    claim,
    "refuted",
    [negativeEvidence],
    0.9,
    `The Hong Kong Observatory Warning Summary does not currently include an active ${claimedWarning.displayName}.`,
    "Continue monitoring the Hong Kong Observatory for any warning updates if weather conditions change.",
    "high",
  );
}

function evaluateFutureWeatherClaim(claim: PhaseOneClaim, hko: HkoBundle): EvaluatedClaim {
  const snapshots = [hko.flw, hko.fnd, hko.swt].filter(Boolean) as SourceSnapshot[];
  const freshEvidence = snapshots.flatMap((snapshot) =>
    snapshot.evidence.filter((item) => item.freshness === "fresh"),
  );
  if (!snapshots.length || snapshots.every((snapshot) => !isFreshAvailable(snapshot))) {
    return withVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.45,
      "The HKO forecast sources were unavailable or stale, so VeriHK could not verify this future-weather claim.",
      "Review the latest HKO forecast and special weather tips as conditions may change.",
      "none",
    );
  }

  const temperatureClaim = extractTemperatureClaim(claim.text);
  if (temperatureClaim) {
    const matchedForecast = findTemperatureForecastMatch(freshEvidence, temperatureClaim);
    if (matchedForecast) {
      return withVerdict(
        claim,
        matchedForecast.supported ? "supported" : "refuted",
        [{ ...matchedForecast.evidence, relevance_score: 9 }],
        matchedForecast.supported ? 0.86 : 0.82,
        matchedForecast.supported
          ? "The claim concerns future weather. HKO nine-day forecast includes a temperature range that supports the stated measurable temperature."
          : "The claim concerns future weather. HKO nine-day forecast gives a temperature range that contradicts the stated measurable temperature.",
        "Review the latest HKO forecast and special weather tips as conditions may change.",
        "high",
      );
    }
  }

  const relevant = freshEvidence
    .map((item) => ({ item, score: scoreForecastEvidence(item, claim.text) }))
    .filter(({ score }) => score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item, score }) => ({ ...item, relevance_score: score }));

  return withVerdict(
    claim,
    "insufficient_evidence",
    relevant,
    relevant.length ? 0.68 : 0.58,
    "The claim concerns future weather. Current warning status alone is insufficient, so VeriHK checked the HKO local forecast, nine-day forecast and special weather tips.",
    "Review the latest HKO forecast and special weather tips as conditions may change.",
    relevant.length ? "medium" : "low",
  );
}

function evaluateCurrentWeatherClaim(
  claim: PhaseOneClaim,
  rhrread: SourceSnapshot | undefined,
): EvaluatedClaim {
  if (!rhrread || !isFreshAvailable(rhrread)) {
    return withVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.45,
      "The HKO current local weather report was unavailable or stale, so VeriHK could not verify this current-weather claim.",
      "Check the latest HKO local weather report and retry when the source is available.",
      "none",
    );
  }
  const evidence = rhrread.evidence
    .map((item) => ({ item, score: scoreGeneralWeatherEvidence(item, claim.text) }))
    .filter(({ score }) => score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item, score }) => ({ ...item, relevance_score: score }));

  return withVerdict(
    claim,
    "insufficient_evidence",
    evidence,
    evidence.length ? 0.68 : 0.58,
    evidence.length
      ? "HKO current local weather report contains relevant live observation context, but the prototype does not yet perform full numeric observation matching."
      : "HKO current local weather report was checked, but no directly matching observation was found for this claim.",
    "Review the latest HKO local weather report before acting on this claim.",
    evidence.length ? "medium" : "low",
  );
}

function evaluateGeneralWeatherClaim(claim: PhaseOneClaim, hko: HkoBundle): EvaluatedClaim {
  const evidence = [hko.flw, hko.fnd, hko.swt, hko.rhrread]
    .filter(Boolean)
    .flatMap((snapshot) => snapshot?.evidence ?? [])
    .filter((item) => item.freshness === "fresh")
    .map((item) => ({ item, score: scoreGeneralWeatherEvidence(item, claim.text) }))
    .filter(({ score }) => score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item, score }) => ({ ...item, relevance_score: score }));

  return withVerdict(
    claim,
    "insufficient_evidence",
    evidence,
    evidence.length ? 0.66 : 0.54,
    evidence.length
      ? "Selected HKO weather sources contain relevant official context, but the claim is too broad for a deterministic verdict."
      : "Selected HKO weather sources were checked, but no directly relevant official evidence was found for this broad weather claim.",
    "Use a more specific weather claim, including warning name, date, location or measurable value, for stronger verification.",
    evidence.length ? "medium" : "low",
  );
}

function evaluateEducationClaim(claim: PhaseOneClaim, rss: SourceSnapshot): EvaluatedClaim {
  const matches = rss.evidence
    .filter((item) => item.freshness === "fresh")
    .filter((item) => item.source_key === "edb" || item.source_key === "govnews")
    .map((item) => ({ item, score: scoreEducationEvidence(item, claim.text) }))
    .filter(({ score }) => score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item, score }) => ({ ...item, relevance_score: score }));

  if (!matches.length) {
    return withVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.62,
      "Live RSS sources were checked, but no directly relevant school or class suspension announcement was found.",
      "Treat this as insufficient evidence. Check EDB announcements for any later school suspension notice.",
      "low",
    );
  }

  return withVerdict(
    claim,
    "insufficient_evidence",
    matches,
    0.76,
    "VeriHK found live RSS item(s) that directly mention school or class suspension, but the prototype does not yet determine full entailment for tomorrow-specific claims.",
    "Read the attached EDB or Government News item and confirm date, class type and coverage before acting.",
    "medium",
  );
}

function evaluateTrafficClaim(claim: PhaseOneClaim, td: SourceSnapshot): EvaluatedClaim {
  const matches = td.evidence
    .filter((item) => item.freshness === "fresh")
    .map((item) => ({ item, score: scoreTrafficEvidence(item, claim.text) }))
    .filter(({ score }) => score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item, score }) => ({ ...item, relevance_score: score }));

  if (!matches.length) {
    return withVerdict(
      claim,
      "insufficient_evidence",
      [],
      0.62,
      "The Transport Department live traffic source was checked, but no directly relevant Kowloon road closure notice was found.",
      "Treat this as insufficient evidence. Check Transport Department or HKeMobility for later traffic notices.",
      "low",
    );
  }

  return withVerdict(
    claim,
    "insufficient_evidence",
    matches,
    0.78,
    "VeriHK found live Transport Department item(s) with relevant road, closure, traffic, district or location terms, but the prototype does not yet infer broad closure expectations.",
    "Read the attached Transport Department notice and confirm the affected road, lane, direction and time.",
    "medium",
  );
}

function withVerdict(
  claim: PhaseOneClaim,
  verdict: ReportVerdict,
  evidence: PhaseOneEvidence[],
  confidence: number,
  explanation: string,
  recommendation: string,
  coverage: EvidenceCoverage,
): EvaluatedClaim {
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

async function fetchHkoBundle(dataTypes: Set<HkoWeatherDataType>): Promise<HkoBundle | undefined> {
  if (!dataTypes.size) return undefined;
  const entries = await Promise.all(
    [...dataTypes].map(
      async (dataType) => [dataType, await getCachedHkoEndpoint(dataType)] as const,
    ),
  );
  return Object.fromEntries(entries) as HkoBundle;
}

async function getCachedHkoEndpoint(dataType: HkoWeatherDataType): Promise<SourceSnapshot> {
  const cached = hkoCache.get(dataType);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await fetchHkoWeatherEndpoint(dataType);
  hkoCache.set(dataType, { expiresAt: Date.now() + HKO_CACHE_MS, value });
  return value;
}

async function fetchHkoWeatherEndpoint(dataType: HkoWeatherDataType): Promise<SourceSnapshot> {
  const retrievedAt = new Date().toISOString();
  const url = hkoWeatherUrl(dataType);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return unavailableSnapshot(
        "hko",
        "Hong Kong Observatory",
        retrievedAt,
        `${dataType} request failed.`,
        dataType,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    if (dataType === "warnsum") return hkoSnapshotFromPayload(payload, retrievedAt);
    if (dataType === "warningInfo") return warningInfoSnapshotFromPayload(payload, retrievedAt);
    if (dataType === "swt") return swtSnapshotFromPayload(payload, retrievedAt);
    if (dataType === "flw") return flwSnapshotFromPayload(payload, retrievedAt);
    if (dataType === "fnd") return fndSnapshotFromPayload(payload, retrievedAt);
    return rhrreadSnapshotFromPayload(payload, retrievedAt);
  } catch {
    return unavailableSnapshot(
      "hko",
      "Hong Kong Observatory",
      retrievedAt,
      `${dataType} data unavailable.`,
      dataType,
    );
  }
}

export function hkoSnapshotFromPayload(
  payload: Record<string, unknown>,
  retrievedAt: string,
): SourceSnapshot {
  const warnings = Object.entries(payload).flatMap(([key, value]) =>
    normalizeHkoWarning(key, value, retrievedAt),
  );
  const latestUpdatedAt = latestIso(warnings.map((item) => item.updated_at));

  return hkoSnapshot(
    "warnsum",
    warnings,
    retrievedAt,
    latestUpdatedAt,
    warnings.length
      ? "Fetched HKO Current Weather Warning Summary."
      : "Fetched HKO Current Weather Warning Summary; no active warning records were present.",
    payload,
  );
}

export function warningInfoSnapshotFromPayload(
  payload: Record<string, unknown>,
  retrievedAt: string,
): SourceSnapshot {
  const details = Array.isArray(payload.details) ? payload.details : [];
  const evidence = details.flatMap((item, index) => normalizeWarningInfo(item, index, retrievedAt));
  return hkoSnapshot(
    "warningInfo",
    evidence,
    retrievedAt,
    latestIso(evidence.map((item) => item.updated_at)),
    "Fetched HKO Detailed Weather Warning Information.",
    payload,
  );
}

export function swtSnapshotFromPayload(
  payload: Record<string, unknown>,
  retrievedAt: string,
): SourceSnapshot {
  const tips = Array.isArray(payload.swt) ? payload.swt : [];
  const evidence = tips.flatMap((item, index) =>
    normalizeSpecialWeatherTip(item, index, retrievedAt),
  );
  return hkoSnapshot(
    "swt",
    evidence,
    retrievedAt,
    latestIso(evidence.map((item) => item.updated_at)),
    "Fetched HKO Special Weather Tips.",
    payload,
  );
}

export function flwSnapshotFromPayload(
  payload: Record<string, unknown>,
  retrievedAt: string,
): SourceSnapshot {
  const updatedAt = parseOfficialDate(getString(payload.updateTime));
  const summary = [
    getString(payload.generalSituation),
    getString(payload.forecastPeriod),
    getString(payload.forecastDesc),
    getString(payload.outlook),
  ]
    .filter(Boolean)
    .join(" ");
  const evidence = summary
    ? [
        officialHkoEvidence({
          id: "hko-flw",
          dataType: "flw",
          title: "HKO Local Weather Forecast",
          summary: truncate(summary, 500),
          retrievedAt,
          updatedAt,
          publishedAt: updatedAt,
          category: "future_weather_forecast",
        }),
      ]
    : [];
  return hkoSnapshot(
    "flw",
    evidence,
    retrievedAt,
    updatedAt,
    "Fetched HKO Local Weather Forecast.",
    payload,
  );
}

export function fndSnapshotFromPayload(
  payload: Record<string, unknown>,
  retrievedAt: string,
): SourceSnapshot {
  const forecasts = Array.isArray(payload.weatherForecast) ? payload.weatherForecast : [];
  const evidence = forecasts.flatMap((item, index) =>
    normalizeNineDayForecast(item, index, retrievedAt),
  );
  return hkoSnapshot(
    "fnd",
    evidence,
    retrievedAt,
    latestIso(evidence.map((item) => item.updated_at)),
    "Fetched HKO Nine-day Weather Forecast.",
    payload,
  );
}

export function rhrreadSnapshotFromPayload(
  payload: Record<string, unknown>,
  retrievedAt: string,
): SourceSnapshot {
  const updatedAt = parseOfficialDate(getString(payload.updateTime));
  const parts = [
    summarizeDataArray(payload.temperature, "Temperature"),
    summarizeDataArray(payload.rainfall, "Rainfall"),
    summarizeDataArray(payload.humidity, "Humidity"),
    summarizeDataArray(payload.uvindex, "UV index"),
    summarizeStringArray(payload.warningMessage, "Warning messages"),
    summarizeStringArray(payload.specialWxTips, "Special weather tips"),
  ].filter(Boolean);
  const evidence = parts.length
    ? [
        officialHkoEvidence({
          id: "hko-rhrread",
          dataType: "rhrread",
          title: "HKO Current Local Weather Report",
          summary: truncate(parts.join(" "), 700),
          retrievedAt,
          updatedAt,
          publishedAt: updatedAt,
          category: "current_weather_observation",
        }),
      ]
    : [];
  return hkoSnapshot(
    "rhrread",
    evidence,
    retrievedAt,
    updatedAt,
    "Fetched HKO Current Local Weather Report.",
    payload,
  );
}

function normalizeHkoWarning(key: string, value: unknown, retrievedAt: string): PhaseOneEvidence[] {
  if (!isRecord(value)) return [];

  const rawCode = getString(value.code);
  const code = normalizeWarningCode(rawCode, getString(value.type), key);
  const actionCode = getString(value.actionCode);
  const name = getString(value.name);
  const type = getString(value.type);
  const title = warningDisplayName(code, name || type || key);
  const updatedAt = parseOfficialDate(getString(value.updateTime) || getString(value.issueTime));
  const publishedAt = parseOfficialDate(getString(value.issueTime));
  const summaryParts = [title, code, actionCode, type].filter(Boolean);

  return [
    officialHkoEvidence({
      id: `hko-warnsum-${key}`,
      dataType: "warnsum",
      title,
      summary: summaryParts.join(" · ") || title,
      retrievedAt,
      updatedAt,
      publishedAt,
      category: "weather_warning",
      extra: {
        excerpt: `${title} is active in the HKO current weather warning summary.`,
      },
    }),
  ];
}

function normalizeWarningInfo(
  value: unknown,
  index: number,
  retrievedAt: string,
): PhaseOneEvidence[] {
  if (!isRecord(value)) return [];
  const statementCode = getString(value.warningStatementCode);
  const subtype = getString(value.subtype);
  const updatedAt = parseOfficialDate(getString(value.updateTime));
  const contents = Array.isArray(value.contents)
    ? value.contents.filter((item): item is string => typeof item === "string")
    : [];
  const code = normalizeWarningCode(subtype || statementCode, null, statementCode || "");
  const title = warningDisplayName(code, statementCode || "Detailed Weather Warning Information");
  const excerpt = truncate(contents.join(" "), 260);

  return [
    officialHkoEvidence({
      id: `hko-warningInfo-${index + 1}`,
      dataType: "warningInfo",
      title,
      summary: [statementCode, subtype, excerpt].filter(Boolean).join(" · "),
      retrievedAt,
      updatedAt,
      publishedAt: updatedAt,
      category: "weather_warning",
      extra: { excerpt },
    }),
  ];
}

function normalizeSpecialWeatherTip(
  value: unknown,
  index: number,
  retrievedAt: string,
): PhaseOneEvidence[] {
  if (!isRecord(value)) return [];
  const updatedAt = parseOfficialDate(getString(value.updateTime));
  const desc = getString(value.desc);
  if (!desc) return [];
  return [
    officialHkoEvidence({
      id: `hko-swt-${index + 1}`,
      dataType: "swt",
      title: "HKO Special Weather Tip",
      summary: truncate(desc, 420),
      retrievedAt,
      updatedAt,
      publishedAt: updatedAt,
      category: "weather_tip",
      extra: { excerpt: truncate(desc, 260) },
    }),
  ];
}

function normalizeNineDayForecast(
  value: unknown,
  index: number,
  retrievedAt: string,
): PhaseOneEvidence[] {
  if (!isRecord(value)) return [];
  const date = getString(value.forecastDate);
  const weather = getString(value.forecastWeather);
  const wind = getString(value.forecastWind);
  const psr = getString(value.PSR);
  const max = getNestedNumber(value.forecastMaxtemp);
  const min = getNestedNumber(value.forecastMintemp);
  const maxRh = getNestedNumber(value.forecastMaxrh);
  const minRh = getNestedNumber(value.forecastMinrh);
  const tempText =
    min !== null && max !== null ? `Temperature range ${min}-${max} C.` : "Temperature not stated.";
  const rhText = minRh !== null && maxRh !== null ? `Relative humidity ${minRh}-${maxRh}%.` : "";
  const summary = [
    date,
    weather,
    tempText,
    wind,
    rhText,
    psr ? `Rainfall probability: ${psr}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    officialHkoEvidence({
      id: `hko-fnd-${date || index + 1}`,
      dataType: "fnd",
      title: `HKO Nine-day Forecast${date ? ` ${date}` : ""}`,
      summary,
      retrievedAt,
      updatedAt: null,
      publishedAt: null,
      category: "future_weather_forecast",
      extra: { excerpt: truncate(summary, 260) },
    }),
  ];
}

function hkoSnapshot(
  dataType: HkoWeatherDataType,
  evidence: PhaseOneEvidence[],
  retrievedAt: string,
  updatedAt: string | null,
  message: string,
  raw?: unknown,
): SourceSnapshot {
  const freshness = updatedAt && isStale(updatedAt) ? "stale" : "fresh";
  return {
    evidence,
    freshness: [
      {
        source_key: "hko",
        source_name: `Hong Kong Observatory ${dataType}`,
        freshness,
        retrieved_at: retrievedAt,
        updated_at: updatedAt,
        message,
      },
    ],
    itemsFetched: Math.max(evidence.length, 1),
    sourceKeys: ["hko"],
    endpointKeys: [`hko:${dataType}`],
    raw,
  };
}

function officialHkoEvidence({
  id,
  dataType,
  title,
  summary,
  retrievedAt,
  updatedAt,
  publishedAt,
  category,
  extra,
}: {
  id: string;
  dataType: HkoWeatherDataType;
  title: string;
  summary: string;
  retrievedAt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  category: string;
  extra?: Partial<PhaseOneEvidence>;
}): PhaseOneEvidence {
  return {
    id,
    source_key: "hko",
    source_name: "Hong Kong Observatory",
    source_authority: "official",
    source_type: dataType === "warnsum" ? "hko_warning" : "official_api",
    category,
    title,
    excerpt: extra?.excerpt,
    summary,
    url: dataType === "warnsum" ? hkoWeatherUrl(dataType) : hkoWeatherUrl(dataType),
    published_at: publishedAt,
    updated_at: updatedAt,
    retrieved_at: retrievedAt,
    freshness: updatedAt && isStale(updatedAt) ? "stale" : "fresh",
    ...extra,
  };
}

function createNegativeWarningEvidence(
  claimedWarning: ClaimedWarning,
  groupEvidence: PhaseOneEvidence | undefined,
  warnsum: SourceSnapshot,
  claimId: string,
): PhaseOneEvidence {
  const freshness = warnsum.freshness[0];
  const activeText = groupEvidence
    ? `The related active HKO warning is ${groupEvidence.title}.`
    : "The relevant warning group is absent from the HKO warning summary.";
  const excerpt = `No ${claimedWarning.displayName} is currently active in the HKO warning summary. ${activeText}`;

  return officialHkoEvidence({
    id: `hko-negative-${claimId}-${claimedWarning.codes[0]}`,
    dataType: "warnsum",
    title: "Current Weather Warning Summary",
    summary: excerpt,
    retrievedAt: freshness?.retrieved_at ?? new Date().toISOString(),
    updatedAt: groupEvidence?.updated_at ?? freshness?.updated_at ?? null,
    publishedAt: groupEvidence?.published_at ?? null,
    category: "weather_warning",
    extra: {
      excerpt,
      relevance_score: 10,
    },
  });
}

function findDetailedWarningEvidence(
  claimedWarning: ClaimedWarning,
  warningInfo: SourceSnapshot | undefined,
): PhaseOneEvidence[] {
  if (!warningInfo || !isFreshAvailable(warningInfo)) return [];
  return warningInfo.evidence
    .filter((item) => {
      const code = getEvidenceCode(item);
      const group = getEvidenceWarningGroup(item);
      return claimedWarning.codes.includes(code) || group === claimedWarning.group;
    })
    .slice(0, 1)
    .map((item) => ({ ...item, relevance_score: 9 }));
}

function getClaimedWeatherWarning(text: string): ClaimedWarning | null {
  const normalized = normalizeText(text);
  if (normalized.includes("black") && normalized.includes("rain")) {
    return { displayName: "Black Rainstorm Warning", group: "WRAIN", codes: ["WRAINB"] };
  }
  if (normalized.includes("red") && normalized.includes("rain")) {
    return { displayName: "Red Rainstorm Warning", group: "WRAIN", codes: ["WRAINR"] };
  }
  if (normalized.includes("amber") && normalized.includes("rain")) {
    return { displayName: "Amber Rainstorm Warning", group: "WRAIN", codes: ["WRAINA"] };
  }
  if (/signal no ?8|signal 8|no ?8|number 8|typhoon signal 8/.test(normalized)) {
    return {
      displayName: "Tropical Cyclone Warning Signal No. 8",
      group: "WTCSGNL",
      codes: ["TC8NE", "TC8SE", "TC8SW", "TC8NW"],
    };
  }
  if (/signal no ?3|signal 3|no ?3|number 3/.test(normalized)) {
    return {
      displayName: "Tropical Cyclone Warning Signal No. 3",
      group: "WTCSGNL",
      codes: ["TC3"],
    };
  }
  if (/signal no ?1|signal 1|no ?1|number 1/.test(normalized)) {
    return {
      displayName: "Tropical Cyclone Warning Signal No. 1",
      group: "WTCSGNL",
      codes: ["TC1"],
    };
  }
  if (normalized.includes("typhoon") || normalized.includes("tropical cyclone")) {
    return {
      displayName: "Tropical Cyclone Warning Signal",
      group: "WTCSGNL",
      codes: ["TC1", "TC3", "TC8NE", "TC8SE", "TC8SW", "TC8NW", "TC9", "TC10"],
    };
  }
  if (normalized.includes("very hot") || normalized.includes("hot weather")) {
    return { displayName: "Very Hot Weather Warning", group: "WHOT", codes: ["WHOT"] };
  }
  if (normalized.includes("cold weather")) {
    return { displayName: "Cold Weather Warning", group: "WCOLD", codes: ["WCOLD"] };
  }
  if (normalized.includes("thunderstorm")) {
    return { displayName: "Thunderstorm Warning", group: "WTS", codes: ["WTS"] };
  }
  if (normalized.includes("landslip")) {
    return { displayName: "Landslip Warning", group: "WL", codes: ["WL"] };
  }
  return null;
}

function normalizeWarningCode(code: string | null, type: string | null, fallback: string): string {
  const value = normalizeText([code, type, fallback].filter(Boolean).join(" "));
  if (value.includes("black") || value.includes("wrainb")) return "WRAINB";
  if (value.includes("red") || value.includes("wrainr")) return "WRAINR";
  if (value.includes("amber") || value.includes("wraina")) return "WRAINA";
  if (value.includes("tc8se")) return "TC8SE";
  if (value.includes("tc8ne")) return "TC8NE";
  if (value.includes("tc8sw")) return "TC8SW";
  if (value.includes("tc8nw")) return "TC8NW";
  if (value.includes("tc10")) return "TC10";
  if (value.includes("tc9")) return "TC9";
  if (value.includes("tc3")) return "TC3";
  if (value.includes("tc1")) return "TC1";
  const raw = (code || fallback || "").toUpperCase();
  return raw;
}

function warningDisplayName(code: string, fallback: string): string {
  if (code === "WRAINB") return "Black Rainstorm Warning";
  if (code === "WRAINR") return "Red Rainstorm Warning";
  if (code === "WRAINA") return "Amber Rainstorm Warning";
  if (code.startsWith("TC8")) return "Tropical Cyclone Warning Signal No. 8";
  if (code === "TC3") return "Tropical Cyclone Warning Signal No. 3";
  if (code === "TC1") return "Tropical Cyclone Warning Signal No. 1";
  if (code === "TC9") return "Tropical Cyclone Warning Signal No. 9";
  if (code === "TC10") return "Tropical Cyclone Warning Signal No. 10";
  if (code === "WHOT") return "Very Hot Weather Warning";
  if (code === "WCOLD") return "Cold Weather Warning";
  if (code === "WTS") return "Thunderstorm Warning";
  return fallback;
}

function getEvidenceCode(evidence: PhaseOneEvidence): string {
  return normalizeWarningCode(null, null, `${evidence.title} ${evidence.summary}`);
}

function getEvidenceWarningGroup(evidence: PhaseOneEvidence): string {
  return WARNING_GROUP_BY_CODE[getEvidenceCode(evidence)] ?? "";
}

function extractTemperatureClaim(
  text: string,
): { value: number; direction: "reach" | "above" | "below" } | null {
  const normalized = normalizeText(text);
  const match = normalized.match(/(\d{1,2})\s*(?:degrees|degree|c|celsius)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  if (/(below|under|less than|lower than)/.test(normalized)) return { value, direction: "below" };
  if (/(above|over|more than|higher than|exceed)/.test(normalized))
    return { value, direction: "above" };
  return { value, direction: "reach" };
}

function findTemperatureForecastMatch(
  evidence: PhaseOneEvidence[],
  claim: { value: number; direction: "reach" | "above" | "below" },
): { evidence: PhaseOneEvidence; supported: boolean } | null {
  const forecast = evidence.find((item) => item.id.startsWith("hko-fnd-"));
  if (!forecast) return null;
  const range = forecast.summary.match(/Temperature range (\d+(?:\.\d+)?)-(\d+(?:\.\d+)?) C/);
  if (!range) return null;
  const min = Number(range[1]);
  const max = Number(range[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (claim.direction === "below") return { evidence: forecast, supported: min < claim.value };
  return { evidence: forecast, supported: max >= claim.value };
}

function scoreForecastEvidence(evidence: PhaseOneEvidence, claimText: string): number {
  const haystack = normalizeText(`${evidence.title} ${evidence.summary}`);
  const claim = normalizeText(claimText);
  let score = 0;
  for (const term of [
    "rain",
    "wind",
    "temperature",
    "degrees",
    "severe",
    "thunderstorm",
    "very hot",
    "cold",
  ]) {
    if (haystack.includes(term) && claim.includes(term)) score += 2;
  }
  if (evidence.id.startsWith("hko-fnd") && /(tomorrow|will|degrees|temperature)/.test(claim))
    score += 3;
  if (evidence.id === "hko-flw" && /(heavy rain|thunderstorm|very hot|cold|windy)/.test(claim)) {
    score += 3;
  }
  if (evidence.id.startsWith("hko-swt") && /(severe|special|may affect|typhoon|rain)/.test(claim))
    score += 3;
  return score;
}

function scoreGeneralWeatherEvidence(evidence: PhaseOneEvidence, claimText: string): number {
  const haystack = normalizeText(`${evidence.title} ${evidence.summary}`);
  const claim = normalizeText(claimText);
  let score = 0;
  for (const term of [
    "rain",
    "temperature",
    "humidity",
    "uv",
    "warning",
    "wind",
    "weather",
    "forecast",
  ]) {
    if (haystack.includes(term) && claim.includes(term)) score += 2;
  }
  return score;
}

function calculateCoverage(
  claims: EvaluatedClaim[],
  snapshots: SourceSnapshot[],
): EvidenceCoverage {
  if (claims.some((claim) => claim.coverage === "high")) return "high";
  if (claims.some((claim) => claim.coverage === "medium")) return "medium";
  if (claims.some((claim) => claim.coverage === "low")) return "low";
  if (snapshots.some(isFreshAvailable)) return "low";
  return "none";
}

function flattenSnapshots(sources: SourceBundle): SourceSnapshot[] {
  return [
    ...Object.values(sources.hko ?? {}),
    ...(sources.rss ? [sources.rss] : []),
    ...(sources.td ? [sources.td] : []),
  ];
}

function isFreshAvailable(snapshot: SourceSnapshot): boolean {
  return snapshot.freshness.some((item) => item.freshness === "fresh");
}

function isSpecialWeatherTipRelevant(text: string): boolean {
  return /(pre ?8|special|tip|school|class|localised|localized|heavy rain)/i.test(text);
}

function hkoWeatherUrl(dataType: HkoWeatherDataType): string {
  return `${HKO_WEATHER_BASE}?dataType=${dataType}&lang=en`;
}

function getConfiguredRssFeeds(): RssFeedConfig[] {
  const raw = process.env.OFFICIAL_RSS_FEEDS;
  if (!raw) return DEFAULT_RSS_FEEDS;

  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((url) => inferRssFeedConfig(url));
}

function inferRssFeedConfig(url: string): RssFeedConfig {
  if (url.includes("edb.gov.hk")) {
    return { source_key: "edb", source_name: "Education Bureau", url };
  }
  return { source_key: "govnews", source_name: "Government News", url };
}

async function getCachedRssItems(): Promise<SourceSnapshot> {
  if (rssCache && rssCache.expiresAt > Date.now()) return rssCache.value;
  const value = await fetchRssFeeds();
  rssCache = { expiresAt: Date.now() + RSS_CACHE_MS, value };
  return value;
}

async function fetchRssFeeds(): Promise<SourceSnapshot> {
  const snapshots = await Promise.all(getConfiguredRssFeeds().map(fetchRssFeed));
  const byKey = new Map<string, PhaseOneEvidence>();

  for (const item of snapshots.flatMap((snapshot) => snapshot.evidence)) {
    byKey.set(item.id, item);
  }

  return {
    evidence: [...byKey.values()],
    freshness: snapshots.flatMap((snapshot) => snapshot.freshness),
    itemsFetched: snapshots.reduce((sum, snapshot) => sum + snapshot.itemsFetched, 0),
    sourceKeys: snapshots.flatMap((snapshot) => snapshot.sourceKeys),
    endpointKeys: snapshots.flatMap((snapshot) => snapshot.endpointKeys),
  };
}

async function fetchRssFeed(feed: RssFeedConfig): Promise<SourceSnapshot> {
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(feed.url, {
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!response.ok) {
      return unavailableSnapshot(
        feed.source_key,
        feed.source_name,
        retrievedAt,
        "RSS request failed.",
        feed.source_key,
      );
    }

    const xml = await response.text();
    const items = dedupeRssItems(parseRssItems(xml)).filter((item) => isRecent(item.published_at));
    return rssSnapshotFromItems(feed, items, retrievedAt);
  } catch {
    return unavailableSnapshot(
      feed.source_key,
      feed.source_name,
      retrievedAt,
      "RSS data unavailable.",
      feed.source_key,
    );
  }
}

export function rssSnapshotFromItems(
  feed: RssFeedConfig,
  items: RssItem[],
  retrievedAt: string,
): SourceSnapshot {
  const latestPublishedAt = latestIso(items.map((item) => item.published_at));

  return {
    evidence: items.map((item) => ({
      id: `${feed.source_key}-${hashStable(item.guid || item.url)}`,
      source_key: feed.source_key,
      source_name: feed.source_name,
      source_type: "rss_item",
      title: item.title,
      summary: item.description,
      url: item.url,
      published_at: item.published_at,
      updated_at: item.published_at,
      retrieved_at: retrievedAt,
      freshness: item.published_at && isStale(item.published_at) ? "stale" : "fresh",
    })),
    freshness: [
      {
        source_key: feed.source_key,
        source_name: feed.source_name,
        freshness: latestPublishedAt && isStale(latestPublishedAt) ? "stale" : "fresh",
        retrieved_at: retrievedAt,
        updated_at: latestPublishedAt,
        message:
          "Fetched latest RSS feed items at verification time. This is not full historical coverage.",
      },
    ],
    itemsFetched: items.length,
    sourceKeys: [feed.source_key],
    endpointKeys: [`rss:${feed.source_key}`],
  };
}

async function fetchTransportSpecialNews(): Promise<SourceSnapshot> {
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetch(TD_SPECIAL_NEWS_URL, {
      headers: { accept: "text/html" },
    });
    if (!response.ok) {
      return unavailableSnapshot(
        "td",
        "Transport Department",
        retrievedAt,
        "TD request failed.",
        "td",
      );
    }

    const html = await response.text();
    return tdSnapshotFromHtml(html, retrievedAt);
  } catch {
    return unavailableSnapshot(
      "td",
      "Transport Department",
      retrievedAt,
      "TD data unavailable.",
      "td",
    );
  }
}

export function tdSnapshotFromHtml(html: string, retrievedAt: string): SourceSnapshot {
  const updatedAt = parseOfficialDate(extractTdTimestamp(html));
  const items = extractTdNewsItems(html, retrievedAt, updatedAt);

  return {
    evidence: items,
    freshness: [
      {
        source_key: "td",
        source_name: "Transport Department",
        freshness: updatedAt && isStale(updatedAt) ? "stale" : "fresh",
        retrieved_at: retrievedAt,
        updated_at: updatedAt,
        message:
          "Fetched live Transport Department special traffic news page. This is current page data, not historical coverage.",
      },
    ],
    itemsFetched: items.length,
    sourceKeys: ["td"],
    endpointKeys: ["td:special_news"],
  };
}

function extractTdNewsItems(
  html: string,
  retrievedAt: string,
  updatedAt: string | null,
): PhaseOneEvidence[] {
  const text = stripHtml(html)
    .replace(/\s+/g, " ")
    .replace(/Special Traffic News/i, "\nSpecial Traffic News\n");
  const matches = [...text.matchAll(/\b\d+\.\s+(.+?)(?=\s+\d+\.|$)/g)];

  return matches.slice(0, 12).map((match, index) => ({
    id: `td-special-${index + 1}`,
    source_key: "td",
    source_name: "Transport Department",
    source_type: "live_page",
    title: `Special Traffic News ${index + 1}`,
    summary: match[1].trim(),
    url: TD_SPECIAL_NEWS_URL,
    published_at: null,
    updated_at: updatedAt,
    retrieved_at: retrievedAt,
    freshness: updatedAt && isStale(updatedAt) ? "stale" : "fresh",
  }));
}

function extractTdTimestamp(html: string): string | null {
  return (
    stripHtml(html).match(/\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?/i)?.[0] ??
    null
  );
}

export function parseRssItems(xml: string): RssItem[] {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => {
    const itemXml = match[0];
    const url = getXmlText(itemXml, "link");
    return {
      guid: getXmlText(itemXml, "guid") || url,
      title: getXmlText(itemXml, "title"),
      description: stripHtml(getXmlText(itemXml, "description")),
      published_at: parseOfficialDate(
        getXmlText(itemXml, "pubDate") || getXmlText(itemXml, "published"),
      ),
      url,
    };
  });
}

function dedupeRssItems(items: RssItem[]): RssItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.guid || item.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scoreEducationEvidence(evidence: PhaseOneEvidence, claimText: string): number {
  const haystack = normalizeText(`${evidence.title} ${evidence.summary}`);
  let score = 0;

  for (const term of EDUCATION_TERMS) {
    if (haystack.includes(term)) score += term === "edb" ? 2 : 4;
  }
  if (haystack.includes("tomorrow") && normalizeText(claimText).includes("tomorrow")) score += 2;
  if (haystack.includes("school") || haystack.includes("class")) score += 1;

  return score;
}

function scoreTrafficEvidence(evidence: PhaseOneEvidence, claimText: string): number {
  const haystack = normalizeText(`${evidence.title} ${evidence.summary}`);
  const claim = normalizeText(claimText);
  let score = 0;

  for (const term of TRAFFIC_TERMS) {
    if (haystack.includes(term)) score += 3;
  }
  for (const term of KOWLOON_TERMS) {
    if (haystack.includes(term) && (claim.includes(term) || claim.includes("kowloon"))) score += 3;
  }
  for (const roadTerm of extractRoadLocationTerms(claim)) {
    if (haystack.includes(roadTerm)) score += 3;
  }

  return score;
}

function unavailableSnapshot(
  sourceKey: OfficialSourceKey,
  sourceName: string,
  retrievedAt: string,
  message: string,
  endpointKey: string,
): SourceSnapshot {
  return {
    evidence: [],
    freshness: [
      {
        source_key: sourceKey,
        source_name: sourceName,
        freshness: "unavailable",
        retrieved_at: retrievedAt,
        updated_at: null,
        message,
      },
    ],
    itemsFetched: 0,
    sourceKeys: [sourceKey],
    endpointKeys: [endpointKey],
  };
}

function emptySnapshot(sourceKey: OfficialSourceKey, sourceName: string): SourceSnapshot {
  return {
    evidence: [],
    freshness: [],
    itemsFetched: 0,
    sourceKeys: [sourceKey],
    endpointKeys: [],
  };
}

function summarizeDataArray(value: unknown, label: string): string {
  if (!isRecord(value) || !Array.isArray(value.data)) return "";
  const sample = value.data
    .slice(0, 8)
    .map((item) => (isRecord(item) ? Object.values(item).filter(Boolean).join(" ") : String(item)))
    .join("; ");
  return sample ? `${label}: ${sample}.` : "";
}

function summarizeStringArray(value: unknown, label: string): string {
  if (!Array.isArray(value)) return "";
  const sample = value.filter((item): item is string => typeof item === "string").join(" ");
  return sample ? `${label}: ${sample}.` : "";
}

function getNestedNumber(value: unknown): number | null {
  if (isRecord(value) && typeof value.value === "number") return value.value;
  if (isRecord(value) && typeof value.value === "string" && value.value.trim()) {
    const parsed = Number(value.value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractRoadLocationTerms(text: string): string[] {
  const terms = text.match(/\b[a-z]+(?:\s+[a-z]+){0,2}\s+(?:road|street|highway|tunnel|bypass)\b/g);
  return terms ?? [];
}

function isRecent(value: string | null): boolean {
  if (!value) return true;
  return Date.now() - Date.parse(value) <= RECENT_ITEM_DAYS * 24 * 60 * 60 * 1000;
}

function isStale(value: string): boolean {
  return Date.now() - Date.parse(value) > RECENT_ITEM_DAYS * 24 * 60 * 60 * 1000;
}

function latestIso(values: Array<string | null>): string | null {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function parseOfficialDate(value: string | null): string | null {
  if (!value) return null;
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

export function formatHongKongTime(value: string | null): string {
  if (!value) return "Not stated by source";
  return new Intl.DateTimeFormat("en-HK", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: HK_TIME_ZONE,
  }).format(new Date(value));
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
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function hashStable(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}
