import { describe, it } from "vitest";
import type { PhaseOneClaim, PhaseOneEvidence } from "./report-contract";
import { retrieveLiveEvidence } from "./live-sources";
import {
  getTrafficCoordinateSourceText,
  getTrafficEvidenceMapItems,
} from "./traffic-map-utils";
import {
  evaluateTrafficClaimWithSources,
  getTrafficCandidateDebugReport,
  mergeTrafficSnapshots,
  tdSnapshotFromHtml,
  tdSnapshotFromXml,
  type TrafficSourceSnapshot,
} from "./traffic-sources";

const RETRIEVED_AT = "2026-07-16T02:00:00.000Z";
const FRESH_AT = new Date().toISOString();
const NON_STALE_HK_TIME = "2099/7/16 19:21:00";
const NON_STALE_XML_TIME = "2099-07-16T19:21:00";

export async function runTrafficSourceTests(): Promise<void> {
  testExactRoadClosureMatch();
  testRoadReopenedSupportsReopenedAndRefutesClosure();
  testLiveReopenedSentenceRefutesCurrentClosureClaim();
  testLiveReopenedSentenceSupportsReopeningClaim();
  testXmlIncidentCreatesOneCompleteRecord();
  testLiveReopenedSentenceParserAndMetadata();
  testValidXmlCoordinatesReachTrafficMetadataAndMap();
  testEmptyXmlCoordinatesDoNotReachTrafficMetadataOrMap();
  testZeroZeroXmlCoordinatesRejected();
  testEmptyOfficialCoordinatesUseApprovedRegistryFallback();
  testRegistryMissingUsesLocationSummaryFallback();
  testMtrDisruptionXmlMetadata();
  testMtrDisruptionClaimSupported();
  testMtrTechnicalFaultCauseClaimSupported();
  testMtrNormalServiceClaimRefutedByActiveDisruption();
  testMtrIncidentNowOverMetadataDoesNotLeakStaleFields();
  testMtrIncidentNowOverRefutesActiveDisruptionClaim();
  testMtrIncidentNowOverNormalServiceClaimIsInsufficient();
  testMtrIncidentNowOverCauseAbsentIsInsufficient();
  testMtrIncidentNowOverTitleAndExcerpt();
  testDifferentMtrLineDoesNotMatch();
  testSameMtrLineDifferentStationDoesNotMatchWhenStationIsMaterial();
  testPublicTransportBypassesRoadClosureScopeLogic();
  testPublicTransportEvidenceTitleAndMapFallback();
  testHistoricalClosedPhraseDoesNotOverrideCurrentReopenedPhrase();
  testHtmlFallbackCreatesOneCompleteRecord();
  testXmlHtmlDuplicatesAreDeduplicated();
  testUnrelatedReopeningOnAnotherRoadDoesNotMatch();
  testMatchingCongestionStatement();
  testSameDistrictDifferentRoad();
  testSameRoadWrongDirection();
  testSameRoadLandmarkDistrictDifferentDirectionIsReducedNotRejected();
  testFuzzyRoadAbbreviationMatch();
  testSameRoadDifferentUnrelatedEventIsNotAttached();
  testPartialClosureDoesNotSupportAllLanesClaim();
  testOneLaneDoesNotSupportEntireRoadClaim();
  testDirectionlessEvidenceDoesNotSupportDirectionSpecificClaim();
  testExactAllLanesDirectionMatchSupportsClaim();
  testResultFiveAllKowloonBoundLanesRegression();
  testEvidenceExcerptRetainsSpecificTrafficDetails();
  testDescriptiveEvidenceTitleFromOfficialItem();
  testGenericTrafficClaim();
  testPlannedRoadClosureNotice();
  testUnrelatedTransportItem();
  await testTrafficOnlyRequestAvoidsHkoAndGovernmentNews();
  testStaleCurrentTrafficItem();
  testHtmlEntitiesDecoded();
  testAtMostThreeEvidenceItems();
}

describe("traffic sources", () => {
  it("parses and verifies Transport Department evidence", async () => {
    await runTrafficSourceTests();
  });
});

function testExactRoadClosureMatch(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road is currently closed."),
    snapshot([
      evidence(
        "Princess Margaret Road closed",
        "Princess Margaret Road is closed to traffic near Pui Ching Road.",
        "road_closure",
      ),
    ]),
  );

  assertEqual(result.verdict, "supported", "exact road closure is supported");
  assertEqual(result.evidence.length, 1, "road closure evidence is attached");
}

function testRoadReopenedSupportsReopenedAndRefutesClosure(): void {
  const source = snapshot([
    evidence(
      "Princess Margaret Road reopened",
      "The lanes of Princess Margaret Road have reopened to all traffic.",
      "road_reopened",
    ),
  ]);

  const reopened = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road has reopened."),
    source,
  );
  const closure = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road is currently closed."),
    source,
  );

  assertEqual(reopened.verdict, "supported", "reopened claim is supported");
  assertEqual(closure.verdict, "refuted", "closure claim is refuted by reopened item");
}

