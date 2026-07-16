export type ClaimStatus = "supported" | "refuted" | "insufficient";

export type EvidenceType =
  | "Official structured data"
  | "Official Weather API"
  | "Government announcement"
  | "RSS notice"
  | "Supporting evidence";

export type SourceKey = "hko" | "td" | "edb" | "govnews" | "datagov" | "dsd";

export interface OfficialSource {
  key: SourceKey;
  name: string;
  shortName: string;
  type: string;
  description: string;
  url: string;
  updated: string;
}

export interface Evidence {
  id: string;
  sourceKey: SourceKey;
  evidenceType: EvidenceType;
  publishedAt: string;
  updatedAt: string;
  retrievedAt?: string;
  summary: string;
  citation: string;
  url: string;
}

export interface ClaimExplanation {
  officialEvidence: string;
  sourceConsistency: string;
  verdictExplanation: string;
  recommendation: string;
}

export interface Claim {
  id: string;
  text: string;
  status: ClaimStatus;
  confidence: number;
  evidenceIds: string[];
  explanation: ClaimExplanation;
}

export interface VerificationReport {
  id: string;
  input: string;
  claimsDetected: number;
  sourcesConsulted: number;
  evidenceCoverage: "High" | "Medium" | "Low";
  lastCheckedAt: string;
  claims: Claim[];
}

export interface HistoryReport {
  id: string;
  date: string;
  title: string;
  claims: number;
  supported: number;
  refuted: number;
  insufficient: number;
  confidence: number;
}

/* ---------------- Sources ---------------- */

export const officialSources: OfficialSource[] = [
  {
    key: "hko",
    name: "Hong Kong Observatory",
    shortName: "HKO",
    type: "Weather warnings feed",
    description:
      "Rainstorm and tropical cyclone warning signals, rainfall nowcasts and severe weather advisories.",
    url: "https://www.hko.gov.hk",
    updated: "Every 10 minutes",
  },
  {
    key: "govnews",
    name: "Government News",
    shortName: "GovNews",
    type: "Press release feed",
    description:
      "Official press releases and consolidated advisories from all HKSAR bureaux and departments.",
    url: "https://www.news.gov.hk",
    updated: "Continuous",
  },
  {
    key: "td",
    name: "Transport Department",
    shortName: "TD",
    type: "Traffic notices",
    description:
      "Road closures, incident notices and public transport service updates across Hong Kong.",
    url: "https://www.td.gov.hk",
    updated: "Every 5 minutes",
  },
  {
    key: "edb",
    name: "Education Bureau",
    shortName: "EDB",
    type: "Announcements & RSS",
    description:
      "Class arrangements, examination notices and school-related official announcements.",
    url: "https://www.edb.gov.hk",
    updated: "Every 15 minutes",
  },
  {
    key: "datagov",
    name: "data.gov.hk",
    shortName: "data.gov.hk",
    type: "Open datasets",
    description:
      "Structured open datasets across weather, transport, health, environment and more.",
    url: "https://data.gov.hk",
    updated: "Varies by dataset",
  },
  {
    key: "dsd",
    name: "Drainage Services Department",
    shortName: "DSD",
    type: "Flood alerts",
    description: "Flood-prone area monitoring, drainage system status and stormwater alerts.",
    url: "https://www.dsd.gov.hk",
    updated: "Every 15 minutes",
  },
];

export const sourceByKey: Record<SourceKey, OfficialSource> = Object.fromEntries(
  officialSources.map((s) => [s.key, s]),
) as Record<SourceKey, OfficialSource>;

/* ---------------- Demo input ---------------- */

export const uploadedContent =
  "The Hong Kong Observatory has issued a Black Rainstorm Warning. All schools will suspend classes tomorrow, and major roads in Kowloon are expected to close.";

/* ---------------- Evidence ---------------- */

