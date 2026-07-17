import { describe, it } from "vitest";
import type { AdjudicationInput, AdjudicationOutput } from "./adjudication-contract";
import {
  adjudicateClaimWithOfficialEvidence,
  applyAdjudicationToClaim,
  validateAdjudicationOutput,
} from "./evidence-adjudicator";
import type { PhaseOneClaim, PhaseOneEvidence } from "./report-contract";

export async function runEvidenceAdjudicatorTests(): Promise<void> {
  await testExactSemanticSupport();
  await testDirectContradiction();
  await testPartialSupportIsInsufficient();
  await testEmptyEvidenceIsInsufficient();
  testStaleEvidenceForCurrentClaimCannotSupport();
  testInventedEvidenceIdRejected();
  testInventedWarnsumWarningRejected();
  testInventedSourceRejected();
  await testMalformedJsonSafelyHandled();
  testOneEvidenceItemReusedSafely();
  testConfidenceCapsApplied();
  testNoModelGeneratedUrlAccepted();
}

describe("evidence adjudicator", () => {
  it("validates and safely applies adjudicator outputs", async () => {
    await runEvidenceAdjudicatorTests();
  });
});

async function testExactSemanticSupport(): Promise<void> {
  const input = adjudicationInput();
  const result = await adjudicateClaimWithOfficialEvidence(input, {
    adjudicateFn: async () => output({ verdict: "supported", confidence: 0.96 }),
  });

  assertEqual(result.ok, true, "semantic support validates");
  if (result.ok) {
    assertEqual(result.output.verdict, "supported", "semantic support verdict");
    assertEqual(result.output.confidence, 0.88, "single-source confidence is capped");
  }
}

async function testDirectContradiction(): Promise<void> {
  const result = await adjudicateClaimWithOfficialEvidence(adjudicationInput(), {
    adjudicateFn: async () =>
      output({
        verdict: "refuted",
        confidence: 0.86,
        contradicted_elements: ["The supplied announcement says the scheme is not open."],
      }),
  });

  assertEqual(result.ok, true, "direct contradiction validates");
  if (result.ok) assertEqual(result.output.verdict, "refuted", "contradiction verdict");
}

async function testPartialSupportIsInsufficient(): Promise<void> {
  const result = await adjudicateClaimWithOfficialEvidence(adjudicationInput(), {
    adjudicateFn: async () =>
      output({
        verdict: "insufficient_evidence",
        confidence: 0.9,
        missing_elements: ["The evidence does not establish the date in the claim."],
      }),
  });

  assertEqual(result.ok, true, "partial support validates as insufficient");
  if (result.ok) {
    assertEqual(result.output.verdict, "insufficient_evidence", "partial support verdict");
    assertEqual(result.output.confidence, 0.6, "insufficient confidence is capped");
  }
}

async function testEmptyEvidenceIsInsufficient(): Promise<void> {
  const result = await adjudicateClaimWithOfficialEvidence({ ...adjudicationInput(), evidence: [] });
  assertEqual(result.ok, true, "empty evidence safely returns insufficient");
  if (result.ok) assertEqual(result.output.verdict, "insufficient_evidence", "empty evidence verdict");
}

function testStaleEvidenceForCurrentClaimCannotSupport(): void {
  const input = adjudicationInput({ freshness: "stale" });
  const result = validateAdjudicationOutput(output({ verdict: "supported" }), input);
  assertEqual(result.ok, false, "stale evidence cannot support current claim");
}

function testInventedEvidenceIdRejected(): void {
  const result = validateAdjudicationOutput(
    output({ evidence_ids_used: ["invented-evidence"] }),
    adjudicationInput(),
  );
  assertEqual(result.ok, false, "invented evidence ID rejected");
}