function testLiveReopenedSentenceRefutesCurrentClosureClaim(): void {
  const source = liveReopeningSnapshot();
  const result = evaluateTrafficClaimWithSources(
    claim("Part of the lanes of Princess Margaret Road near Pui Ching Road are currently closed."),
    source,
  );

  assertEqual(
    result.verdict,
    "refuted",
    "closure claim is refuted by current reopening update",
  );
  assertEqual(result.evidence.length, 1, "reopening evidence is attached");
  assertEqual(
    result.explanation.includes("have reopened to all traffic"),
    true,
    "verdict explanation reflects current reopening state",
  );
}

function testLiveReopenedSentenceSupportsReopeningClaim(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Part of the lanes of Princess Margaret Road near Pui Ching Road have reopened."),
    liveReopeningSnapshot(),
  );

  assertEqual(result.verdict, "supported", "reopening claim is supported by same live item");
  assertEqual(result.evidence.length, 1, "reopening support evidence is attached");
}

function testLiveReopenedSentenceParserAndMetadata(): void {
  const item = liveReopeningXmlSnapshot().evidence[0];

  assertEqual(item?.category, "road_reopened", "parser current event type is road_reopened");
  assertEqual(
    item?.traffic_metadata?.road_name,
    "Princess Margaret Road",
    "metadata keeps road name",
  );
  assertEqual(
    item?.traffic_metadata?.nearby_landmark,
    "Pui Ching Road",
    "metadata keeps nearby landmark",
  );
  assertEqual(
    item?.traffic_metadata?.direction,
    "Tsim Sha Tsui bound",
    "metadata keeps direction",
  );
  assertEqual(item?.traffic_metadata?.event_type, "road_reopened", "metadata keeps event type");
  assertEqual(item?.traffic_metadata?.scope, "part_of_lanes", "metadata keeps lane scope");
  assertEqual(item?.traffic_metadata?.current_status, "reopened", "metadata keeps current status");
  assertEqual(item?.traffic_metadata?.cause, "Traffic Accident", "metadata keeps cause");
  assertEqual(
    item?.traffic_metadata?.map_location_key,
    "princess-margaret-road-pui-ching-road",
    "approved demo map key is populated",
  );
  assertEqual(
    item?.title,
    "Lane Reopening on Princess Margaret Road near Pui Ching Road",
    "evidence title is descriptive",
  );
  assertEqual(
    item?.excerpt,
    "Part of the lanes of Princess Margaret Road (Tsim Sha Tsui bound) near Pui Ching Road, previously closed due to a traffic accident, have reopened to all traffic. Traffic queues may take time to disperse.",
    "evidence excerpt preserves road, direction, scope and reopening state",
  );
}

function testValidXmlCoordinatesReachTrafficMetadataAndMap(): void {
  const item = liveReopeningXmlSnapshot("22.3027", "114.1821").evidence[0];
  const mapItems = getTrafficEvidenceMapItems([
    {
      ...claim("Part of the lanes of Princess Margaret Road near Pui Ching Road have reopened."),
      evidence: item ? [item] : [],
    },
  ]);

  assertEqual(item?.traffic_metadata?.latitude, 22.3027, "valid XML latitude reaches metadata");
  assertEqual(item?.traffic_metadata?.longitude, 114.1821, "valid XML longitude reaches metadata");
  assertEqual(
    item?.traffic_metadata?.coordinate_source,
    "Official TD coordinates",
    "coordinate source is official",
  );
  assertEqual(
    mapItems[0]?.location?.sourceName,
    "Official TD coordinates",
    "map prefers official TD coordinates",
  );
  assertEqual(
    mapItems[0] ? getTrafficCoordinateSourceText(mapItems[0]) : "",
    "Official TD coordinates",
    "badge says official coordinates",
  );
  assertEqual(mapItems[0]?.location?.approximate, false, "official coordinates are not approximate");
}

function testEmptyXmlCoordinatesDoNotReachTrafficMetadataOrMap(): void {
  const item = hongChongEmptyCoordinateXmlSnapshot().evidence[0];
  const mapItems = getTrafficEvidenceMapItems([
    {
      ...claim("Part of the lanes of Hong Chong Road near Hong Kong Polytechnic University have reopened."),
      evidence: item ? [item] : [],
    },
  ]);

  assertEqual(item?.traffic_metadata?.latitude, undefined, "empty XML latitude is not copied");
  assertEqual(item?.traffic_metadata?.longitude, undefined, "empty XML longitude is not copied");
  assertEqual(
    item?.traffic_metadata?.coordinate_source,
    undefined,
    "empty XML coordinates have no coordinate source",
  );
  assertEqual(mapItems[0]?.location, null, "empty XML coordinates do not create a map location");
  assertEqual(
    mapItems[0] ? getTrafficCoordinateSourceText(mapItems[0]) : "",
    "No official coordinates available",
    "badge says no official coordinates",
  );
}

