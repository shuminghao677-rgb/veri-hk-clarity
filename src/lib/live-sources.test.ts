import {
  classifyClaim,
  evaluateClaimsWithSources,
  fndSnapshotFromPayload,
  flwSnapshotFromPayload,
  hkoSnapshotFromPayload,
  retrieveLiveEvidence,
  rssSnapshotFromItems,
  swtSnapshotFromPayload,
  tdSnapshotFromHtml,
  warningInfoSnapshotFromPayload,
  type RssFeedConfig,
  type SourceBundle,
  type SourceSnapshot,
} from "./live-sources";
import { tdSnapshotFromXml as tdTrafficSnapshotFromXml } from "./traffic-sources";
import {
  getEvidenceItemText,
  getHeaderReportLabels,
  getOfficialUpdateLabel,
  getRetrievedByVeriHkLabel,
} from "./report-display";
import type { OfficialSourceKey, PhaseOneClaim } from "./report-contract";

const RETRIEVED_AT = "2026-07-16T02:00:00.000Z";

export async function runLiveSourceConnectorTests(): Promise<void> {
  testHkoBlackRainstormActive();
  testHkoBlackRainstormInactive();
  testHkoUnavailable();
  testTc8SignalActive();
  testTc3ActiveRefutesSignalEight();
  testVagueFutureWeatherUsesForecastOnly();
  testSpecificFutureTemperatureClaim();
  testWeatherOnlyRequestDoesNotQueryRssOrTransport();
  testTimezoneDisplayDoesNotDoubleConvert();
  testReportTitleAppearsOnce();
  testOfficialUpdateAndRetrievedTimeAreSeparate();
  testSingularPluralEvidenceWording();
  await testDeterministicRefutationQueriesOnlyWarnsum();
  testUnrelatedGovernmentNewsIsNotAttached();
  testSchoolSuspensionNoticeOnlyMatchesEducationClaim();
  testKowloonRoadClosureNoticeOnlyMatchesTrafficClaim();
  testPublicTransportClaimsClassifyToTransport();
  testPublicTransportSplitClaimsUseSameTdEvidence();
  testPublicTransportResolvedUpdateRefutesActiveClaimAndLeavesCauseInsufficient();
  await testPublicTransportOnlyRequestQueriesTdOnly();
}

