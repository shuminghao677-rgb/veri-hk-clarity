import type { VerificationMode } from "./report-contract";

export const VERIFICATION_MODES: Array<{
  value: VerificationMode;
  label: string;
  description: string;
}> = [
  {
    value: "auto",
    label: "Auto Detect",
    description: "Let VeriHK route each claim to the right official source.",
  },
  {
    value: "weather",
    label: "Weather",
    description: "Use Hong Kong Observatory sources for weather claims.",
  },
  {
    value: "traffic",
    label: "Traffic",
    description: "Use Transport Department sources for traffic claims.",
  },
];

export function normalizeVerificationMode(value: unknown): VerificationMode {
  return value === "weather" || value === "traffic" || value === "auto" ? value : "auto";
}

export function getVerificationModeMismatchMessage(
  text: string,
  mode: VerificationMode,
): string | null {
  if (mode === "auto") return null;

  const normalized = normalizeText(text);
  const weatherLike = isWeatherLike(normalized);
  const trafficLike = isTrafficLike(normalized);

  if (mode === "weather" && trafficLike && !weatherLike) {
    return "This appears to be a traffic claim. Please switch to Traffic mode or Auto Detect.";
  }

  if (mode === "traffic" && weatherLike && !trafficLike) {
    return "This appears to be a weather claim. Please switch to Weather mode or Auto Detect.";
  }

  return null;
}

export function getModeLabel(mode: VerificationMode): string {
  return VERIFICATION_MODES.find((item) => item.value === mode)?.label ?? "Auto Detect";
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function isWeatherLike(normalized: string): boolean {
  return /\b(weather|rain|rainstorm|typhoon|cyclone|monsoon|thunderstorm|observatory|hko|temperature|degrees|forecast|visibility|lightning|wind|humidity|hot|cold)\b/.test(
    normalized,
  );
}

function isTrafficLike(normalized: string): boolean {
  return /\b(road|rd|street|lane|lanes|traffic|closure|closed|diversion|tunnel|highway|carriageway|motorist|vehicle|reopen|re-open|congestion|busy|transport department|mtr|bus|tram|ferry|minibus|route|public transport)\b/.test(
    normalized,
  );
}