function testZeroZeroXmlCoordinatesRejected(): void {
  const item = liveReopeningXmlSnapshot("0", "0").evidence[0];

  assertEqual(item?.traffic_metadata?.latitude, undefined, "0,0 latitude is rejected");
  assertEqual(item?.traffic_metadata?.longitude, undefined, "0,0 longitude is rejected");
  assertEqual(
    item?.traffic_metadata?.coordinate_source,
    undefined,
    "0,0 does not get an official coordinate source",
  );
}

function testEmptyOfficialCoordinatesUseApprovedRegistryFallback(): void {
  const item = liveReopeningXmlSnapshot().evidence[0];
  const mapItems = getTrafficEvidenceMapItems([
    {
      ...claim("Part of the lanes of Princess Margaret Road near Pui Ching Road have reopened."),
      evidence: item ? [item] : [],
    },
  ]);

  assertEqual(
    mapItems[0]?.location?.approximate,
    true,
    "empty official coordinates can use approved registry fallback",
  );
  assertEqual(
    mapItems[0]?.location?.sourceName,
    "OpenStreetMap road context",
    "registry fallback keeps demo source separate from official coordinates",
  );
  assertEqual(
    mapItems[0] ? getTrafficCoordinateSourceText(mapItems[0]) : "",
    "Approximate demo location",
    "badge says approximate demo location",
  );
}

function testRegistryMissingUsesLocationSummaryFallback(): void {
  const item = hongChongEmptyCoordinateXmlSnapshot().evidence[0];
  const mapItems = getTrafficEvidenceMapItems([
    {
      ...claim("Part of the lanes of Hong Chong Road near Hong Kong Polytechnic University have reopened."),
      evidence: item ? [item] : [],
    },
  ]);

  assertEqual(mapItems[0]?.location, null, "missing registry entry uses Location Summary fallback");
}

function testMtrDisruptionXmlMetadata(): void {
  const item = mtrDisruptionXmlSnapshot().evidence[0];

  assertEqual(item?.category, "public_transport_disruption", "MTR item is public transport");
  assertEqual(item?.traffic_metadata?.road_name, undefined, "line is not stored in road_name");
  assertEqual(item?.traffic_metadata?.transport_mode, "MTR", "metadata keeps MTR mode");
  assertEqual(
    item?.traffic_metadata?.route_or_line,
    "Tseung Kwan O Line",
    "metadata keeps railway line",
  );
  assertEqual(
    item?.traffic_metadata?.station_or_stop,
    "Yau Tong Station",
    "metadata keeps station",
  );
  assertEqual(
    item?.traffic_metadata?.service_status,
    "disrupted",
    "metadata keeps active disruption status",
  );
  assertEqual(
    item?.traffic_metadata?.cause,
    "Train Technical Fault",
    "metadata keeps official cause",
  );
}

function testMtrDisruptionClaimSupported(): void {
  const result = evaluateTrafficClaimWithSources(
    claim(
      "The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station due to a train technical fault.",
    ),
    mtrDisruptionXmlSnapshot(),
  );

  assertEqual(result.verdict, "supported", "live MTR disruption claim is supported");
  assertEqual(result.evidence.length, 1, "MTR disruption evidence is attached");
}

function testMtrTechnicalFaultCauseClaimSupported(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The service disruption on the Tseung Kwan O Line is caused by a train technical fault."),
    mtrDisruptionXmlSnapshot(),
  );

  assertEqual(result.verdict, "supported", "technical-fault cause claim is supported");
  assertEqual(result.evidence.length, 1, "cause claim reuses the TD disruption evidence");
  assertEqual(
    result.explanation,
    "The same official update states that the disruption is caused by a train technical fault.",
    "cause explanation uses the official cause",
  );
}

function testMtrNormalServiceClaimRefutedByActiveDisruption(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The Tseung Kwan O Line is operating normally near Yau Tong Station."),
    mtrDisruptionXmlSnapshot(),
  );

  assertEqual(result.verdict, "refuted", "normal-service claim is refuted");
  assertEqual(result.evidence.length, 1, "active disruption evidence is attached");
}

function testMtrIncidentNowOverMetadataDoesNotLeakStaleFields(): void {
  const item = mtrIncidentNowOverXmlSnapshot().evidence[0];

  assertEqual(item?.category, "public_transport_resumed", "resolved MTR item is not active disruption");
  assertEqual(item?.traffic_metadata?.transport_mode, "MTR", "metadata keeps MTR mode");
  assertEqual(
    item?.traffic_metadata?.route_or_line,
    "Tseung Kwan O Line",
    "metadata keeps line",
  );
  assertEqual(
    item?.traffic_metadata?.service_status,
    "resuming",
    "incident now over is normalized as resuming",
  );
  assertEqual(item?.traffic_metadata?.station_or_stop, undefined, "station is absent");
  assertEqual(item?.traffic_metadata?.cause, undefined, "stale cause does not leak");
}

function testMtrIncidentNowOverRefutesActiveDisruptionClaim(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station."),
    mtrIncidentNowOverXmlSnapshot(),
  );

  assertEqual(result.verdict, "refuted", "resuming update refutes active disruption");
  assertEqual(result.evidence.length, 1, "line-level resuming evidence is attached");
  assertEqual(
    result.explanation.includes("active disruption"),
    true,
    "explanation contradicts active disruption wording",
  );
}

