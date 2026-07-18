import type { HexDayRecord, HexTimeMetric } from "@/types/data";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function metricAt(record: HexDayRecord, hour: number): HexTimeMetric {
  const index = Math.max(0, Math.min(23, Math.round(hour)));
  const activity = clamp01((record.activity[index] ?? 0) / 100);
  const localOrientation = clamp01((record.localOrientation[index] ?? 0) / 100);
  const visitorPressure = clamp01((record.visitorPressure[index] ?? 0) / 100);
  const activityConfidence = clamp01(record.confidence.activity / 100);
  const localOrientationConfidence = clamp01(record.confidence.localOrientation / 100);
  const visitorPressureConfidence = clamp01(record.confidence.visitorPressure / 100);
  return {
    activity,
    localOrientation,
    visitorPressure,
    activityConfidence,
    localOrientationConfidence,
    visitorPressureConfidence,
    confidence: (activityConfidence + localOrientationConfidence + visitorPressureConfidence) / 3,
  };
}

/** A transparent baseline discovery surface; no user taste is applied here. */
export function baselineImmersion(metric: HexTimeMetric): number {
  const evidence = 0.65 * metric.activity + 0.2 * metric.localOrientation + 0.15 * (1 - metric.visitorPressure);
  return clamp01(evidence * (0.7 + 0.3 * metric.confidence));
}