function testInventedWarnsumWarningRejected(): void {
  const result = validateAdjudicationOutput(
    output({
      evidence_ids_used: ["hko-warnsum-current"],
      explanation: "The HKO warning summary lists a Black Rainstorm Warning.",
    }),
    {
      claim: {
        id: "claim-1",
        text: "There are no weather warnings currently in force in Hong Kong.",
        category: "active_weather_warning",
      },
      evidence: [
        {
          evidence_id: "hko-warnsum-current",
          source: "Hong Kong Observatory",
          source_type: "hko_warning",
          title: "HKO Current Weather Warning Summary",
          content: "Active warnings: Thunderstorm Warning.",
          updated_at: "2026-07-17T07:55:00.000Z",
          retrieved_at: "2026-07-17T08:08:00.000Z",
          freshness: "fresh",
          structured_facts: {
            facts: {
              active_warning_count: 1,
              active_warning_codes: ["WTS"],
              active_warning_names: ["Thunderstorm Warning"],
            },
          },
        },
      ],
    },
  );
  assertEqual(result.ok, false, "invented warning name rejected");
}


function testInventedSourceRejected(): void {
  const result = validateAdjudicationOutput(
    output({ explanation: "The Transport Department confirms this policy." }),
    adjudicationInput(),
  );
  assertEqual(result.ok, false, "invented source rejected");
}

async function testMalformedJsonSafelyHandled(): Promise<void> {
  const result = await adjudicateClaimWithOfficialEvidence(adjudicationInput(), {
    adjudicateFn: async () => "not an object",
  });
  assertEqual(result.ok, false, "malformed adjudicator output is rejected");
}

function testOneEvidenceItemReusedSafely(): void {
  const claim = phaseClaim();
  const evidence = [phaseEvidence()];
  const adjudicated = applyAdjudicationToClaim(claim, evidence, output({ verdict: "supported" }));

  assertEqual(adjudicated.evidence.length, 1, "one evidence item can be reused");
  assertEqual(adjudicated.evidence[0]?.id, "gov-1", "existing evidence item is used");
}

function testConfidenceCapsApplied(): void {
  const result = validateAdjudicationOutput(output({ confidence: 0.99 }), adjudicationInput());
  assertEqual(result.ok, true, "high confidence output validates");
  if (result.ok) assertEqual(result.output.confidence, 0.88, "confidence cap applied");
}

function testNoModelGeneratedUrlAccepted(): void {
  const result = validateAdjudicationOutput(
    output({ explanation: "See https://invented.example for more detail." }),
    adjudicationInput(),
  );
  assertEqual(result.ok, false, "generated URL is rejected");
}

function adjudicationInput(overrides: Partial<AdjudicationInput["evidence"][number]> = {}): AdjudicationInput {
  return {
    claim: {
      id: "claim-1",
      text: "The government subsidy is currently open to all residents.",
      category: "general_government",
    },
    evidence: [
      {
        evidence_id: "gov-1",
        source: "Government News",
        source_type: "rss_item",
        title: "Government subsidy opens for applications",
        content: "The government subsidy is open to eligible permanent residents.",
        published_at: "2026-07-16T00:00:00.000Z",
        updated_at: "2026-07-16T00:00:00.000Z",
        retrieved_at: "2026-07-16T01:00:00.000Z",
        freshness: "fresh",
        ...overrides,
      },
    ],
  };
}

function output(overrides: Partial<AdjudicationOutput> = {}): AdjudicationOutput {
  return {
    claim_id: "claim-1",
    verdict: "supported",
    confidence: 0.86,
    evidence_ids_used: ["gov-1"],
    supported_elements: ["The supplied evidence supports the claim."],
    contradicted_elements: [],
    missing_elements: [],
    explanation: "The supplied Government News evidence directly supports the claim.",
    recommendation: "Use the attached official evidence when presenting this claim.",
    ...overrides,
  };
}

function phaseClaim(): PhaseOneClaim {
  return {
    id: "claim-1",
    text: "The government subsidy is currently open to all residents.",
    verdict: "insufficient_evidence",
    confidence: 0.6,
    explanation: "Relevant official text was found.",
    recommendation: "Review the official evidence.",
    evidence: [phaseEvidence()],
  };
}

function phaseEvidence(): PhaseOneEvidence {
  return {
    id: "gov-1",
    source_key: "govnews",
    source_name: "Government News",
    source_type: "rss_item",
    title: "Government subsidy opens for applications",
    summary: "The government subsidy is open to eligible permanent residents.",
    url: "https://www.news.gov.hk/example",
    published_at: "2026-07-16T00:00:00.000Z",
    updated_at: "2026-07-16T00:00:00.000Z",
    retrieved_at: "2026-07-16T01:00:00.000Z",
    freshness: "fresh",
  };
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}