export const evidence: Evidence[] = [
  {
    id: "e1",
    sourceKey: "hko",
    evidenceType: "Government announcement",
    publishedAt: "2026-07-14 05:40",
    updatedAt: "2026-07-14 06:12",
    summary:
      "The Black Rainstorm Warning Signal is currently in force across Hong Kong Island, Kowloon and the New Territories.",
    citation:
      "The Black Rainstorm Warning Signal is now in force. Members of the public should stay indoors unless it is absolutely necessary to go out.",
    url: "https://www.hko.gov.hk/en/wxinfo/currwx/rainstorm.htm",
  },
  {
    id: "e2",
    sourceKey: "datagov",
    evidenceType: "Official structured data",
    publishedAt: "2026-07-14 06:15",
    updatedAt: "2026-07-14 06:15",
    summary:
      "Automatic weather station dataset records 132 mm of rainfall in Kowloon City over the past 3 hours — consistent with a Black-tier rainstorm event.",
    citation: "Kowloon City AWS · rainfall_3h = 132.4 mm · signal_class = BLACK.",
    url: "https://data.gov.hk/en-data/dataset/hk-hko-rss-current-weather-report",
  },
  {
    id: "e3",
    sourceKey: "edb",
    evidenceType: "RSS notice",
    publishedAt: "2026-07-14 05:55",
    updatedAt: "2026-07-14 06:20",
    summary:
      "EDB has issued a suspension notice for classes still in session today, but has NOT announced any advance suspension for tomorrow.",
    citation:
      "Classes for all day schools have been suspended for today. Arrangements for tomorrow will be announced separately based on prevailing weather signals.",
    url: "https://www.edb.gov.hk/en/news/rss.html",
  },
  {
    id: "e4",
    sourceKey: "td",
    evidenceType: "Government announcement",
    publishedAt: "2026-07-14 06:05",
    updatedAt: "2026-07-14 06:22",
    summary:
      "Localised flooding reported on Waterloo Road and Boundary Street. No full closure of any major Kowloon trunk road has been declared at this time.",
    citation:
      "Motorists should avoid low-lying sections in Kowloon. Traffic on Nathan Road and the Cross-Harbour Tunnel approach remains open with diversions.",
    url: "https://www.td.gov.hk/en/special_news/spnews.htm",
  },
  {
    id: "e5",
    sourceKey: "govnews",
    evidenceType: "Supporting evidence",
    publishedAt: "2026-07-14 06:08",
    updatedAt: "2026-07-14 06:08",
    summary:
      "Inter-departmental emergency response activated. DSD and TD teams deployed to Kowloon flooding hotspots; residents advised to monitor official channels.",
    citation:
      "The Government is closely monitoring the rainstorm situation and coordinating the emergency response across departments.",
    url: "https://www.news.gov.hk/eng/2026/07/20260714/20260714_060830_123.html",
  },
];

/* ---------------- Claims ---------------- */

export const claims: Claim[] = [
  {
    id: "c1",
    text: "The Hong Kong Observatory has issued a Black Rainstorm Warning.",
    status: "supported",
    confidence: 94,
    evidenceIds: ["e1", "e2"],
    explanation: {
      officialEvidence:
        "HKO's warning feed confirms the Black Rainstorm Warning Signal is currently in force. Structured rainfall data on data.gov.hk records 132 mm in 3 hours at the Kowloon City station.",
      sourceConsistency:
        "Two independent official sources (HKO warning feed and data.gov.hk open dataset) agree on both the signal class and the underlying rainfall magnitude.",
      verdictExplanation:
        "Both the authoritative warning notice and the raw sensor data support the claim, with no contradicting source found.",
      recommendation:
        "Treat this claim as reliable. Continue to monitor HKO for downgrades or upgrades of the warning signal.",
    },
  },
  {
    id: "c2",
    text: "All schools will suspend classes tomorrow.",
    status: "refuted",
    confidence: 12,
    evidenceIds: ["e3", "e5"],
    explanation: {
      officialEvidence:
        "The Education Bureau's RSS notice suspends classes for today only, and explicitly states arrangements for tomorrow will be announced separately based on prevailing weather signals.",
      sourceConsistency:
        "No official source — EDB, Government News, or otherwise — announces a blanket suspension for tomorrow. The claim is not supported anywhere in the retrieved evidence.",
      verdictExplanation:
        "The claim generalises today's suspension into a definitive statement about tomorrow, which the current EDB notice directly contradicts.",
      recommendation:
        "Do not act on this claim. Check the EDB announcement channel again the evening before, or the morning of, before making arrangements.",
    },
  },
  {
    id: "c3",
    text: "Major roads in Kowloon are expected to close.",
    status: "insufficient",
    confidence: 72,
    evidenceIds: ["e4", "e5"],
    explanation: {
      officialEvidence:
        "Transport Department notices confirm localised flooding on Waterloo Road and Boundary Street, but do not declare a closure of any major Kowloon trunk road. Government News confirms an active inter-departmental response but does not name specific closures.",
      sourceConsistency:
        "Evidence agrees that disruption is occurring, but disagrees on scale — the claim of 'major roads closing' is stronger than any single notice supports.",
      verdictExplanation:
        "The situation is evolving. There is enough evidence for real disruption, but not enough to confirm the specific claim as stated.",
      recommendation:
        "Treat as developing. Refresh the Transport Department special-news feed before travelling, and allow additional time for diversions.",
    },
  },
];

