import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";

import { estimateTotal, MAX_QUESTIONS, nextQuestion, type AskedQuestion } from "@/lib/adaptiveQuiz";
import { tasteProfileFromAnswers } from "@/lib/tasteProfile";
import { profileFromAnswers } from "@/lib/tasteVector";
import type { Intent, TasteAnswer, TasteDimensionKey, TasteProfile, TasteSpace } from "@/types/data";

/** What the dialog needs to render one question, whichever flow produced it. */
interface QuestionView {
  id: string;
  prompt: string;
  negative: string;
  positive: string;
  copy: { negative: string; positive: string; both: string };
}

const SKIP_COPY = "No strong preference added for this dimension yet.";

/** Static fallback flow for datasets without a taste-space artifact: the five
 * anchor questions, one per dimension, exactly the pre-adaptive quiz. */
const LEGACY_QUESTIONS: Array<QuestionView & { dimension: TasteDimensionKey }> = [
  {
    id: "energy", dimension: "energy", prompt: "Which room draws you in?",
    negative: "Small, intimate, and unhurried", positive: "Lively, social, and full of movement",
    copy: { negative: "Quieter places are beginning to stand out.", positive: "Livelier places are gaining emphasis.", both: "Keeping both sides of this choice open on your map." },
  },
  {
    id: "novelty", dimension: "novelty", prompt: "Which recommendation sounds better?",
    negative: "A New York institution that still deserves its reputation", positive: "Somewhere you probably would not find without being told",
    copy: { negative: "New York institutions are gaining emphasis.", positive: "More unexpected finds are beginning to surface.", both: "Keeping both sides of this choice open on your map." },
  },
  {
    id: "wandering", dimension: "wandering", prompt: "How would you rather spend an afternoon?",
    negative: "One place worth crossing town for", positive: "Several stops with room to wander",
    copy: { negative: "Destination-worthy places are gaining emphasis.", positive: "Areas with several worthwhile stops are gaining emphasis.", both: "Keeping both sides of this choice open on your map." },
  },
  {
    id: "formality", dimension: "formality", prompt: "Which plan feels more like you?",
    negative: "Decide when you arrive", positive: "Book the place and plan around it",
    copy: { negative: "Your map is becoming more informal and spontaneous.", positive: "Planned occasions are gaining emphasis.", both: "Keeping both sides of this choice open on your map." },
  },
  {
    id: "neighborhoodOrientation", dimension: "neighborhoodOrientation", prompt: "Which New York are you looking for?",
    negative: "The icons when they are genuinely worth it", positive: "The version that feels closer to neighborhood life",
    copy: { negative: "Iconic New York remains welcome on your map.", positive: "Neighborhood-oriented areas are gaining emphasis.", both: "Keeping both sides of this choice open on your map." },
  },
];

interface TasteFlowProps {
  open: boolean;
  tasteSpace: TasteSpace | null;
  intent: Intent;
  surfacedVenues: string[];
  onClose: () => void;
  onPreview: (profile: TasteProfile, message: string) => void;
  onComplete: (profile: TasteProfile) => void;
}