function testMtrIncidentNowOverNormalServiceClaimIsInsufficient(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The Tseung Kwan O Line is operating normally near Yau Tong Station."),
    mtrIncidentNowOverXmlSnapshot(),
  );

  assertEqual(
    result.verdict,
    "insufficient_evidence",
    "back to normal shortly is not explicit normal service",
  );
}

function testMtrIncidentNowOverCauseAbsentIsInsufficient(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The service disruption on the Tseung Kwan O Line is caused by a train technical fault."),
    mtrIncidentNowOverXmlSnapshot(),
  );

  assertEqual(result.verdict, "insufficient_evidence", "cause absent is insufficient");
  assertEqual(result.evidence.length, 1, "cause claim still uses the current TD record");
  assertEqual(
    result.explanation,
    "The current official update does not state that the incident was caused by a train technical fault.",
    "cause explanation says current update lacks the cause",
  );
}

function testMtrIncidentNowOverTitleAndExcerpt(): void {
  const item = mtrIncidentNowOverXmlSnapshot().evidence[0];

  assertEqual(
    item?.title,
    "Service Resuming on the Tseung Kwan O Line",
    "title reflects service resuming",
  );
  assertEqual(
    item?.excerpt,
    "The Transport Department reports that the incident on the Tseung Kwan O Line is now over and train service will return to normal within a short period.",
    "excerpt reflects incident over and service returning to normal",
  );
}

function testDifferentMtrLineDoesNotMatch(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The Island Line is experiencing a service disruption near Yau Tong Station."),
    mtrDisruptionXmlSnapshot(),
  );

  assertEqual(result.evidence.length, 0, "different MTR line is not attached");
  assertEqual(result.verdict, "insufficient_evidence", "different line is insufficient");
}

function testSameMtrLineDifferentStationDoesNotMatchWhenStationIsMaterial(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The Tseung Kwan O Line is experiencing a service disruption near North Point Station."),
    mtrDisruptionXmlSnapshot(),
  );

  assertEqual(result.evidence.length, 0, "different material station is not attached");
  assertEqual(result.verdict, "insufficient_evidence", "different station is insufficient");
}

function testPublicTransportBypassesRoadClosureScopeLogic(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station."),
    mtrDisruptionXmlSnapshot(),
  );

  assertEqual(
    result.explanation.includes("closure scope"),
    false,
    "public transport claim does not use road closure scope wording",
  );
  assertEqual(result.verdict, "supported", "public transport verdict remains deterministic");
}

function testPublicTransportEvidenceTitleAndMapFallback(): void {
  const item = mtrDisruptionXmlSnapshot().evidence[0];
  const mapItems = getTrafficEvidenceMapItems([
    {
      ...claim("The Tseung Kwan O Line is experiencing a service disruption near Yau Tong Station."),
      evidence: item ? [item] : [],
    },
  ]);

  assertEqual(
    item?.title,
    "Service Disruption on the Tseung Kwan O Line near Yau Tong Station",
    "public transport title uses line and station metadata",
  );
  assertEqual(mapItems[0]?.location, null, "MTR disruption has no road map without safe coordinates");
  assertEqual(
    mapItems[0] ? getTrafficCoordinateSourceText(mapItems[0]) : "",
    "No official coordinates available",
    "public transport map item uses no-coordinate badge",
  );
}

function testXmlIncidentCreatesOneCompleteRecord(): void {
  const source = liveReopeningXmlSnapshot();
  const item = source.evidence[0];

  assertEqual(source.evidence.length, 1, "one XML message creates one normalized record");
  assertEqual(
    item?.summary.includes("Princess Margaret Road"),
    true,
    "XML record keeps road and content together",
  );
  assertEqual(
    item?.summary.includes("is re-opened to all traffic"),
    true,
    "XML record keeps final reopened predicate with location",
  );
  assertEqual(source.endpointKeys[0], "td:special_news_xml", "XML endpoint is represented");
}

function testHistoricalClosedPhraseDoesNotOverrideCurrentReopenedPhrase(): void {
  const debug = getTrafficCandidateDebugReport(
    "Part of the lanes of Princess Margaret Road near Pui Ching Road are currently closed.",
    liveReopeningSnapshot(),
  );

  assertEqual(
    debug[0]?.eventState.historicalPhrases.includes("which was closed"),
    true,
    "historical closed phrase is detected",
  );
  assertEqual(
    debug[0]?.eventState.currentPhrases.includes("is re opened"),
    true,
    "current reopening phrase is detected",
  );
  assertEqual(
    debug[0]?.eventState.selectedCurrentState,
    "reopened",
    "final current state chooses reopened",
  );
  assertEqual(
    debug[0]?.contradictionDecision,
    "contradicts_claim",
    "diagnostics show contradiction decision",
  );
}

