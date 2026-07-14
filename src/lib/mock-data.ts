export type ClaimStatus = "supported" | "refuted" | "insufficient";

export interface Claim {
  id: string;
  text: string;
  status: ClaimStatus;
  confidence: number;
  evidenceIds: string[];
  reasoning: string[];
}

export interface Evidence {
  id: string;
  source: string;
  sourceType: string;
  publishedAt: string;
  updatedAt: string;
  summary: string;
  citation: string;
  url: string;
  logo: string;
}

export const uploadedContent = `Heavy rain warning issued by the Hong Kong Observatory for Hong Kong Island and Kowloon districts. According to a circulating message, all schools will suspend classes tomorrow, and significant traffic disruption is expected across Kowloon due to flooded roads and MTR delays.`;

export const evidence: Evidence[] = [
  {
    id: "e1",
    source: "Hong Kong Observatory",
    sourceType: "Weather API",
    publishedAt: "2025-07-13 21:40",
    updatedAt: "2025-07-14 06:12",
    summary:
      "Amber rainstorm warning signal in force. Heavy rain expected to persist across Hong Kong Island and Kowloon for the next 6 hours.",
    citation:
      "The Amber Rainstorm Warning Signal is now in force. Members of the public should stay alert and take necessary precautions.",
    url: "https://www.hko.gov.hk",
    logo: "HKO",
  },
  {
    id: "e2",
    source: "Education Bureau",
    sourceType: "Announcements",
    publishedAt: "2025-07-14 05:55",
    updatedAt: "2025-07-14 06:00",
    summary:
      "As of 06:00, EDB has NOT announced any class suspension for tomorrow. Schools will operate on regular schedule unless a Black Rainstorm or T8 signal is raised.",
    citation:
      "Classes for all day-schools remain as scheduled. Parents should refer to official EDB channels for updates.",
    url: "https://www.edb.gov.hk",
    logo: "EDB",
  },
  {
    id: "e3",
    source: "Transport Department",
    sourceType: "Traffic Notices",
    publishedAt: "2025-07-14 05:30",
    updatedAt: "2025-07-14 06:20",
    summary:
      "Multiple road flooding incidents reported in Kowloon: Waterloo Road, Boundary Street and parts of Nathan Road. Traffic diversions in effect.",
    citation:
      "Motorists are advised to avoid low-lying areas in Kowloon and allow additional travel time.",
    url: "https://www.td.gov.hk",
    logo: "TD",
  },
  {
    id: "e4",
    source: "Government News",
    sourceType: "Press Release",
    publishedAt: "2025-07-14 06:05",
    updatedAt: "2025-07-14 06:05",
    summary:
      "Inter-departmental coordination activated. Drainage Services Department teams deployed to Kowloon flooding hotspots.",
    citation:
      "The Government is closely monitoring the rainstorm situation and coordinating emergency response.",
    url: "https://www.news.gov.hk",
    logo: "GN",
  },
  {
    id: "e5",
    source: "data.gov.hk",
    sourceType: "Open Dataset",
    publishedAt: "2025-07-14 06:15",
    updatedAt: "2025-07-14 06:15",
    summary:
      "Rainfall dataset shows 71mm precipitation recorded in Kowloon City district over the past 3 hours.",
    citation: "Kowloon City automatic weather station: 71.2mm / 3h.",
    url: "https://data.gov.hk",
    logo: "DGH",
  },
];

export const claims: Claim[] = [
  {
    id: "c1",
    text: "Heavy rain warning has been issued for Hong Kong.",
    status: "supported",
    confidence: 98,
    evidenceIds: ["e1", "e5"],
    reasoning: [
      "Claim extracted from uploaded content mentioning 'heavy rain warning'.",
      "Cross-referenced with HKO real-time warning feed — Amber Rainstorm Signal is currently active.",
      "Supporting rainfall data from data.gov.hk confirms 71mm in past 3 hours.",
      "Conclusion: claim is factually supported by two independent official sources.",
    ],
  },
  {
    id: "c2",
    text: "All schools will suspend classes tomorrow.",
    status: "refuted",
    confidence: 6,
    evidenceIds: ["e2"],
    reasoning: [
      "Claim extracted from uploaded content asserting universal class suspension.",
      "Queried Education Bureau announcement feed — no suspension notice issued as of 06:00.",
      "EDB policy requires Black Rainstorm or T8 signal for automatic suspension; neither is in force.",
      "Conclusion: claim contradicts the current official EDB announcement.",
    ],
  },
  {
    id: "c3",
    text: "Traffic disruption is expected in Kowloon.",
    status: "supported",
    confidence: 88,
    evidenceIds: ["e3", "e4"],
    reasoning: [
      "Claim extracted from uploaded content mentioning Kowloon traffic disruption.",
      "Transport Department notices confirm multiple flooding incidents on Waterloo Road, Boundary Street, Nathan Road.",
      "Government News confirms inter-departmental emergency response is active.",
      "Conclusion: claim is supported, with moderate confidence due to evolving situation.",
    ],
  },
  {
    id: "c4",
    text: "MTR services will be fully suspended across Kowloon tomorrow.",
    status: "refuted",
    confidence: 9,
    evidenceIds: ["e3", "e4"],
    reasoning: [
      "Claim extracted from uploaded content asserting a full MTR shutdown in Kowloon.",
      "Transport Department notices report localized flooding only — no operator-wide MTR suspension announced.",
      "Government News press release confirms emergency response is active but transit continues to operate.",
      "Conclusion: claim contradicts current Transport Department and Government News advisories.",
    ],
  },
];