export function TasteFlow({ open, tasteSpace, intent, onClose, onPreview, onComplete }: TasteFlowProps) {
  const [started, setStarted] = useState(false);
  const [asked, setAsked] = useState<AskedQuestion[]>([]);
  const flips = useMemo(() => Array.from({ length: MAX_QUESTIONS }, () => Math.random() >= 0.5), [open]);
  useEffect(() => {
    if (!open) { setStarted(false); setAsked([]); }
  }, [open]);

  const answers = useMemo(() => {
    const record: Record<string, TasteAnswer> = {};
    for (const item of asked) if (item.answer !== undefined) record[item.questionId] = item.answer;
    return record;
  }, [asked]);

  // The question source is the only difference between the two flows: adaptive
  // greedy selection over the taste space, or the static anchor list.
  const currentAdaptive = useMemo(
    () => (tasteSpace ? nextQuestion(tasteSpace, asked, intent) : null),
    [asked, intent, tasteSpace],
  );
  const estimate = useMemo(
    () => (tasteSpace ? estimateTotal(tasteSpace, asked, intent) : LEGACY_QUESTIONS.length),
    [asked, intent, tasteSpace],
  );
  if (!open) return null;

  const question: QuestionView | null = tasteSpace ? currentAdaptive : LEGACY_QUESTIONS[asked.length] ?? null;
  if (!question) return null;

  const buildProfile = (record: Record<string, TasteAnswer>, completed: boolean): TasteProfile => {
    if (tasteSpace) return profileFromAnswers(record, tasteSpace, completed);
    const byDimension: Partial<Record<TasteDimensionKey, number>> = {};
    for (const legacy of LEGACY_QUESTIONS) {
      if (record[legacy.id] !== undefined) byDimension[legacy.dimension] = record[legacy.id];
    }
    return tasteProfileFromAnswers(byDimension, completed);
  };

  const answer = (value: TasteAnswer | undefined) => {
    const nextAsked = [...asked, { questionId: question.id, answer: value }];
    const nextAnswers = { ...answers };
    if (value === undefined) delete nextAnswers[question.id];
    else nextAnswers[question.id] = value;
    const done = tasteSpace
      ? nextQuestion(tasteSpace, nextAsked, intent) === null
      : nextAsked.length >= LEGACY_QUESTIONS.length;
    if (done) {
      onComplete(buildProfile(nextAnswers, true));
      return;
    }
    const message = value === undefined ? SKIP_COPY : value === 0 ? question.copy.both : value < 0 ? question.copy.negative : question.copy.positive;
    setAsked(nextAsked);
    onPreview(buildProfile(nextAnswers, false), message);
  };

  const flip = flips[asked.length % flips.length];
  const choices = flip
    ? [{ label: question.positive, value: 1 as const }, { label: question.negative, value: -1 as const }]
    : [{ label: question.negative, value: -1 as const }, { label: question.positive, value: 1 as const }];
  const stepLabel = tasteSpace ? `${asked.length + 1} of ~${estimate}` : `${asked.length + 1} of ${LEGACY_QUESTIONS.length}`;
  const totalDots = Math.max(estimate, asked.length + 1);

  return <div className="pointer-events-none absolute inset-0 z-[100] flex items-end justify-center bg-foreground/10 p-2 safe-bottom md:items-center md:justify-end md:p-5">
    <section role="dialog" aria-modal="true" aria-labelledby="taste-question" className="brand-sheet pointer-events-auto relative max-h-[calc(100dvh-1rem)] w-full max-w-md overflow-y-auto rounded-[28px] p-5 md:max-h-[88dvh] md:p-6">
      {!started ? <>
        <button type="button" onClick={onClose} aria-label="Close taste questions" className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        <p className="type-eyebrow text-primary">Shape my map</p>
        <h2 id="taste-question" className="type-headline mt-3">A few quick choices.</h2>
        <p className="type-body mt-2 leading-relaxed text-muted-foreground">Watch New York change as we learn what draws you in. Each answer picks the next question and can be changed later.</p>
        <button type="button" onClick={() => setStarted(true)} className="brand-primary-button mt-6 w-full">Begin</button>
      </> : <>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => asked.length ? setAsked(asked.slice(0, -1)) : setStarted(false)} aria-label={asked.length ? "Previous question" : "Quiz introduction"} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>
          <p className="type-eyebrow text-muted-foreground">Shape my map · {stepLabel}</p>
          <button type="button" onClick={onClose} aria-label="Close taste questions" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <h2 id="taste-question" className="type-headline mx-auto mt-5 max-w-sm text-center">{question.prompt}</h2>
        <div className="mt-5 grid gap-2">
          {choices.map((choice) => <button key={choice.value} type="button" onClick={() => answer(choice.value)} className="type-headline min-h-20 rounded-2xl border border-white/50 bg-background/40 px-4 py-4 text-left transition hover:border-primary/40 hover:bg-background/60">{choice.label}</button>)}
        </div>
        <div className="type-body mt-4 flex justify-center gap-5"><button type="button" onClick={() => answer(0)} className="text-foreground underline-offset-4 hover:underline">Both</button><button type="button" onClick={() => answer(undefined)} className="text-muted-foreground underline-offset-4 hover:underline">Skip</button></div>
        <div className="mt-5 flex gap-1">{Array.from({ length: totalDots }, (_, step) => <span key={step} className={`h-1 flex-1 rounded-full ${step <= asked.length ? "bg-primary" : "bg-muted"}`} />)}</div>
      </>}
    </section>
  </div>;
}
