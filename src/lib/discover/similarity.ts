import type { LogWithPlaceCategory } from "@/lib/types/queries";

export interface LogData {
  place_id: string;
  rating: number;
  tags: string[];
  vibe_tags: string[];
  place_category: string;
}

/** Map a Supabase log row (with joined places) to LogData */
export function mapLogRow(row: LogWithPlaceCategory): LogData {
  return {
    place_id: row.place_id,
    rating: row.rating,
    tags: row.tags || [],
    vibe_tags: row.vibe_tags || [],
    place_category: row.places?.category || "experience",
  };
}

export function computeSimilarity(
  userALogs: LogData[],
  userBLogs: LogData[]
): number {
  // Find shared places
  const bByPlace = new Map<string, LogData>();
  userBLogs.forEach((l) => bByPlace.set(l.place_id, l));

  const sharedPlaces: { a: LogData; b: LogData }[] = [];
  userALogs.forEach((a) => {
    const b = bByPlace.get(a.place_id);
    if (b) sharedPlaces.push({ a, b });
  });

  // Tag overlap (Jaccard) — prefer vibe_tags, fall back to tags
  const getEffectiveTags = (l: LogData) =>
    l.vibe_tags.length > 0 ? l.vibe_tags : l.tags;
  const aTags = new Set(userALogs.flatMap(getEffectiveTags));
  const bTags = new Set(userBLogs.flatMap(getEffectiveTags));
  const tagIntersection = new Set([...aTags].filter((t) => bTags.has(t)));
  const tagUnion = new Set([...aTags, ...bTags]);
  const tagSim = tagUnion.size > 0 ? tagIntersection.size / tagUnion.size : 0;

  // Category similarity (cosine)
  const aCats: Record<string, number> = {};
  const bCats: Record<string, number> = {};
  userALogs.forEach((l) => {
    aCats[l.place_category] = (aCats[l.place_category] || 0) + 1;
  });
  userBLogs.forEach((l) => {
    bCats[l.place_category] = (bCats[l.place_category] || 0) + 1;
  });

  const allCats = new Set([...Object.keys(aCats), ...Object.keys(bCats)]);
  let dot = 0,
    magA = 0,
    magB = 0;
  allCats.forEach((c) => {
    const a = aCats[c] || 0;
    const b = bCats[c] || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  });
  const catSim =
    magA > 0 && magB > 0 ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;

  if (sharedPlaces.length >= 3) {
    // Rating correlation (Pearson)
    const n = sharedPlaces.length;
    const aRatings = sharedPlaces.map((s) => s.a.rating);
    const bRatings = sharedPlaces.map((s) => s.b.rating);
    const meanA = aRatings.reduce((s, v) => s + v, 0) / n;
    const meanB = bRatings.reduce((s, v) => s + v, 0) / n;
    let num = 0,
      denA = 0,
      denB = 0;
    for (let i = 0; i < n; i++) {
      const da = aRatings[i] - meanA;
      const db = bRatings[i] - meanB;
      num += da * db;
      denA += da * da;
      denB += db * db;
    }
    const corr =
      denA > 0 && denB > 0 ? num / (Math.sqrt(denA) * Math.sqrt(denB)) : 0;
    const normCorr = (corr + 1) / 2; // 0 to 1

    return normCorr * 0.5 + tagSim * 0.3 + catSim * 0.2;
  }

  return tagSim * 0.6 + catSim * 0.4;
}