export const suggestions = [
  "Continue monitoring Hong Kong Observatory rainstorm warning updates.",
  "Check Education Bureau announcements before making travel decisions for children.",
  "Follow Transport Department traffic notices for real-time road conditions.",
  "Refer to news.gov.hk for consolidated government advisories.",
];

export const officialSources = [
  {
    name: "Hong Kong Observatory",
    type: "Weather API",
    logo: "HKO",
    description: "Real-time weather warnings, rainfall data, and tropical cyclone tracking.",
    url: "https://www.hko.gov.hk",
    updated: "Every 10 minutes",
  },
  {
    name: "Government News",
    type: "RSS Feed",
    logo: "GN",
    description: "Official press releases and consolidated advisories from all HKSAR departments.",
    url: "https://www.news.gov.hk",
    updated: "Continuous",
  },
  {
    name: "Transport Department",
    type: "Traffic Notices",
    logo: "TD",
    description: "Real-time road closures, traffic incidents, and public transport service updates.",
    url: "https://www.td.gov.hk",
    updated: "Every 5 minutes",
  },
  {
    name: "Education Bureau",
    type: "Announcements",
    logo: "EDB",
    description: "Class arrangements, examination notices, and school-related official announcements.",
    url: "https://www.edb.gov.hk",
    updated: "Every 15 minutes",
  },
  {
    name: "data.gov.hk",
    type: "Open Dataset",
    logo: "DGH",
    description: "Structured open data across weather, transport, health, environment, and more.",
    url: "https://data.gov.hk",
    updated: "Varies by dataset",
  },
  {
    name: "Drainage Services",
    type: "Flood Alerts",
    logo: "DSD",
    description: "Flood-prone area monitoring, drainage system status and stormwater alerts.",
    url: "https://www.dsd.gov.hk",
    updated: "Every 15 minutes",
  },
];

export const historyReports = [
  {
    id: "r1",
    date: "2025-07-14 06:24",
    title: "HK rainstorm & school suspension rumor",
    claims: 3,
    supported: 2,
    refuted: 1,
    confidence: 64,
  },
  {
    id: "r2",
    date: "2025-07-12 14:02",
    title: "MTR East Rail Line service claim",
    claims: 4,
    supported: 3,
    refuted: 0,
    confidence: 92,
  },
  {
    id: "r3",
    date: "2025-07-10 09:11",
    title: "Air quality advisory verification",
    claims: 2,
    supported: 2,
    refuted: 0,
    confidence: 96,
  },
  {
    id: "r4",
    date: "2025-07-07 18:45",
    title: "New public housing policy rumor",
    claims: 5,
    supported: 2,
    refuted: 2,
    confidence: 47,
  },
  {
    id: "r5",
    date: "2025-07-03 11:20",
    title: "Cross-harbour tunnel toll change",
    claims: 3,
    supported: 3,
    refuted: 0,
    confidence: 95,
  },
];

export const distributionData = [
  { name: "Supported", value: 2, color: "var(--success)" },
  { name: "Refuted", value: 1, color: "var(--destructive)" },
  { name: "Insufficient", value: 0, color: "var(--warning)" },
];

export const sourceUsageData = [
  { source: "HKO", count: 12 },
  { source: "EDB", count: 6 },
  { source: "TD", count: 9 },
  { source: "GovNews", count: 8 },
  { source: "data.gov", count: 11 },
  { source: "DSD", count: 4 },
];

export const processTimelineData = [
  { step: "Extract", ms: 420 },
  { step: "Understand", ms: 980 },
  { step: "Claims", ms: 1240 },
  { step: "Search", ms: 3100 },
  { step: "Verify", ms: 2450 },
  { step: "Report", ms: 760 },
];
