import { useMemo, useState } from "react";

import type { RadarEvidence, RadarProfile, TasteDimensionKey, TasteProfile } from "@/types/data";

const AXES: Array<{ key: TasteDimensionKey; label: string }> = [
  { key: "energy", label: "Lively" },
  { key: "formality", label: "Planned" },
  { key: "neighborhoodOrientation", label: "Neighborhood" },
  { key: "wandering", label: "Wandering" },
  { key: "novelty", label: "Unexpected" },
];

const SOURCE_COPY = { venue: "venue evidence", category: "venue category", area: "area context", unknown: "limited evidence" } as const;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function userRadar(profile: TasteProfile): RadarProfile {
  return {
    energy: clamp01((profile.energy + 1) / 2), novelty: clamp01((profile.novelty + 1) / 2),
    wandering: clamp01((profile.wandering + 1) / 2), formality: clamp01((profile.formality + 1) / 2),
    neighborhoodOrientation: clamp01((profile.neighborhoodOrientation + 1) / 2),
  };
}

function point(index: number, value: number, radius = 57): [number, number] {
  const angle = -Math.PI / 2 + index * (Math.PI * 2 / AXES.length);
  return [80 + Math.cos(angle) * radius * value, 78 + Math.sin(angle) * radius * value];
}

function polygon(profile: RadarProfile): string {
  return AXES.map((axis, index) => point(index, profile[axis.key]).join(",")).join(" ");
}

export function TasteRadar({ tasteProfile, evidence }: { tasteProfile: TasteProfile | null; evidence: RadarEvidence }) {
  const [expanded, setExpanded] = useState(false);
  const taste = tasteProfile ? userRadar(tasteProfile) : null;
  const comparison = useMemo(() => {
    if (!taste) return null;
    const rows = AXES.map((axis) => ({ ...axis, fit: 1 - Math.abs(taste[axis.key] - evidence.values[axis.key]), difference: evidence.values[axis.key] - taste[axis.key] }));
    const strongest = [...rows].sort((a, b) => b.fit - a.fit)[0];
    const tradeoff = [...rows].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))[0];
    return { strongest, tradeoff };
  }, [evidence.values, taste]);
  const takeaway = comparison
    ? `Strongest overlap: ${comparison.strongest.label.toLowerCase()}. ${Math.abs(comparison.tradeoff.difference) > 0.22 ? `Tradeoff: this place is ${comparison.tradeoff.difference > 0 ? "more" : "less"} ${comparison.tradeoff.label.toLowerCase()} than your usual preference.` : "The remaining dimensions are relatively close to your taste."}`
    : "Shape your map to compare this place with your taste.";

  return <div className="mt-4 rounded-2xl border border-border bg-card p-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">Taste fit preview</p><p className="mt-1 text-[10px] text-muted-foreground"><span className="text-primary">Rust = your taste</span> · Ink = this place</p></div><button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="text-[11px] font-medium underline underline-offset-4">{expanded ? "Less" : "Expand"}</button></div>
    <div className="mt-2 flex items-center gap-3">
      <svg viewBox="0 0 160 156" className="h-36 w-36 shrink-0" role="img" aria-label={takeaway}>
        {[0.33, 0.66, 1].map((level) => <polygon key={level} points={polygon({ energy: level, novelty: level, wandering: level, formality: level, neighborhoodOrientation: level })} fill="none" stroke="#D8D1C7" strokeWidth="1" />)}
        {AXES.map((axis, index) => {
          const [x, y] = point(index, 1);
          const [lx, ly] = point(index, 1.24);
          return <g key={axis.key} opacity={0.35 + evidence.confidence[axis.key] * 0.65}><line x1="80" y1="78" x2={x} y2={y} stroke="#B9B0A5" strokeWidth="1" /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#665F58">{axis.label}</text></g>;
        })}
        {taste && <polygon points={polygon(taste)} fill="rgba(196,93,62,0.14)" stroke="#C45D3E" strokeWidth="2" />}
        <polygon points={polygon(evidence.values)} fill="rgba(26,26,26,0.03)" stroke="#1A1A1A" strokeWidth="1.6" strokeDasharray={Object.values(evidence.source).some((source) => source === "category" || source === "area") ? "4 3" : undefined} />
      </svg>
      <p className="text-xs leading-relaxed text-muted-foreground">{takeaway}</p>
    </div>
    {expanded && <div className="mt-3 border-t border-border pt-3"><p className="text-[10px] leading-relaxed text-muted-foreground">Dotted place lines indicate dimensions inferred from category or area context. Faded axes have lower evidence confidence.</p><ul className="mt-2 space-y-1.5 text-[10px]">{AXES.map((axis) => <li key={axis.key} className="flex justify-between gap-3"><span>{axis.label}</span><span className="text-right text-muted-foreground">{SOURCE_COPY[evidence.source[axis.key]]} · {evidence.confidence[axis.key] >= 0.7 ? "strong" : evidence.confidence[axis.key] >= 0.4 ? "moderate" : "limited"}</span></li>)}</ul></div>}
  </div>;
}