function testHtmlFallbackCreatesOneCompleteRecord(): void {
  const source = liveReopeningSnapshot();
  const item = source.evidence[0];

  assertEqual(source.evidence.length, 1, "one HTML li creates one normalized record");
  assertEqual(item?.category, "road_reopened", "HTML fallback keeps reopened state");
  assertEqual(
    item?.traffic_metadata?.road_name,
    "Princess Margaret Road",
    "HTML fallback keeps road",
  );
  assertEqual(
    item?.traffic_metadata?.nearby_landmark,
    "Pui Ching Road",
    "HTML fallback keeps landmark",
  );
}

function testXmlHtmlDuplicatesAreDeduplicated(): void {
  const merged = mergeTrafficSnapshots([liveReopeningXmlSnapshot(), liveReopeningSnapshot()]);

  assertEqual(merged?.evidence.length, 1, "XML and HTML duplicate incident is deduplicated");
}

function testUnrelatedReopeningOnAnotherRoadDoesNotMatch(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Part of the lanes of Princess Margaret Road near Pui Ching Road are currently closed."),
    tdSnapshotFromHtml(
      "<html><body><p>1. Part of the lanes of Nathan Road near Jordan Road which was closed due to traffic accident is re-opened to all traffic.</p></body></html>",
      RETRIEVED_AT,
    ),
  );

  assertEqual(result.evidence.length, 0, "unrelated road reopening is not attached");
  assertEqual(result.verdict, "insufficient_evidence", "unrelated reopening is insufficient");
}

function testMatchingCongestionStatement(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Traffic is busy near Pui Ching Road."),
    snapshot([
      evidence(
        "Traffic busy near Pui Ching Road",
        "Traffic is busy near Pui Ching Road and Princess Margaret Road.",
        "traffic_congestion",
      ),
    ]),
  );

  assertEqual(result.verdict, "supported", "matching congestion statement is supported");
}

function testSameDistrictDifferentRoad(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road is currently closed in Kowloon."),
    snapshot([
      evidence(
        "Nathan Road closure",
        "Nathan Road in Kowloon is closed to traffic.",
        "road_closure",
      ),
    ]),
  );

  assertEqual(result.evidence.length, 0, "same district different road is not attached");
  assertEqual(result.verdict, "insufficient_evidence", "same district alone is insufficient");
}

function testSameRoadWrongDirection(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Causeway Road Tsim Sha Tsui bound is currently closed."),
    snapshot([
      evidence(
        "Causeway Road Kowloon bound closed",
        "Causeway Road Kowloon bound is closed to traffic.",
        "road_closure",
      ),
    ]),
  );

  assertEqual(result.evidence.length, 0, "wrong direction is not attached");
}

function testSameRoadLandmarkDistrictDifferentDirectionIsReducedNotRejected(): void {
  const source = snapshot([
    evidence(
      "Causeway Road Kowloon bound closed near Victoria Park",
      "Causeway Road Kowloon bound near Victoria Park in Causeway Bay is closed to traffic.",
      "road_closure",
    ),
  ]);
  const debug = getTrafficCandidateDebugReport(
    "Causeway Road Tsim Sha Tsui bound near Victoria Park in Causeway Bay is currently closed.",
    source,
  );
  const result = evaluateTrafficClaimWithSources(
    claim(
      "Causeway Road Tsim Sha Tsui bound near Victoria Park in Causeway Bay is currently closed.",
    ),
    source,
  );

  assertEqual(debug[0]?.directionMatch, false, "different direction is reported in diagnostics");
  assertEqual(
    debug[0]?.rejectionReason,
    "direction_mismatch_score_reduced",
    "different direction reduces score instead of forcing zero",
  );
  assertEqual(result.evidence.length, 1, "strong road landmark district match can still attach");
}

function testFuzzyRoadAbbreviationMatch(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Rd is currently closed near Pui Ching Rd."),
    snapshot([
      evidence(
        "Princess Margaret Road closure",
        "Princess Margaret Road is closed to traffic near Pui Ching Road.",
        "road_closure",
      ),
    ]),
  );

  assertEqual(result.verdict, "supported", "road abbreviations match full road names");
  assertEqual(result.evidence.length, 1, "fuzzy road abbreviation evidence is attached");
}

function testSameRoadDifferentUnrelatedEventIsNotAttached(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road is currently closed near Pui Ching Road."),
    snapshot([
      evidence(
        "Busy traffic on Princess Margaret Road",
        "Traffic is busy on Princess Margaret Road near Pui Ching Road.",
        "traffic_congestion",
      ),
    ]),
  );

  assertEqual(result.evidence.length, 0, "same road with unrelated traffic event is not attached");
  assertEqual(result.verdict, "insufficient_evidence", "unrelated event is insufficient");
}

function testPartialClosureDoesNotSupportAllLanesClaim(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("All lanes of Princess Margaret Road are closed."),
    snapshot([
      evidence(
        "Partial lane closure on Princess Margaret Road",
        "Part of the lanes of Princess Margaret Road near Pui Ching Road are closed to traffic.",
        "lane_closure",
      ),
    ]),
  );

  assertEqual(result.verdict, "insufficient_evidence", "partial closure does not support all lanes");
  assertEqual(
    result.explanation.includes("does not establish the full claimed closure scope"),
    true,
    "scope explanation is consistent with insufficient verdict",
  );
}

