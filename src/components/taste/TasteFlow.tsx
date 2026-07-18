import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";

import { tasteProfileFromAnswers } from "@/lib/tasteProfile";
import type { TasteDimensionKey, TasteProfile } from "@/types/data";

interface Question { dimension: TasteDimensionKey; prompt: string; negative: string; positive: string }

const QUESTIONS: Question[] = [
  { dimension: "energy", prompt: "Which room draws you in?", negative: "Small, intimate, and unhurried", positive: "Lively, social, and full of movement" },
  { dimension: "novelty", prompt: "Which recommendation sounds better?", negative: "A New York institution that still deserves its reputation", positive: "Somewhere you probably would not find without being told" },
  { dimension: "wandering", prompt: "How would you rather spend an afternoon?", negative: "One place worth crossing town for", positive: "Several stops with room to wander" },
  { dimension: "formality", prompt: "Which plan feels more like you?", negative: "Decide when you arrive", positive: "Book the place and plan around it" },
  { dimension: "neighborhoodOrientation", prompt: "Which New York are you looking for?", negative: "The icons when they are genuinely worth it", positive: "The version that feels closer to neighborhood life" },
];

function learnedCopy(dimension: TasteDimensionKey, value: number | undefined): string {
  if (value === undefined) return "No strong preference added for this dimension yet.";
  if (value === 0) return "Keeping both sides of this choice open on your map.";
  const copy: Record<TasteDimensionKey, [string, string]> = {
    energy: ["Quieter places are beginning to stand out.", "Livelier places are gaining emphasis."],
    novelty: ["New York institutions are gaining emphasis.", "More unexpected finds are beginning to surface."],
    wandering: ["Destination-worthy places are gaining emphasis.", "Areas with several worthwhile stops are gaining emphasis."],
    formality: ["Your map is becoming more informal and spontaneous.", "Planned occasions are gaining emphasis."],
    neighborhoodOrientation: ["Iconic New York remains welcome on your map.", "Neighborhood-oriented areas are gaining emphasis."],
  };
  return value < 0 ? copy[dimension][0] : copy[dimension][1];
}

interface TasteFlowProps {
  open: boolean;
  surfacedVenues: string[];
  onClose: () => void;
  onPreview: (profile: TasteProfile, message: string) => void;
  onComplete: (profile: TasteProfile) => void;
}

export function TasteFlow({ open, surfacedVenues, onClose, onPreview, onComplete }: TasteFlowProps) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<TasteDimensionKey, number>>>({});
  const [learningMessage, setLearningMessage] = useState("Your first choice will begin reshaping the map.");
  const flips = useMemo(() => QUESTIONS.map(() => Math.random() >= 0.5), [open]);
  useEffect(() => {
    if (!open) { setStarted(false); setIndex(0); setAnswers({}); setLearningMessage("Your first choice will begin reshaping the map."); }
  }, [open]);
  if (!open) return null;
  const question = QUESTIONS[index];
  const choices = flips[index]
    ? [{ label: question.positive, value: 1 }, { label: question.negative, value: -1 }]
    : [{ label: question.negative, value: -1 }, { label: question.positive, value: 1 }];

  const answer = (value: number | undefined) => {
    const next = { ...answers };
    if (value === undefined) delete next[question.dimension];
    else next[question.dimension] = value;
    const message = learnedCopy(question.dimension, value);
    setAnswers(next);
    setLearningMessage(message);
    if (index < QUESTIONS.length - 1) {
      onPreview(tasteProfileFromAnswers(next), message);
      setIndex(index + 1);
      return;
    }
    onComplete(tasteProfileFromAnswers(next, true));
  };

  return <div className="pointer-events-none absolute inset-0 z-[100] flex items-end justify-center bg-foreground/5 p-3 md:items-center md:justify-end md:p-5">
    <section role="dialog" aria-modal="true" aria-labelledby="taste-question" className="pointer-events-auto relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[28px] border border-border bg-background/94 p-5 shadow-2xl backdrop-blur md:p-6">
      {!started ? <>
        <button type="button" onClick={onClose} aria-label="Close taste questions" className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">Shape my map</p>
        <h2 id="taste-question" className="mt-3 font-serif text-3xl leading-tight">Five quick choices.</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Watch New York change as we learn what draws you in. Each answer applies now and can be changed later.</p>
        <button type="button" onClick={() => setStarted(true)} className="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Begin</button>
      </> : <>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => index ? setIndex(index - 1) : setStarted(false)} aria-label={index ? "Previous question" : "Quiz introduction"} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Shape my map · {index + 1} of {QUESTIONS.length}</p>
          <button type="button" onClick={onClose} aria-label="Close taste questions" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <h2 id="taste-question" className="mx-auto mt-5 max-w-sm text-center font-serif text-3xl leading-tight">{question.prompt}</h2>
        <div className="mt-5 grid gap-2">
          {choices.map((choice) => <button key={choice.value} type="button" onClick={() => answer(choice.value)} className="min-h-20 rounded-2xl border border-border bg-card px-4 py-4 text-left font-serif text-lg leading-snug shadow-sm transition hover:border-primary hover:shadow-md">{choice.label}</button>)}
        </div>
        <div className="mt-4 flex justify-center gap-5 text-sm"><button type="button" onClick={() => answer(0)} className="text-foreground underline-offset-4 hover:underline">Both</button><button type="button" onClick={() => answer(undefined)} className="text-muted-foreground underline-offset-4 hover:underline">Skip</button></div>
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">Learning your map</p>
          <p className="mt-1 text-sm">{learningMessage}</p>
          {!!surfacedVenues.length && <p className="mt-2 text-[11px] text-muted-foreground">Beginning to surface: {surfacedVenues.slice(0, 2).join(" · ")}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"><span className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Applied now</span><span className="flex items-center gap-1"><Check className="h-3 w-3 text-primary" /> Remembered for future maps</span></div>
        </div>
        <div className="mt-5 flex gap-1">{QUESTIONS.map((item, step) => <span key={item.dimension} className={`h-1 flex-1 rounded-full ${step <= index ? "bg-primary" : "bg-muted"}`} />)}</div>
      </>}
    </section>
  </div>;
}
