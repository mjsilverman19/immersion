import { Sparkles, X } from "lucide-react";

import type { SelectedArea, TasteProfile } from "@/types/data";

function traits(profile: TasteProfile): string[] {
  const values = [
    { value: profile.wandering, positive: "Room to wander", negative: "Worth-the-trip destinations" },
    { value: -profile.formality, positive: "Informal places", negative: "Planned occasions" },
    { value: profile.energy, positive: "Lively energy", negative: "Quieter rooms" },
    { value: profile.novelty, positive: "Unexpected finds", negative: "New York institutions" },
  ];
  return values.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3).map((item) => item.value >= 0 ? item.positive : item.negative);
}

export function TasteSummary({ profile, topArea, onClose, onAdjust }: { profile: TasteProfile; topArea?: SelectedArea; onClose: () => void; onAdjust: () => void }) {
  return <div className="brand-surface absolute left-1/2 top-28 z-50 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl p-4 md:top-24">
    <button type="button" onClick={onClose} aria-label="Close taste summary" className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
    <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="type-eyebrow">Your New York</span></div>
    <p className="type-headline mt-2">Your recommendations have been reordered.</p>
    {topArea && <p className="type-body mt-1"><span className="font-medium">{topArea.name}</span> is now your first place to look.</p>}
    <p className="mt-2 text-xs text-muted-foreground">Emphasizing {traits(profile).join(" · ")}</p>
    <p className="mt-3 text-[10px] text-muted-foreground">Applied now ✓ · Remembered for future maps ✓</p>
    <div className="mt-4 flex gap-2"><button type="button" onClick={onClose} className="brand-primary-button min-h-10 px-4 py-2">Explore my map</button><button type="button" onClick={onAdjust} className="type-button min-h-10 rounded-full border border-border px-4 py-2 hover:bg-card">Adjust</button></div>
  </div>;
}