function testOneLaneDoesNotSupportEntireRoadClaim(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("The entire Princess Margaret Road is completely closed."),
    snapshot([
      evidence(
        "One lane closure on Princess Margaret Road",
        "One lane of Princess Margaret Road near Pui Ching Road is closed to traffic.",
        "lane_closure",
      ),
    ]),
  );

  assertEqual(result.verdict, "insufficient_evidence", "one lane does not support entire road");
}

function testDirectionlessEvidenceDoesNotSupportDirectionSpecificClaim(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Kowloon-bound lanes of Princess Margaret Road are closed."),
    snapshot([
      evidence(
        "Princess Margaret Road lane closure",
        "Part of the lanes of Princess Margaret Road near Pui Ching Road are closed to traffic.",
        "lane_closure",
      ),
    ]),
  );

  assertEqual(
    result.verdict,
    "insufficient_evidence",
    "directionless evidence does not support direction-specific claim",
  );
}

function testExactAllLanesDirectionMatchSupportsClaim(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("All Kowloon-bound lanes of Princess Margaret Road are closed."),
    snapshot([
      evidence(
        "All Kowloon-bound lanes closed on Princess Margaret Road",
        "All Kowloon-bound lanes of Princess Margaret Road near Pui Ching Road are closed to traffic.",
        "lane_closure",
      ),
    ]),
  );

  assertEqual(result.verdict, "supported", "exact all-lanes direction match is supported");
}

function testResultFiveAllKowloonBoundLanesRegression(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("All Kowloon-bound lanes of Princess Margaret Road are closed."),
    snapshot([
      evidence(
        "Partial Princess Margaret Road lane closure",
        "Part of the Kowloon-bound lanes of Princess Margaret Road near Pui Ching Road are closed to traffic.",
        "lane_closure",
      ),
    ]),
  );

  assertEqual(
    result.verdict,
    "insufficient_evidence",
    "Result 5 all-lanes claim is not supported by partial closure evidence",
  );
}

function testEvidenceExcerptRetainsSpecificTrafficDetails(): void {
  const snapshotFromHtml = tdSnapshotFromHtml(
    "<html><body><p>2026/07/16 09:00:00</p><p>1. Part of the Kowloon-bound lanes of Princess Margaret Road near Pui Ching Road are closed to traffic.</p></body></html>",
    RETRIEVED_AT,
  );
  const excerpt = snapshotFromHtml.evidence[0]?.excerpt ?? "";

  assertEqual(excerpt.includes("Princess Margaret Road"), true, "excerpt keeps road name");
  assertEqual(excerpt.includes("Kowloon-bound"), true, "excerpt keeps direction");
  assertEqual(excerpt.includes("Part of the"), true, "excerpt keeps closure scope");
  assertEqual(excerpt.includes("closed to traffic"), true, "excerpt keeps event type");
}

function testDescriptiveEvidenceTitleFromOfficialItem(): void {
  const snapshotFromHtml = tdSnapshotFromHtml(
    "<html><body><p>2026/07/16 09:00:00</p><p>1. Part of the Kowloon-bound lanes of Princess Margaret Road near Pui Ching Road are closed to traffic.</p></body></html>",
    RETRIEVED_AT,
  );
  const title = snapshotFromHtml.evidence[0]?.title ?? "";

  assertEqual(
    title.startsWith("Lane Closure on"),
    true,
    "HTML evidence title is descriptive instead of an internal numeric placeholder",
  );
  assertEqual(title.includes("Transport Department road closure"), false, "old placeholder is gone");
  assertEqual(title.includes("traffic update"), false, "generic traffic update placeholder is gone");
}

function testGenericTrafficClaim(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Major roads in Kowloon are closed."),
    snapshot([
      evidence(
        "Nathan Road closure",
        "Nathan Road in Kowloon is closed to traffic.",
        "road_closure",
      ),
    ]),
  );

  assertEqual(result.verdict, "insufficient_evidence", "generic broad road claim is insufficient");
}

function testPlannedRoadClosureNotice(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road will close tomorrow."),
    snapshot([
      evidence(
        "Temporary traffic arrangement on Princess Margaret Road",
        "Princess Margaret Road will be closed to traffic tomorrow for road works.",
        "planned_traffic_arrangement",
        "government_rss",
      ),
    ]),
  );

  assertEqual(result.verdict, "supported", "planned road closure notice is supported");
  assertEqual(
    result.evidence[0]?.source_type,
    "government_rss",
    "planned notice uses RSS evidence",
  );
}

function testUnrelatedTransportItem(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road is currently closed."),
    snapshot([
      evidence(
        "Bus route notice",
        "Bus route 8P will adjust its timetable in Sai Kung.",
        "public_transport_disruption",
      ),
    ]),
  );

  assertEqual(result.evidence.length, 0, "unrelated Transport item is not attached");
}

