import { BRAND } from "@/lib/brand";
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
  const usesInferredEvidence = Object.values(evidence.source).some((source) => source === "category" || source === "area");

  return (
    <section className="mt-5 rounded-2xl border border-white/60 bg-background/50 p-4 shadow-[0_5px_18px_rgba(36,34,31,0.04)] backdrop-blur-lg" aria-labelledby="place-fit-heading">
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
              stroke={BRAND.border}
              strokeWidth="1"
            />
          ))}
          {RADAR_AXES.map((axis, index) => {
            const [x, y] = point(index, 1);
            const [labelX, labelY] = point(index, 1.27);
            return (
              <g key={axis.key} opacity={0.4 + evidence.confidence[axis.key] * 0.6}>
                <line x1="100" y1="90" x2={x} y2={y} stroke={BRAND.border} strokeWidth="1" />
                <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill={BRAND.muted} fontFamily="Inter">
                  {axis.high}
                </text>
              </g>
            );
          })}
          {taste && <polygon points={polygon(taste)} fill={`${BRAND.primary}24`} stroke={BRAND.primary} strokeWidth="2.5" />}
          <polygon
            points={polygon(evidence.values)}
            fill={`${BRAND.text}0A`}
            stroke={BRAND.text}
            strokeWidth="2"
            strokeDasharray={usesInferredEvidence ? "5 4" : undefined}
          />
        </svg>
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
