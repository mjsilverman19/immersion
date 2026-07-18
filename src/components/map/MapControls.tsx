import { Layers3 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MapLayer } from "@/types/data";

const LAYERS: { id: MapLayer; label: string; description: string }[] = [
  { id: "immersion", label: "Immersion", description: "Combined discovery surface" },
  { id: "activity", label: "Activity", description: "Typical discretionary activity" },
  { id: "localOrientation", label: "Local orientation", description: "Locally oriented signal" },
  { id: "visitorPressure", label: "Visitor pressure", description: "Modeled visitor-oriented signal" },
  { id: "confidence", label: "Confidence", description: "Strength of supporting evidence" },
];

interface MapControlsProps {
  layer: MapLayer;
  onChange: (layer: MapLayer) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MapControls({ layer, onChange, open, onOpenChange }: MapControlsProps) {
  const current = LAYERS.find((entry) => entry.id === layer) ?? LAYERS[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border bg-background/92 px-3.5 py-2 text-sm shadow-md backdrop-blur"
      >
        <Layers3 className="h-4 w-4 text-primary" />
        {current.label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-background/95 p-1.5 shadow-xl backdrop-blur">
          {LAYERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                onChange(entry.id);
                onOpenChange(false);
              }}
              className={cn(
                "block w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                entry.id === layer ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <span className="block text-sm font-medium">{entry.label}</span>
              <span className={cn("mt-0.5 block text-[11px]", entry.id === layer ? "text-primary-foreground/75" : "text-muted-foreground")}>
                {entry.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