/* ---------------- Report metadata ---------------- */

export const currentReport: VerificationReport = {
  id: "r-current",
  input: uploadedContent,
  claimsDetected: claims.length,
  sourcesConsulted: 5,
  evidenceCoverage: "High",
  lastCheckedAt: "2026-07-14 06:24 HKT",
  claims,
};

export const confidenceTooltip =
  "Confidence reflects evidence coverage, source agreement, and source authority.";

/* ---------------- Charts ---------------- */

export const distributionData = [
  { name: "Supported", value: 1, color: "var(--success)" },
  { name: "Refuted", value: 1, color: "var(--destructive)" },
  { name: "Need Evidence", value: 1, color: "var(--warning)" },
];

export const sourceUsageData = [
  { source: "HKO", count: 12 },
  { source: "GovNews", count: 8 },
  { source: "TD", count: 9 },
  { source: "EDB", count: 6 },
  { source: "data.gov", count: 11 },
  { source: "DSD", count: 4 },
];

/* ---------------- History ---------------- */

export const historyReports: HistoryReport[] = [
  {
    id: "r1",
    date: "2026-07-14 06:24",
    title: "HK Black Rainstorm & school suspension rumor",
    claims: 3,
    supported: 1,
    refuted: 1,
    insufficient: 1,
    confidence: 59,
  },
  {
    id: "r2",
    date: "2026-07-12 14:02",
    title: "MTR East Rail Line service claim",
    claims: 4,
    supported: 3,
    refuted: 0,
    insufficient: 1,
    confidence: 88,
  },
  {
    id: "r3",
    date: "2026-07-10 09:11",
    title: "Air quality advisory verification",
    claims: 2,
    supported: 2,
    refuted: 0,
    insufficient: 0,
    confidence: 96,
  },
  {
    id: "r4",
    date: "2026-07-07 18:45",
    title: "New public housing policy rumor",
    claims: 5,
    supported: 2,
    refuted: 2,
    insufficient: 1,
    confidence: 47,
  },
  {
    id: "r5",
    date: "2026-07-03 11:20",
    title: "Cross-harbour tunnel toll change",
    claims: 3,
    supported: 3,
    refuted: 0,
    insufficient: 0,
    confidence: 95,
  },
];

/* ---------------- Processing steps (data-driven) ---------------- */

export type ProcessingStepKey =
  "extract" | "understand" | "claims" | "search" | "verify" | "report";

export interface ProcessingStep {
  key: ProcessingStepKey;
  label: string;
  detail: string;
}

export const processingSteps: ProcessingStep[] = [
  {
    key: "extract",
    label: "Extracting information",
    detail: "Parsing text and normalising language.",
  },
  {
    key: "understand",
    label: "Understanding content",
    detail: "Identifying topics, entities and context.",
  },
  {
    key: "claims",
    label: "Extracting factual claims",
    detail: "Splitting content into verifiable statements.",
  },
  {
    key: "search",
    label: "Searching official evidence",
    detail: "Querying HKO, EDB, TD, GovNews and data.gov.hk.",
  },
  {
    key: "verify",
    label: "Cross-checking sources",
    detail: "Comparing claims against retrieved evidence.",
  },
  {
    key: "report",
    label: "Generating explanation",
    detail: "Assembling the evidence-based report.",
  },
];
