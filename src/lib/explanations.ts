import type { HexTimeMetric } from "@/types/data";

export function qualitative(value: number): "Low" | "Moderate" | "High" {
  if (value >= 0.67) return "High";
  if (value >= 0.34) return "Moderate";
  return "Low";
}

export function confidenceLabel(value: number): "Low" | "Medium" | "High" {
  if (value >= 0.75) return "High";
  if (value >= 0.45) return "Medium";
  return "Low";
}

export function areaExplanation(metric: HexTimeMetric): string[] {
  const candidates = [
    { score: metric.activity, label: "Strong typical activity at this time" },
    { score: metric.localOrientation, label: "A relatively strong local-orientation signal" },
    { score: 1 - metric.visitorPressure, label: "Lower modeled visitor pressure" },
    { score: metric.confidence, label: "Stronger supporting evidence than nearby areas" },
  ];
  return candidates
    .filter((item) => item.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.label);
}
