import type { RadarEvidence, RadarProfile, TasteDimensionKey, TasteProfile } from "@/types/data";

export const FIT_AXES: Array<{ key: TasteDimensionKey; low: string; high: string }> = [
  { key: "energy", low: "Quiet", high: "Lively" },
  { key: "novelty", low: "Familiar", high: "Unexpected" },
  { key: "wandering", low: "One destination", high: "Wandering" },
  { key: "formality", low: "Informal", high: "Planned" },
  { key: "neighborhoodOrientation", low: "Destination-led", high: "Neighborhood" },
];

const RADAR_AXES = [FIT_AXES[0], FIT_AXES[3], FIT_AXES[4], FIT_AXES[2], FIT_AXES[1]];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function tasteRadarProfile(profile: TasteProfile): RadarProfile {
  return {
    energy: clamp01((profile.energy + 1) / 2),
    novelty: clamp01((profile.novelty + 1) / 2),
    wandering: clamp01((profile.wandering + 1) / 2),
    formality: clamp01((profile.formality + 1) / 2),
    neighborhoodOrientation: clamp01((profile.neighborhoodOrientation + 1) / 2),
  };
}

export function fitDimensionRows(profile: TasteProfile | null, evidence: RadarEvidence) {
  const taste = profile ? tasteRadarProfile(profile) : null;
  return FIT_AXES.map((axis) => ({
    ...axis,
    tasteValue: taste?.[axis.key] ?? null,
    placeValue: clamp01(evidence.values[axis.key]),
    confidence: clamp01(evidence.confidence[axis.key]),
  }));
}

export function evidenceConfidenceLabel(evidence: RadarEvidence): "Strong evidence" | "Some evidence" | "Limited evidence" {
  const values = Object.values(evidence.confidence);
  const confidence = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (confidence >= 0.7) return "Strong evidence";
  if (confidence >= 0.4) return "Some evidence";
  return "Limited evidence";
}

function point(index: number, value: number, radius = 66): [number, number] {
  const angle = -Math.PI / 2 + index * (Math.PI * 2 / RADAR_AXES.length);
  return [100 + Math.cos(angle) * radius * value, 90 + Math.sin(angle) * radius * value];
}

function polygon(profile: RadarProfile): string {
  return RADAR_AXES.map((axis, index) => point(index, profile[axis.key]).join(",")).join(" ");
}

export function TasteRadar({
  tasteProfile,
  evidence,
  onShapeTaste,
}: {
  tasteProfile: TasteProfile | null;
  evidence: RadarEvidence;
  onShapeTaste: () => void;
}) {
  const taste = tasteProfile ? tasteRadarProfile(tasteProfile) : null;
  const rows = fitDimensionRows(tasteProfile, evidence);
  const usesInferredEvidence = Object.values(evidence.source).some((source) => source === "category" || source === "area");

  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-4" aria-labelledby="place-fit-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p id="place-fit-heading" className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {taste ? "Taste fit" : "Place character"}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
            {taste && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Your taste</span>}
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 bg-foreground" />This place</span>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-medium text-muted-foreground">
          {evidenceConfidenceLabel(evidence)}
        </span>
      </div>

      <div className="mt-1 flex justify-center">
        <svg
          viewBox="0 0 200 188"
          className="h-44 w-full max-w-[230px]"
          role="img"
          aria-label={taste ? "Radar comparison of your taste and this place" : "Radar showing this place's character"}
        >
          {[0.33, 0.66, 1].map((level) => (
            <polygon
              key={level}
              points={polygon({ energy: level, novelty: level, wandering: level, formality: level, neighborhoodOrientation: level })}
              fill="none"
              stroke="#D8D1C7"
              strokeWidth="1"
            />
          ))}
          {RADAR_AXES.map((axis, index) => {
            const [x, y] = point(index, 1);
            const [labelX, labelY] = point(index, 1.27);
            return (
              <g key={axis.key} opacity={0.4 + evidence.confidence[axis.key] * 0.6}>
                <line x1="100" y1="90" x2={x} y2={y} stroke="#B9B0A5" strokeWidth="1" />
                <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#665F58">
                  {axis.high}
                </text>
              </g>
            );
          })}
          {taste && <polygon points={polygon(taste)} fill="rgba(196,93,62,0.14)" stroke="#C45D3E" strokeWidth="2.5" />}
          <polygon
            points={polygon(evidence.values)}
            fill="rgba(26,26,26,0.04)"
            stroke="#1A1A1A"
            strokeWidth="2"
            strokeDasharray={usesInferredEvidence ? "5 4" : undefined}
          />
        </svg>
      </div>

      <div className="space-y-3 border-t border-border/80 pt-4">
        {rows.map((row) => (
          <div
            key={row.key}
            style={{ opacity: 0.45 + row.confidence * 0.55 }}
            aria-label={`${row.low} to ${row.high}: this place ${Math.round(row.placeValue * 100)} percent${row.tasteValue === null ? "" : `, your taste ${Math.round(row.tasteValue * 100)} percent`}`}
          >
            <div className="mb-1.5 flex justify-between gap-3 text-[9px] text-muted-foreground">
              <span>{row.low}</span><span className="text-right">{row.high}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-muted">
              <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-card bg-foreground shadow-sm"
                style={{ left: `${row.placeValue * 100}%` }}
              />
              {row.tasteValue !== null && (
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-sm"
                  style={{ left: `${row.tasteValue * 100}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {!taste && (
        <button
          type="button"
          onClick={onShapeTaste}
          className="mt-4 w-full rounded-full border border-primary/30 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5"
        >
          Shape my map to compare
        </button>
      )}
    </section>
  );
}
