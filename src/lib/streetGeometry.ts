export interface StreetSegmentCandidate {
  start: number[];
  end: number[];
  strength: number;
  confidence: number;
  roadClass: unknown;
  mergedCount: number;
}

function distanceMeters(a: number[], b: number[]): number {
  const latitude = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const dx = (a[0] - b[0]) * 111_320 * Math.cos(latitude);
  const dy = (a[1] - b[1]) * 111_320;
  return Math.hypot(dx, dy);
}

function segmentAngle(segment: Pick<StreetSegmentCandidate, "start" | "end">): number {
  const latitude = ((segment.start[1] + segment.end[1]) / 2) * Math.PI / 180;
  return Math.atan2(
    (segment.end[1] - segment.start[1]) * 111_320,
    (segment.end[0] - segment.start[0]) * 111_320 * Math.cos(latitude),
  );
}

function angleDistance(a: number, b: number): number {
  const difference = Math.abs(a - b) % Math.PI;
  return Math.min(difference, Math.PI - difference);
}

// Bucket size must exceed the 22m match radius so a 3×3 bucket neighborhood
// always covers every possible match (≈25m lat / ≈33m lon at NYC latitudes).
const MERGE_BUCKET_DEGREES = 0.0003;

export function mergeParallelStreetSegments(candidates: StreetSegmentCandidate[]): StreetSegmentCandidate[] {
  const merged: StreetSegmentCandidate[] = [];
  const buckets = new Map<string, { segment: StreetSegmentCandidate; order: number }[]>();
  for (const candidate of candidates) {
    const midpoint = [(candidate.start[0] + candidate.end[0]) / 2, (candidate.start[1] + candidate.end[1]) / 2];
    const angle = segmentAngle(candidate);
    const gridX = Math.floor(midpoint[0] / MERGE_BUCKET_DEGREES);
    const gridY = Math.floor(midpoint[1] / MERGE_BUCKET_DEGREES);
    let match: { segment: StreetSegmentCandidate; order: number } | null = null;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const entry of buckets.get(`${gridX + dx}:${gridY + dy}`) ?? []) {
          if (match && entry.order >= match.order) continue;
          const existingMidpoint = [(entry.segment.start[0] + entry.segment.end[0]) / 2, (entry.segment.start[1] + entry.segment.end[1]) / 2];
          if (distanceMeters(midpoint, existingMidpoint) <= 22
            && angleDistance(angle, segmentAngle(entry.segment)) <= Math.PI / 15) match = entry;
        }
      }
    }
    if (!match) {
      const copy = { ...candidate };
      merged.push(copy);
      const key = `${gridX}:${gridY}`;
      const bucket = buckets.get(key);
      const entry = { segment: copy, order: merged.length - 1 };
      if (bucket) bucket.push(entry);
      else buckets.set(key, [entry]);
      continue;
    }

    const target = match.segment;
    const direct = distanceMeters(target.start, candidate.start) + distanceMeters(target.end, candidate.end);
    const reverse = distanceMeters(target.start, candidate.end) + distanceMeters(target.end, candidate.start);
    const alignedStart = direct <= reverse ? candidate.start : candidate.end;
    const alignedEnd = direct <= reverse ? candidate.end : candidate.start;
    const count = target.mergedCount;
    target.start = target.start.map((value, index) => (value * count + alignedStart[index]) / (count + 1));
    target.end = target.end.map((value, index) => (value * count + alignedEnd[index]) / (count + 1));
    target.strength = Math.max(target.strength, candidate.strength);
    target.confidence = Math.max(target.confidence, candidate.confidence);
    target.mergedCount += 1;
  }
  return merged;
}
