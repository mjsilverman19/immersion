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

export function mergeParallelStreetSegments(candidates: StreetSegmentCandidate[]): StreetSegmentCandidate[] {
  const merged: StreetSegmentCandidate[] = [];
  for (const candidate of candidates) {
    const midpoint = [(candidate.start[0] + candidate.end[0]) / 2, (candidate.start[1] + candidate.end[1]) / 2];
    const match = merged.find((existing) => {
      const existingMidpoint = [(existing.start[0] + existing.end[0]) / 2, (existing.start[1] + existing.end[1]) / 2];
      return distanceMeters(midpoint, existingMidpoint) <= 22
        && angleDistance(segmentAngle(candidate), segmentAngle(existing)) <= Math.PI / 15;
    });
    if (!match) {
      merged.push({ ...candidate });
      continue;
    }

    const direct = distanceMeters(match.start, candidate.start) + distanceMeters(match.end, candidate.end);
    const reverse = distanceMeters(match.start, candidate.end) + distanceMeters(match.end, candidate.start);
    const alignedStart = direct <= reverse ? candidate.start : candidate.end;
    const alignedEnd = direct <= reverse ? candidate.end : candidate.start;
    const count = match.mergedCount;
    match.start = match.start.map((value, index) => (value * count + alignedStart[index]) / (count + 1));
    match.end = match.end.map((value, index) => (value * count + alignedEnd[index]) / (count + 1));
    match.strength = Math.max(match.strength, candidate.strength);
    match.confidence = Math.max(match.confidence, candidate.confidence);
    match.mergedCount += 1;
  }
  return merged;
}
