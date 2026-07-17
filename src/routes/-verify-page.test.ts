import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { getVerificationModeMismatchMessage } from "@/lib/verification-mode";

describe("Verify page UX", () => {
  it("keeps the Verify page text-only with empty initial input and helper examples", () => {
    const source = readFileSync("src/routes/_app.verify.tsx", "utf8");

    assertNotIncludes(source, "TabsTrigger", "does not render input type tabs");
    assertNotIncludes(source, "ImageIcon", "does not render Image selector");
    assertNotIncludes(source, "FileType", "does not render PDF selector");
    assertNotIncludes(source, "FileDropZone", "does not keep upload-only component");
    assertNotIncludes(source, "uploadedContent", "does not prefill mock claim");
    assertIncludes(source, 'useState("")', "text input starts empty");
    assertIncludes(
      source,
      'placeholder="Enter a factual claim to verify..."',
      "uses required placeholder",
    );
    assertIncludes(
      source,
      '"The current temperature in Hong Kong is above 30°C."',
      "renders weather example",
    );
    assertIncludes(source, '"Traffic is busy on Nathan Road."', "renders traffic example");
    assertIncludes(
      source,
      "Supports weather and transport claims verified against official Hong Kong sources.",
      "renders helper sentence",
    );
    assertIncludes(source, "disabled={!trimmedText}", "button is disabled for empty input");
    assertIncludes(source, 'mode === "weather"', "weather mode shows weather testing panel");
    assertIncludes(source, "Weather Test Claims", "renders weather test claims panel title");
    assertIncludes(
      source,
      "A Thunderstorm Warning is currently in force in Hong Kong.",
      "renders thunderstorm warning test claim",
    );
    assertIncludes(
      source,
      "There are no weather warnings currently in force in Hong Kong.",
      "renders no-warning aggregate test claim",
    );
    assertIncludes(
      source,
      "The current relative humidity is above 50%.",
      "renders humidity test claim",
    );
    assertIncludes(source, 'mode === "traffic"', "traffic mode shows live testing panel");
    assertIncludes(source, "Current Traffic Events", "renders traffic events panel title");
    assertIncludes(source, "Load Live Traffic Events", "renders product load action");
    assertIncludes(source, "Refresh", "renders refresh action");
    assertIncludes(source, "Generate Verification", "renders event-card action");
    assertIncludes(source, "✓ Verify Official Claim", "renders supported option copy");
    assertIncludes(source, "✗ Generate Contradiction", "renders refuted option copy");
    assertIncludes(source, "✎ Edit Manually", "renders edit option copy");
    assertNotIncludes(source, "Live Traffic Test Claims", "removes developer-sounding title");
    assertNotIncludes(source, "Load current TD records", "removes developer-sounding load label");
    assertIncludes(source, "setText(claim);", "use claim fills textarea");
    assertIncludes(
      source,
      "PENDING_TRAFFIC_GENERATION_METADATA_KEY",
      "use claim stores session-scoped generation metadata",
    );
    assertNotIncludes(source, "onUseClaim={(claim) => analyze", "use claim does not submit");
    assertIncludes(source, "disabled={loading}", "refresh/load is disabled while loading");
  });

  it("preserves whitespace validation and mode mismatch messaging", () => {
    const source = readFileSync("src/routes/_app.verify.tsx", "utf8");

    assertIncludes(source, "const trimmed = text.trim();", "trims input before validation");
    assertIncludes(source, "Please enter some text to analyze.", "keeps empty-input message");
    assertEqual(
      getVerificationModeMismatchMessage(
        "The Hong Kong Observatory has issued a Thunderstorm Warning.",
        "traffic",
      ),
      "This appears to be a weather claim. Please switch to Weather mode or Auto Detect.",
      "weather claim blocked in traffic mode",
    );
    assertEqual(
      getVerificationModeMismatchMessage("Traffic is busy on Nathan Road.", "weather"),
      "This appears to be a traffic claim. Please switch to Traffic mode or Auto Detect.",
      "traffic claim blocked in weather mode",
    );
  });

  it("keeps Traffic test panel out of Auto Detect and Weather branches", () => {
    const source = readFileSync("src/routes/_app.verify.tsx", "utf8");
    const panelConditionCount = source.match(/mode === "traffic"/g)?.length ?? 0;

    assertEqual(panelConditionCount, 1, "traffic panel has exactly one traffic-only render guard");
    assertNotIncludes(source, 'mode === "auto" && <TrafficTestPanel', "auto does not render panel");
    assertNotIncludes(source, 'mode === "weather" && <TrafficTestPanel', "weather does not render panel");
  });
});

function assertIncludes(value: string, expected: string, message: string): void {
  if (!value.includes(expected)) {
    throw new Error(`${message}: expected source to include ${expected}`);
  }
}

function assertNotIncludes(value: string, unexpected: string, message: string): void {
  if (value.includes(unexpected)) {
    throw new Error(`${message}: expected source not to include ${unexpected}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}