async function testTrafficOnlyRequestAvoidsHkoAndGovernmentNews(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    return new Response(
      "<html><body><p>1. Princess Margaret Road is closed to traffic.</p></body></html>",
      { status: 200, headers: { "content-type": "text/html" } },
    );
  }) as typeof fetch;

  try {
    const result = await retrieveLiveEvidence([
      claim("Princess Margaret Road is currently closed."),
    ]);
    assertEqual(result.claims[0]?.verdict, "supported", "traffic-only request verifies traffic");
    assertEqual(
      requestedUrls.some((url) => url.includes("weatherAPI/opendata/weather.php")),
      false,
      "traffic-only request does not query HKO",
    );
    assertEqual(
      requestedUrls.some((url) => url.includes("news.gov.hk") || url.includes("edb.gov.hk")),
      false,
      "traffic-only request does not query Government News or EDB",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testStaleCurrentTrafficItem(): void {
  const oldDate = "2020-01-01T00:00:00.000Z";
  const result = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road is currently closed."),
    {
      ...snapshot([
        {
          ...evidence(
            "Princess Margaret Road closed",
            "Princess Margaret Road is closed to traffic.",
            "road_closure",
          ),
          updated_at: oldDate,
          freshness: "stale",
        },
      ]),
      freshness: [
        {
          source_key: "td",
          source_name: "Transport Department",
          freshness: "stale",
          retrieved_at: RETRIEVED_AT,
          updated_at: oldDate,
          message: "Mock stale source.",
        },
      ],
    },
  );

  assertEqual(result.verdict, "insufficient_evidence", "stale current item is not active evidence");
  assertEqual(result.evidence.length, 0, "stale current evidence is not attached");
}

function testHtmlEntitiesDecoded(): void {
  const snapshotFromHtml = tdSnapshotFromHtml(
    "<html><body><p>2026/07/16 09:00:00</p><p>1. Princess Margaret Road &amp; Pui Ching Road&nbsp;are closed to traffic.</p></body></html>",
    RETRIEVED_AT,
  );
  const summary = snapshotFromHtml.evidence[0]?.summary ?? "";

  assertEqual(summary.includes("&amp;"), false, "ampersand entity is decoded");
  assertEqual(summary.includes("&nbsp;"), false, "nbsp entity is decoded");
}

function testAtMostThreeEvidenceItems(): void {
  const result = evaluateTrafficClaimWithSources(
    claim("Princess Margaret Road is currently closed."),
    snapshot([
      evidence("1", "Princess Margaret Road is closed to traffic.", "road_closure"),
      evidence(
        "2",
        "Princess Margaret Road is closed to traffic near Pui Ching Road.",
        "road_closure",
      ),
      evidence("3", "Princess Margaret Road southbound is closed to traffic.", "road_closure"),
      evidence("4", "Princess Margaret Road northbound is closed to traffic.", "road_closure"),
    ]),
  );

  assertEqual(result.evidence.length, 3, "traffic evidence is limited to top three items");
}

function liveReopeningSnapshot(): TrafficSourceSnapshot {
  return tdSnapshotFromHtml(
    `<html><body><p>${NON_STALE_HK_TIME}</p><ol><li>Part of the lanes of Princess Margaret Road (Tsim Sha Tsui bound) near Pui Ching Road which was closed due to traffic accident is re-opened to all traffic. Traffic queue takes time to disperse.</li></ol></body></html>`,
    RETRIEVED_AT,
  );
}

function liveReopeningXmlSnapshot(latitude = "", longitude = ""): TrafficSourceSnapshot {
  return tdSnapshotFromXml(
    `<?xml version="1.0" encoding="UTF-8"?>
<list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://www.td.gov.hk/en/special_news/trafficnews.xsd">
  <message>
    <INCIDENT_NUMBER>IN-26-05123</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
    <INCIDENT_DETAIL_EN>Traffic Accident</INCIDENT_DETAIL_EN>
    <LOCATION_EN>Princess Margaret Road</LOCATION_EN>
    <DISTRICT_EN/>
    <DIRECTION_EN>Tsim Sha Tsui</DIRECTION_EN>
    <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
    <NEAR_LANDMARK_EN>Pui Ching Road</NEAR_LANDMARK_EN>
    <BETWEEN_LANDMARK_EN/>
    <ID>142222</ID>
    <CONTENT_EN>Part of the lanes of Princess Margaret Road (Tsim Sha Tsui bound) near Pui Ching Road which was closed due to traffic accident is re-opened to all traffic. Traffic queue takes time to disperse.</CONTENT_EN>
    <LATITUDE>${latitude}</LATITUDE>
    <LONGITUDE>${longitude}</LONGITUDE>
  </message>
</list>`,
    RETRIEVED_AT,
  );
}

function hongChongEmptyCoordinateXmlSnapshot(): TrafficSourceSnapshot {
  return tdSnapshotFromXml(
    `<?xml version="1.0" encoding="UTF-8"?>
<list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://www.td.gov.hk/en/special_news/trafficnews.xsd">
  <message>
    <INCIDENT_NUMBER>IN-26-05091</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
    <INCIDENT_DETAIL_EN>Vehicle Breakdown</INCIDENT_DETAIL_EN>
    <LOCATION_EN>Hong Chong Road</LOCATION_EN>
    <DISTRICT_EN/>
    <DIRECTION_EN>Yau Ma Tei</DIRECTION_EN>
    <ANNOUNCEMENT_DATE>2026-07-16T19:38:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>UPDATED</INCIDENT_STATUS_EN>
    <NEAR_LANDMARK_EN>Hong Kong Polytechnic University</NEAR_LANDMARK_EN>
    <BETWEEN_LANDMARK_EN/>
    <ID>142222</ID>
    <CONTENT_EN>Part of the lanes of Hong Chong Road (Yau Ma Tei bound) near Hong Kong Polytechnic University which was closed due to vehicle breakdown is re-opened to all traffic. </CONTENT_EN>
    <LATITUDE/>
    <LONGITUDE/>
  </message>
</list>`,
    RETRIEVED_AT,
  );
}

function mtrDisruptionXmlSnapshot(): TrafficSourceSnapshot {
  return tdSnapshotFromXml(
    `<?xml version="1.0" encoding="UTF-8"?>
<list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://www.td.gov.hk/en/special_news/trafficnews.xsd">
  <message>
    <INCIDENT_NUMBER>IN-26-06001</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Public Transport Service Disruption</INCIDENT_HEADING_EN>
    <INCIDENT_DETAIL_EN>Train Technical Fault</INCIDENT_DETAIL_EN>
    <LOCATION_EN>Tseung Kwan O Line Service Disruption</LOCATION_EN>
    <DISTRICT_EN/>
    <DIRECTION_EN/>
    <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
    <NEAR_LANDMARK_EN>Yau Tong Station</NEAR_LANDMARK_EN>
    <BETWEEN_LANDMARK_EN/>
    <ID>143001</ID>
    <CONTENT_EN>Tseung Kwan O Line service disruption near Yau Tong Station due to train technical fault.</CONTENT_EN>
    <LATITUDE/>
    <LONGITUDE/>
  </message>
</list>`,
    RETRIEVED_AT,
  );
}

function mtrIncidentNowOverXmlSnapshot(): TrafficSourceSnapshot {
  return tdSnapshotFromXml(
    `<?xml version="1.0" encoding="UTF-8"?>
<list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://www.td.gov.hk/en/special_news/trafficnews.xsd">
  <message>
    <INCIDENT_NUMBER>IN-26-06001</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Public Transport Service Disruption</INCIDENT_HEADING_EN>
    <INCIDENT_DETAIL_EN>Train Technical Fault</INCIDENT_DETAIL_EN>
    <LOCATION_EN>Tseung Kwan O Line Service Disruption</LOCATION_EN>
    <DISTRICT_EN/>
    <DIRECTION_EN/>
    <ANNOUNCEMENT_DATE>${NON_STALE_XML_TIME}</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>UPDATED</INCIDENT_STATUS_EN>
    <NEAR_LANDMARK_EN>Yau Tong Station</NEAR_LANDMARK_EN>
    <BETWEEN_LANDMARK_EN/>
    <ID>143001</ID>
    <CONTENT_EN>Transport Department has received notification from MTR Corporation Limited that the incident on the Tseung Kwan O Line is now over. Train service will be back to normal within a short period of time.</CONTENT_EN>
    <LATITUDE/>
    <LONGITUDE/>
  </message>
</list>`,
    RETRIEVED_AT,
  );
}

function snapshot(evidenceItems: PhaseOneEvidence[]): TrafficSourceSnapshot {
  return {
    evidence: evidenceItems,
    freshness: [
      {
        source_key: "td",
        source_name: "Transport Department",
        freshness: "fresh",
        retrieved_at: RETRIEVED_AT,
        updated_at: FRESH_AT,
        message: "Mock Transport Department source.",
      },
    ],
    itemsFetched: evidenceItems.length,
    sourceKeys: ["td"],
    endpointKeys: ["td:mock"],
  };
}

function evidence(
  title: string,
  summary: string,
  category: NonNullable<PhaseOneEvidence["category"]>,
  sourceType: PhaseOneEvidence["source_type"] = "government_webpage",
): PhaseOneEvidence {
  return {
    id: `td-${title.replace(/\W+/g, "-").toLowerCase()}`,
    source_key: "td",
    source_name: "Transport Department",
    source_authority: "official",
    source_type: sourceType,
    category,
    title,
    excerpt: summary,
    summary,
    url: "https://www.td.gov.hk/en/special_news/spnews.htm",
    published_at: null,
    updated_at: FRESH_AT,
    retrieved_at: RETRIEVED_AT,
    freshness: "fresh",
  };
}

function claim(text: string): PhaseOneClaim {
  return {
    id: text.slice(0, 20),
    text,
    verdict: "insufficient_evidence",
    confidence: 0.7,
    explanation: "Mock claim.",
    recommendation: "Mock recommendation.",
    evidence: [],
  };
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}
