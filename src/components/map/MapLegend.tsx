import type { MapLayer } from "@/types/data";

const COPY: Record<MapLayer, { low: string; high: string; gradient: string }> = {
  immersion: { low: "Quieter", high: "More relevant", gradient: "from-[#F1E7DB] to-[#B94F32]" },
  activity: { low: "Lower", high: "Higher", gradient: "from-[#F1E7DB] to-[#B94F32]" },
  localOrientation: { low: "Lower", high: "Higher", gradient: "from-[#F0EADD] to-[#687B62]" },
  visitorPressure: { low: "Lower", high: "Higher", gradient: "from-[#E8E6EA] to-[#6B6E8A]" },
  confidence: { low: "Thinner evidence", high: "Stronger evidence", gradient: "from-[#DED8CE] to-[#30302E]" },
};

export function MapLegend({ layer }: { layer: MapLayer }) {
  const copy = COPY[layer];
  return (
    <div className="rounded-xl border border-border bg-background/88 px-3 py-2 shadow-sm backdrop-blur">
      <div className={`h-1.5 w-36 rounded-full bg-gradient-to-r ${copy.gradient}`} />
      <div className="mt-1 flex justify-between gap-4 text-[9px] uppercase text-muted-foreground">
        <span>{copy.low}</span><span>{copy.high}</span>
      </div>
    </div>
  );
}
