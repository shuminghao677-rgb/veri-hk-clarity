import { describe, expect, it } from "vitest";
import {
  getVerificationModeMismatchMessage,
  normalizeVerificationMode,
} from "./verification-mode";

describe("verification mode UX guard", () => {
  it("blocks obvious traffic claims in Weather mode", () => {
    expect(
      getVerificationModeMismatchMessage(
        "Part of the lanes of Princess Margaret Road are closed.",
        "weather",
      ),
    ).toBe("This appears to be a traffic claim. Please switch to Traffic mode or Auto Detect.");
  });

  it("blocks obvious weather claims in Traffic mode", () => {
    expect(
      getVerificationModeMismatchMessage(
        "The Hong Kong Observatory has issued a Thunderstorm Warning.",
        "traffic",
      ),
    ).toBe("This appears to be a weather claim. Please switch to Weather mode or Auto Detect.");
  });

  it("keeps Auto Detect unchanged", () => {
    expect(
      getVerificationModeMismatchMessage(
        "The Hong Kong Observatory has issued a Thunderstorm Warning.",
        "auto",
      ),
    ).toBeNull();
  });

  it("normalizes unknown stored values to Auto Detect", () => {
    expect(normalizeVerificationMode("unknown")).toBe("auto");
  });
});