async function testDeterministicRefutationQueriesOnlyWarnsum(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    return new Response(
      JSON.stringify({
        WRAIN: {
          code: "WRAINA",
          name: "Rainstorm Warning Signal",
          updateTime: "2026/07/16 09:00:00",
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const result = await retrieveLiveEvidence([claim("Black Rainstorm Warning is active.")]);
    assertEqual(result.claims[0]?.verdict, "refuted", "mocked warnsum refutes Black Rainstorm");
    assertEqual(result.counts.official_sources_queried, 1, "refutation queries only warnsum");
    assertEqual(
      requestedUrls.some((url) => url.includes("dataType=warningInfo")),
      false,
      "refutation does not query warningInfo",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testReportTitleAppearsOnce(): void {
  const labels = getHeaderReportLabels({
    report_id: "report-1",
    analysis_type: "preliminary_ai_analysis",
    input_content: "Black Rainstorm Warning is active.",
    checked_at: RETRIEVED_AT,
    overall_confidence: 0.9,
    evidence_coverage: "high",
    retrieval_counts: {
      official_sources_queried: 1,
      feed_items_fetched: 1,
      relevant_evidence_attached: 1,
    },
    claims: [
      {
        ...claim("Black Rainstorm Warning is active."),
        verdict: "refuted",
        evidence: [
          {
            id: "hko-negative",
            source_key: "hko",
            source_name: "Hong Kong Observatory",
            source_authority: "official",
            source_type: "hko_warning",
            category: "weather_warning",
            title: "Current Weather Warning Summary",
            summary: "No Black Rainstorm Warning is currently active.",
            url: "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en",
            published_at: null,
            updated_at: "2026-07-16T01:00:00.000Z",
            retrieved_at: RETRIEVED_AT,
            freshness: "fresh",
          },
        ],
      },
    ],
  });

  assertEqual(labels.length, 1, "report title is rendered once");
  assertEqual(labels[0], "Live Official Verification Report", "dynamic report title is preserved");
}

function testOfficialUpdateAndRetrievedTimeAreSeparate(): void {
  const evidence = {
    id: "hko-fnd",
    source_key: "hko",
    source_name: "Hong Kong Observatory",
    source_type: "official_api",
    title: "HKO Nine-day Forecast",
    summary: "Forecast record.",
    url: "https://example.test",
    published_at: null,
    updated_at: null,
    retrieved_at: RETRIEVED_AT,
    freshness: "fresh",
  } as const;

  assertEqual(
    getOfficialUpdateLabel(evidence, (value) => value),
    "Official update: Not stated",
    "missing official update is not replaced by retrieved time",
  );
  assertEqual(
    getRetrievedByVeriHkLabel(evidence, (value) => value),
    `Retrieved by VeriHK: ${RETRIEVED_AT}`,
    "retrieved time has its own label",
  );
}

function testSingularPluralEvidenceWording(): void {
  assertEqual(
    getEvidenceItemText(1),
    "Retrieved 1 relevant official evidence item.",
    "singular evidence wording",
  );
  assertEqual(
    getEvidenceItemText(2),
    "Retrieved 2 relevant official evidence items.",
    "plural evidence wording",
  );
}

function testHkoBlackRainstormActive(): void {
  const result = evaluateClaimsWithSources([claim("Black Rainstorm Warning is active.")], {
    ...emptyBundle(),
    hko: {
      warnsum: hkoSnapshotFromPayload(
        {
          WRAIN: {
            code: "WRAINB",
            name: "Rainstorm Warning Signal",
            updateTime: "2026/07/16 09:00:00",
          },
        },
        RETRIEVED_AT,
      ),
      warningInfo: warningInfoSnapshotFromPayload(
        {
          details: [
            {
              warningStatementCode: "WRAIN",
              subtype: "WRAINB",
              contents: ["The Black Rainstorm Warning Signal is now in force."],
              updateTime: "2026/07/16 09:00:00",
            },
          ],
        },
        RETRIEVED_AT,
      ),
    },
  });

  assertEqual(result.claims[0]?.verdict, "supported", "active Black Rainstorm is supported");
  assertEqual(result.claims[0]?.evidence[0]?.source_key, "hko", "weather claim uses HKO");
  assertEqual(result.coverage, "high", "active Black Rainstorm has high coverage");
}

function testHkoBlackRainstormInactive(): void {
  const result = evaluateClaimsWithSources([claim("Black Rainstorm Warning is active.")], {
    ...emptyBundle(),
    hko: {
      warnsum: hkoSnapshotFromPayload(
        {
          WRAIN: {
            code: "WRAINA",
            name: "Rainstorm Warning Signal",
            updateTime: "2026/07/16 09:00:00",
          },
        },
        RETRIEVED_AT,
      ),
    },
  });

  assertEqual(result.claims[0]?.verdict, "refuted", "inactive Black Rainstorm is refuted");
  assertEqual(
    result.claims[0]?.evidence.every((item) => item.source_key === "hko"),
    true,
    "only HKO evidence is attached",
  );
  assertEqual(
    result.claims[0]?.evidence.length,
    1,
    "deterministic refutation attaches negative HKO evidence",
  );
  assertEqual(result.coverage, "high", "inactive Black Rainstorm refutation has high coverage");
}

function testHkoUnavailable(): void {
  const result = evaluateClaimsWithSources([claim("Black Rainstorm Warning is active.")], {
    ...emptyBundle(),
    hko: { warnsum: unavailableSource("hko", "Hong Kong Observatory", "hko:warnsum") },
  });

  assertEqual(
    result.claims[0]?.verdict,
    "insufficient_evidence",
    "unavailable HKO is insufficient",
  );
  assertEqual(result.claims[0]?.evidence.length, 0, "unavailable HKO attaches no evidence");
  assertEqual(result.coverage, "none", "unavailable HKO has no coverage");
}

function testTc8SignalActive(): void {
  const result = evaluateClaimsWithSources([claim("Typhoon Signal No. 8 is currently in force.")], {
    ...emptyBundle(),
    hko: {
      warnsum: hkoSnapshotFromPayload(
        {
          WTCSGNL: {
            code: "TC8SE",
            name: "Tropical Cyclone Warning Signal",
            type: "No. 8 Southeast Gale or Storm Signal",
            updateTime: "2026/07/16 09:00:00",
          },
        },
        RETRIEVED_AT,
      ),
    },
  });

  assertEqual(result.claims[0]?.verdict, "supported", "TC8SE supports Signal No. 8");
}

function testTc3ActiveRefutesSignalEight(): void {
  const result = evaluateClaimsWithSources([claim("Typhoon Signal No. 8 is currently in force.")], {
    ...emptyBundle(),
    hko: {
      warnsum: hkoSnapshotFromPayload(
        {
          WTCSGNL: {
            code: "TC3",
            name: "Tropical Cyclone Warning Signal",
            type: "Strong Wind Signal No. 3",
            updateTime: "2026/07/16 09:00:00",
          },
        },
        RETRIEVED_AT,
      ),
    },
  });

  assertEqual(result.claims[0]?.verdict, "refuted", "TC3 refutes Signal No. 8");
  assertEqual(result.claims[0]?.evidence.length, 1, "TC3 refutation attaches evidence");
}

function testVagueFutureWeatherUsesForecastOnly(): void {
  const result = evaluateClaimsWithSources(
    [claim("Severe weather may affect Hong Kong tomorrow.")],
    {
      hko: {
        flw: flwSnapshotFromPayload(
          {
            generalSituation: "Mainly fine.",
            forecastPeriod: "Tomorrow",
            forecastDesc: "Sunny periods.",
            outlook: "Fine in the following few days.",
            updateTime: "2026-07-16T09:00:00+08:00",
          },
          RETRIEVED_AT,
        ),
        fnd: fndSnapshotFromPayload(
          {
            weatherForecast: [
              {
                forecastDate: "20260717",
                forecastWeather: "Sunny periods.",
                forecastMaxtemp: { value: 32, unit: "C" },
                forecastMintemp: { value: 27, unit: "C" },
              },
            ],
          },
          RETRIEVED_AT,
        ),
        swt: swtSnapshotFromPayload({ swt: [] }, RETRIEVED_AT),
      },
    },
  );

  assertEqual(
    result.counts.official_sources_queried,
    3,
    "vague future weather checks flw/fnd/swt only",
  );
  assertEqual(
    result.claims[0]?.verdict,
    "insufficient_evidence",
    "vague future weather remains insufficient without direct match",
  );
  assertEqual(result.coverage, "low", "vague future weather has low coverage");
}

function testSpecificFutureTemperatureClaim(): void {
  const result = evaluateClaimsWithSources([claim("Hong Kong will reach 35 degrees tomorrow.")], {
    hko: {
      flw: flwSnapshotFromPayload(
        {
          forecastDesc: "Very hot.",
          updateTime: "2026-07-16T09:00:00+08:00",
        },
        RETRIEVED_AT,
      ),
      fnd: fndSnapshotFromPayload(
        {
          weatherForecast: [
            {
              forecastDate: "20260717",
              forecastWeather: "Very hot with sunny periods.",
              forecastMaxtemp: { value: 35, unit: "C" },
              forecastMintemp: { value: 29, unit: "C" },
            },
          ],
        },
        RETRIEVED_AT,
      ),
      swt: swtSnapshotFromPayload({ swt: [] }, RETRIEVED_AT),
    },
  });

  assertEqual(
    result.claims[0]?.verdict,
    "supported",
    "specific future temperature can be supported",
  );
  assertEqual(
    result.claims[0]?.evidence[0]?.id.startsWith("hko-fnd"),
    true,
    "temperature uses fnd",
  );
}

function testWeatherOnlyRequestDoesNotQueryRssOrTransport(): void {
  const result = evaluateClaimsWithSources([claim("Black Rainstorm Warning is active.")], {
    hko: {
      warnsum: hkoSnapshotFromPayload(
        {
          WRAIN: {
            code: "WRAINB",
            name: "Rainstorm Warning Signal",
            updateTime: "2026/07/16 09:00:00",
          },
        },
        RETRIEVED_AT,
      ),
    },
  });

  assertEqual(result.counts.official_sources_queried, 1, "weather-only request queries HKO only");
}

function testTimezoneDisplayDoesNotDoubleConvert(): void {
  const snapshot = hkoSnapshotFromPayload(
    {
      WRAIN: {
        code: "WRAINB",
        name: "Rainstorm Warning Signal",
        updateTime: "2026-07-16T09:00:00+08:00",
      },
    },
    RETRIEVED_AT,
  );

  assertEqual(
    snapshot.evidence[0]?.updated_at,
    "2026-07-16T01:00:00.000Z",
    "HKO +08 timestamp is normalized once to UTC storage",
  );
}

function testUnrelatedGovernmentNewsIsNotAttached(): void {
  const result = evaluateClaimsWithSources([claim("All schools will suspend classes tomorrow.")], {
    ...emptyBundle(),
    rss: rssSnapshotFromItems(
      govNewsFeed(),
      [
        rssItem(
          "legco",
          "Legislative Council meeting schedule",
          "Members will discuss finance speeches, cultural events and food inspections.",
        ),
      ],
      RETRIEVED_AT,
    ),
  });

  assertEqual(result.claims[0]?.evidence.length, 0, "unrelated GovNews is not attached");
}

function testSchoolSuspensionNoticeOnlyMatchesEducationClaim(): void {
  const result = evaluateClaimsWithSources(
    [
      claim("All schools will suspend classes tomorrow.", "education"),
      claim("Major roads in Kowloon are expected to close.", "traffic"),
    ],
    {
      ...emptyBundle(),
      rss: rssSnapshotFromItems(
        edbFeed(),
        [
          rssItem(
            "school-suspension",
            "Education Bureau announces class suspension",
            "The EDB says school suspension arrangements apply tomorrow.",
          ),
        ],
        RETRIEVED_AT,
      ),
    },
  );

  assertEqual(
    result.claims[0]?.evidence.length,
    1,
    "school suspension notice attaches to education claim",
  );
  assertEqual(result.claims[0]?.evidence[0]?.source_key, "edb", "education evidence uses EDB");
  assertEqual(
    result.claims[1]?.evidence.length,
    0,
    "school notice does not attach to traffic claim",
  );
}

function testKowloonRoadClosureNoticeOnlyMatchesTrafficClaim(): void {
  const result = evaluateClaimsWithSources(
    [
      claim("All schools will suspend classes tomorrow.", "education"),
      claim("Major roads in Kowloon are expected to close.", "traffic"),
    ],
    {
      ...emptyBundle(),
      td: tdSnapshotFromHtml(
        `
        <html><body>
          <p>2026/07/16 09:30:00</p>
          <p>1. Due to road closure, traffic diversion is implemented on Nathan Road in Kowloon.</p>
        </body></html>
        `,
        RETRIEVED_AT,
      ),
    },
  );

  assertEqual(
    result.claims[0]?.evidence.length,
    0,
    "traffic notice does not attach to education claim",
  );
  assertEqual(
    result.claims[1]?.evidence.length,
    0,
    "generic Kowloon road closure claim does not attach one specific road notice",
  );
}

function testPublicTransportClaimsClassifyToTransport(): void {
  assertEqual(
    classifyClaim("The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station."),
    "public_transport_disruption",
    "MTR disruption claim is classified as public transport",
  );
  assertEqual(
    classifyClaim("The Tseung Kwan O Line is operating normally near Yau Tong Station."),
    "public_transport_service_normal",
    "normal-service claim is classified as public transport",
  );
  assertEqual(
    classifyClaim("The service disruption on the Tseung Kwan O Line is caused by a train technical fault."),
    "public_transport_cause_claim",
    "technical fault cause claim is classified as public transport",
  );
  assertEqual(
    classifyClaim("The service disruption is caused by a train technical fault."),
    "public_transport_cause_claim",
    "train technical fault is not classified as weather",
  );
}

function testPublicTransportSplitClaimsUseSameTdEvidence(): void {
  const result = evaluateClaimsWithSources(
    [
      claim("The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station.", "pt-1"),
      claim(
        "The service disruption on the Tseung Kwan O Line is caused by a train technical fault.",
        "pt-2",
      ),
    ],
    {
      ...emptyBundle(),
      td: mtrDisruptionTrafficSnapshot(),
    },
  );

  assertEqual(result.claims[0]?.verdict, "supported", "disruption claim is supported");
  assertEqual(result.claims[1]?.verdict, "supported", "cause claim is supported");
  assertEqual(result.claims[0]?.evidence.length, 1, "disruption claim attaches one TD record");
  assertEqual(result.claims[1]?.evidence.length, 1, "cause claim attaches the same TD record");
  assertEqual(
    result.claims[0]?.evidence[0]?.id,
    result.claims[1]?.evidence[0]?.id,
    "both split claims reuse the same TD evidence item",
  );
  assertEqual(result.coverage, "high", "public transport deterministic result has high coverage");
  assertEqual(
    result.counts.unique_relevant_evidence_records,
    1,
    "one unique TD evidence record is counted",
  );
  assertEqual(result.counts.claim_evidence_links, 2, "one TD record is used across two claims");
  assertEqual(
    result.claims[0]?.explanation.includes("No matching live official source category"),
    false,
    "no developer-facing unsupported-category wording appears",
  );
}

function testPublicTransportResolvedUpdateRefutesActiveClaimAndLeavesCauseInsufficient(): void {
  const result = evaluateClaimsWithSources(
    [
      claim("The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station.", "pt-1"),
      claim(
        "The service disruption on the Tseung Kwan O Line is caused by a train technical fault.",
        "pt-2",
      ),
    ],
    {
      ...emptyBundle(),
      td: mtrIncidentNowOverTrafficSnapshot(),
    },
  );

  assertEqual(result.claims[0]?.verdict, "refuted", "resolved update refutes active disruption");
  assertEqual(
    result.claims[1]?.verdict,
    "insufficient_evidence",
    "missing current cause leaves cause claim insufficient",
  );
  assertEqual(result.claims[0]?.evidence.length, 1, "resolved evidence attaches to claim 1");
  assertEqual(result.claims[1]?.evidence.length, 1, "same resolved evidence attaches to claim 2");
  assertEqual(result.counts.unique_relevant_evidence_records, 1, "unique evidence count is one");
  assertEqual(result.counts.claim_evidence_links, 2, "same evidence is linked to two claims");
}

async function testPublicTransportOnlyRequestQueriesTdOnly(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes("trafficnews.xml")) {
      return new Response(mtrDisruptionXml(), {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await retrieveLiveEvidence([
      claim("The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station.", "pt-1"),
      claim(
        "The service disruption on the Tseung Kwan O Line is caused by a train technical fault.",
        "pt-2",
      ),
    ]);

    assertEqual(result.claims[0]?.verdict, "supported", "live request supports disruption claim");
    assertEqual(result.claims[1]?.verdict, "supported", "live request supports cause claim");
    assertEqual(result.counts.official_sources_queried, 1, "public transport request queries one TD endpoint");
    assertEqual(result.counts.feed_items_fetched, 1, "one official TD record is retrieved");
    assertEqual(result.counts.relevant_evidence_attached, 1, "unique relevant evidence count is one");
    assertEqual(result.counts.claim_evidence_links, 2, "same evidence is linked to two claims");
    assertEqual(
      requestedUrls.some((url) => url.includes("weatherAPI/opendata/weather.php")),
      false,
      "public-transport-only request does not query HKO",
    );
    assertEqual(
      requestedUrls.some((url) => url.includes("trafficnews.xml")),
      true,
      "public-transport-only request queries TD XML",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function mtrDisruptionTrafficSnapshot() {
  return tdTrafficSnapshotFromXml(mtrDisruptionXml(), RETRIEVED_AT);
}

function mtrIncidentNowOverTrafficSnapshot() {
  return tdTrafficSnapshotFromXml(mtrIncidentNowOverXml(), RETRIEVED_AT);
}

function mtrDisruptionXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<list>
  <message>
    <INCIDENT_NUMBER>IN-26-06001</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Public Transport Service Disruption</INCIDENT_HEADING_EN>
    <INCIDENT_DETAIL_EN>Train Technical Fault</INCIDENT_DETAIL_EN>
    <LOCATION_EN>Tseung Kwan O Line Service Disruption</LOCATION_EN>
    <DISTRICT_EN/>
    <DIRECTION_EN/>
    <ANNOUNCEMENT_DATE>2099-07-16T19:21:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
    <NEAR_LANDMARK_EN>Yau Tong Station</NEAR_LANDMARK_EN>
    <BETWEEN_LANDMARK_EN/>
    <CONTENT_EN>Tseung Kwan O Line service disruption near Yau Tong Station due to train technical fault.</CONTENT_EN>
    <LATITUDE/>
    <LONGITUDE/>
  </message>
</list>`;
}

function mtrIncidentNowOverXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<list>
  <message>
    <INCIDENT_NUMBER>IN-26-06001</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Public Transport Service Disruption</INCIDENT_HEADING_EN>
    <INCIDENT_DETAIL_EN>Train Technical Fault</INCIDENT_DETAIL_EN>
    <LOCATION_EN>Tseung Kwan O Line Service Disruption</LOCATION_EN>
    <DISTRICT_EN/>
    <DIRECTION_EN/>
    <ANNOUNCEMENT_DATE>2099-07-16T19:21:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>UPDATED</INCIDENT_STATUS_EN>
    <NEAR_LANDMARK_EN>Yau Tong Station</NEAR_LANDMARK_EN>
    <BETWEEN_LANDMARK_EN/>
    <CONTENT_EN>Transport Department has received notification from MTR Corporation Limited that the incident on the Tseung Kwan O Line is now over. Train service will be back to normal within a short period of time.</CONTENT_EN>
    <LATITUDE/>
    <LONGITUDE/>
  </message>
</list>`;
}

function emptyBundle(): SourceBundle {
  return {};
}

function snapshot(sourceKey: OfficialSourceKey): SourceSnapshot {
  return {
    evidence: [],
    freshness: [
      {
        source_key: sourceKey,
        source_name: sourceKey,
        freshness: "fresh",
        retrieved_at: RETRIEVED_AT,
        updated_at: RETRIEVED_AT,
        message: "Mock source.",
      },
    ],
    itemsFetched: 0,
    sourceKeys: [sourceKey],
    endpointKeys: [`mock:${sourceKey}`],
  };
}

function unavailableSource(
  sourceKey: OfficialSourceKey,
  sourceName: string,
  endpointKey: string,
): SourceSnapshot {
  return {
    evidence: [],
    freshness: [
      {
        source_key: sourceKey,
        source_name: sourceName,
        freshness: "unavailable",
        retrieved_at: RETRIEVED_AT,
        updated_at: null,
        message: "Mock unavailable source.",
      },
    ],
    itemsFetched: 0,
    sourceKeys: [sourceKey],
    endpointKeys: [endpointKey],
  };
}

function claim(text: string, id = "claim"): PhaseOneClaim {
  return {
    id,
    text,
    verdict: "insufficient_evidence",
    confidence: 0.7,
    explanation: "Mock claim.",
    recommendation: "Mock recommendation.",
    evidence: [],
  };
}

function govNewsFeed(): RssFeedConfig {
  return {
    source_key: "govnews",
    source_name: "Government News",
    url: "https://www.news.gov.hk/eng/rss/news.xml",
  };
}

function edbFeed(): RssFeedConfig {
  return {
    source_key: "edb",
    source_name: "Education Bureau",
    url: "https://www.edb.gov.hk/en/news/rss/press.xml",
  };
}

function rssItem(guid: string, title: string, description: string) {
  return {
    guid,
    title,
    description,
    published_at: "2026-07-16T01:00:00.000Z",
    url: `https://example.test/${guid}`,
  };
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}
