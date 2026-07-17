import { describe, expect, it } from "vitest";
import type { AdjudicationOutput } from "./adjudication-contract";
import {
  adjudicateEvidenceRetrievalResult,
  evaluateClaimsWithSources,
  hkoSnapshotFromPayload,
  rhrreadSnapshotFromPayload,
  type SourceBundle,
  type SourceSnapshot,
} from "./live-sources";
import { getGeneratedReportLabel } from "./report-display";
import type { PhaseOneClaim, PhaseOneReport } from "./report-contract";

const RETRIEVED_AT = "2026-07-16T02:00:00.000Z";

describe("weather numeric and aggregate regression cases", () => {
  it("rhrread humidity above threshold is supported", () => {
    const result = evaluate("The current relative humidity is above 50%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("rhrread humidity equal to threshold with above is refuted", () => {
    const result = evaluate("The current relative humidity is above 81%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    expect(result.claims[0]?.verdict).toBe("refuted");
  });

  it("humidity below threshold is supported", () => {
    const result = evaluate("The current relative humidity is below 90%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("humidity at least threshold is supported on equality", () => {
    const result = evaluate("The current relative humidity is at least 81%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("humidity at most threshold is supported on equality", () => {
    const result = evaluate("The current relative humidity is at most 81%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("exact humidity within exact tolerance is supported", () => {
    const result = evaluate("The current relative humidity is 81.4%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("exact humidity outside exact tolerance is refuted", () => {
    const result = evaluate("The current relative humidity is 82%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    expect(result.claims[0]?.verdict).toBe("refuted");
  });

  it("approximate humidity within approximate tolerance is supported", () => {
    const result = evaluate("The current relative humidity is around 83%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("humidity field missing returns insufficient evidence", () => {
    const result = evaluate("The current relative humidity is above 50%.", {
      hko: { rhrread: rhrreadSnapshotFromPayload({ updateTime: "2026-07-16T23:00:00+08:00" }, RETRIEVED_AT) },
    });
    expect(result.claims[0]?.verdict).toBe("insufficient_evidence");
  });

  it("malformed humidity value returns insufficient evidence", () => {
    const result = evaluate("The current relative humidity is above 50%.", {
      hko: { rhrread: humiditySnapshot("not-a-number") },
    });
    expect(result.claims[0]?.verdict).toBe("insufficient_evidence");
  });

  it("stale humidity evidence for current claim returns insufficient evidence", () => {
    const result = evaluate("The current relative humidity is above 50%.", {
      hko: { rhrread: humiditySnapshot(81, "2020-01-01T23:00:00+08:00") },
    });
    expect(result.claims[0]?.verdict).toBe("insufficient_evidence");
  });

  it("normalized humidity evidence is attached to the report", () => {
    const result = evaluate("The current relative humidity is above 50%.", {
      hko: { rhrread: humiditySnapshot(81) },
    });
    const evidence = result.claims[0]?.evidence[0];
    expect(evidence?.id).toContain("hko-rhrread-humidity");
    expect(evidence?.structured_facts?.metric).toBe("relative_humidity");
    expect(evidence?.structured_facts?.observedHumidityPercent).toBe(81);
  });

  it("30C with below 10C is refuted", () => {
    const result = evaluate("The current temperature is below 10°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.verdict).toBe("refuted");
  });

  it("30C with above 10C is supported", () => {
    const result = evaluate("The current temperature is above 10°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("30C with at least 30C is supported", () => {
    const result = evaluate("The current temperature is at least 30°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("30C with above 30C is refuted", () => {
    const result = evaluate("The current temperature is above 30°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.verdict).toBe("refuted");
  });

  it("30C with at most 30C is supported", () => {
    const result = evaluate("The current temperature is at most 30°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("inequality temperature evidence does not include exact tolerance text", () => {
    const result = evaluate("The current temperature is below 10°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.evidence[0]?.excerpt).not.toContain("Tolerance");
  });

  it("inequality temperature explanation names the correct operator", () => {
    const result = evaluate("The current temperature is below 10°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.explanation).toContain("not below 10°C");
  });

  it("existing exact temperature tolerance remains unchanged", () => {
    const result = evaluate("The current temperature in Hong Kong is 30.4°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("existing approximate temperature tolerance remains unchanged", () => {
    const result = evaluate("The current temperature is around 31°C.", {
      hko: { rhrread: temperatureSnapshot(30) },
    });
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("aggregate warning adjudication with fresh summary evidence has high coverage", async () => {
    const result = await adjudicatedAggregate("There are no weather warnings currently in force in Hong Kong.", "refuted");
    expect(result.coverage).toBe("high");
  });

  it("aggregate warning supported or refuted report uses Live Official Verification Report", async () => {
    const result = await adjudicatedAggregate("There are no weather warnings currently in force in Hong Kong.", "refuted");
    expect(getGeneratedReportLabel(reportFrom(result))).toBe("Live Official Verification Report");
  });

  it("insufficient evidence report uses Preliminary Analysis with Live Source Check", () => {
    const result = evaluate("The current relative humidity is above 50%.", {
      hko: { rhrread: rhrreadSnapshotFromPayload({ updateTime: "2026-07-16T23:00:00+08:00" }, RETRIEVED_AT) },
    });
    expect(getGeneratedReportLabel(reportFrom(result))).toBe("Preliminary Analysis with Live Source Check");
  });

  it("endpoint queried without relevant evidence does not produce high coverage", () => {
    const result = evaluate("The current relative humidity is above 50%.", {
      hko: { rhrread: rhrreadSnapshotFromPayload({ updateTime: "2026-07-16T23:00:00+08:00" }, RETRIEVED_AT) },
    });
    expect(result.coverage).not.toBe("high");
  });

  it("W01 specific Thunderstorm Warning remains supported", async () => {
    const result = await withMockedNow("2026-07-17T08:08:00.000Z", async () =>
      evaluate("A Thunderstorm Warning is currently in force in Hong Kong.", {
        hko: { warnsum: activeThunderstormWarnsum() },
      }),
    );
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("W02 absent Typhoon Signal No. 3 remains refuted", () => {
    const result = evaluate("Typhoon Signal No. 3 is currently in force.", {
      hko: { warnsum: activeThunderstormWarnsum() },
    });
    expect(result.claims[0]?.verdict).toBe("refuted");
  });

  it("W03 absent Amber Rainstorm Warning remains refuted", () => {
    const result = evaluate("The Amber Rainstorm Warning is currently active.", {
      hko: { warnsum: activeThunderstormWarnsum() },
    });
    expect(result.claims[0]?.verdict).toBe("refuted");
  });

  it("W04 no-warning aggregate claim with active WTS remains refuted", async () => {
    const result = await adjudicatedAggregate("There are no weather warnings currently in force in Hong Kong.", "refuted");
    expect(result.claims[0]?.verdict).toBe("refuted");
  });

  it("W05 at-least-one warning with active WTS remains supported", async () => {
    const result = await adjudicatedAggregate("At least one weather warning is currently active in Hong Kong.", "supported");
    expect(result.claims[0]?.verdict).toBe("supported");
  });

  it("W06 all-warnings-cancelled with active WTS remains refuted", async () => {
    const result = await adjudicatedAggregate("All weather warnings have been cancelled.", "refuted");
    expect(result.claims[0]?.verdict).toBe("refuted");
  });

  it("deterministic verdict cannot be overridden by adjudicator", async () => {
    const deterministic = await withMockedNow("2026-07-17T08:08:00.000Z", async () =>
      evaluate("A Thunderstorm Warning is currently in force in Hong Kong.", {
        hko: { warnsum: activeThunderstormWarnsum() },
      }),
    );
    let calls = 0;
    const result = await adjudicateEvidenceRetrievalResult(deterministic, {
      adjudicateFn: async () => {
        calls += 1;
        return aggregateOutput("claim", "refuted");
      },
    });
    expect(calls).toBe(0);
    expect(result.claims[0]?.verdict).toBe("supported");
  });
});

function evaluate(text: string, sources: SourceBundle) {
  return evaluateClaimsWithSources([claim(text)], { ...emptyBundle(), ...sources });
}

async function adjudicatedAggregate(text: string, verdict: "supported" | "refuted") {
  return withMockedNow("2026-07-17T08:08:00.000Z", async () => {
    const deterministic = evaluate(text, { hko: { warnsum: activeThunderstormWarnsum() } });
    return adjudicateEvidenceRetrievalResult(deterministic, {
      adjudicateFn: async (input) => aggregateOutput(input.claim.id, verdict),
    });
  });
}

function aggregateOutput(claimId: string, verdict: "supported" | "refuted"): AdjudicationOutput {
  return {
    claim_id: claimId,
    verdict,
    confidence: 0.88,
    evidence_ids_used: ["hko-warnsum-current"],
    supported_elements: verdict === "supported" ? ["HKO lists one active Thunderstorm Warning."] : [],
    contradicted_elements:
      verdict === "refuted" ? ["HKO lists one active Thunderstorm Warning."] : [],
    missing_elements: [],
    explanation:
      verdict === "supported"
        ? "The Hong Kong Observatory warning summary lists one active Thunderstorm Warning."
        : "The claim conflicts with the Hong Kong Observatory warning summary, which lists one active Thunderstorm Warning.",
    recommendation: "Use the attached HKO warning summary as the current official source.",
  };
}

function reportFrom(result: ReturnType<typeof evaluateClaimsWithSources>): PhaseOneReport {
  return {
    report_id: "report-1",
    analysis_type: "preliminary_ai_analysis",
    input_content: result.claims[0]?.text ?? "",
    checked_at: RETRIEVED_AT,
    overall_confidence: result.claims[0]?.confidence ?? 0.5,
    evidence_coverage: result.coverage,
    source_freshness: result.freshness,
    retrieval_counts: result.counts,
    claims: result.claims,
  };
}

function activeThunderstormWarnsum(): SourceSnapshot {
  return hkoSnapshotFromPayload(
    {
      WTS: {
        name: "Thunderstorm Warning",
        code: "WTS",
        actionCode: "EXTEND",
        issueTime: "2026-07-17T03:42:00+08:00",
        expireTime: "2026-07-17T17:00:00+08:00",
        updateTime: "2026-07-17T15:55:00+08:00",
      },
    },
    "2026-07-17T08:08:00.000Z",
  );
}

function temperatureSnapshot(value: number): SourceSnapshot {
  return rhrreadSnapshotFromPayload(
    {
      updateTime: "2026-07-16T23:00:00+08:00",
      temperature: {
        recordTime: "2026-07-16T23:00:00+08:00",
        data: [{ place: "Hong Kong Observatory", value, unit: "C" }],
      },
    },
    RETRIEVED_AT,
  );
}

function humiditySnapshot(
  value: number | string,
  updateTime = "2026-07-16T23:00:00+08:00",
): SourceSnapshot {
  return rhrreadSnapshotFromPayload(
    {
      updateTime,
      humidity: {
        recordTime: updateTime,
        data: [{ place: "Hong Kong Observatory", value, unit: "percent" }],
      },
    },
    RETRIEVED_AT,
  );
}

function claim(text: string): PhaseOneClaim {
  return {
    id: "claim",
    text,
    verdict: "insufficient_evidence",
    confidence: 0.7,
    explanation: "Mock claim.",
    recommendation: "Mock recommendation.",
    evidence: [],
  };
}

function emptyBundle(): SourceBundle {
  return {};
}

async function withMockedNow<T>(iso: string, run: () => Promise<T>): Promise<T> {
  const originalDateNow = Date.now;
  Date.now = () => Date.parse(iso);
  try {
    return await run();
  } finally {
    Date.now = originalDateNow;
  }
}
