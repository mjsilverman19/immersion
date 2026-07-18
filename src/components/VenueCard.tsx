import { useEffect, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { ChevronUp, Heart, Navigation } from "lucide-react";

import type { Venue } from "@/lib/venues";
import {
  categoryLine,
  DAY_LABELS,
  directionsUrl,
  distanceLine,
  formatDay,
  haversineMiles,
  hoursStatus,
  mondayIndex,
  temporalBars,
} from "@/lib/venueCard";
import { cn } from "@/lib/utils";

interface VenueCardProps {
  venue: Venue | null;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
}

/** Snap points: a decision-ready peek, and the full expanded sheet. */
const PEEK = "184px";
const FULL = 0.9;

/**
 * The bottom-sheet venue card — the app's primary surface. Springs up on a pin
 * tap (collapsed peek), expands to the full read. All content is mounted at
 * once, so expanding is a pure transform: no remount, no layout shift.
 */
export const VenueCard = ({ venue, onClose, userLocation }: VenueCardProps) => {
  const [snap, setSnap] = useState<number | string | null>(PEEK);

  // Every fresh pin tap re-opens at the peek.
  useEffect(() => {
    if (venue) setSnap(PEEK);
  }, [venue?.id]);

  const expanded = snap === FULL;
  const toggle = () => setSnap(expanded ? PEEK : FULL);

  return (
    <DrawerPrimitive.Root
      open={venue !== null}
      onOpenChange={(o) => !o && onClose()}
      snapPoints={[PEEK, FULL]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      fadeFromIndex={1}
      modal={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-[1150] bg-black/25" />
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-[1200] mx-auto flex h-full max-h-[90dvh] max-w-lg flex-col",
            "rounded-t-2xl border border-border bg-card text-card-foreground shadow-[0_-8px_40px_rgba(0,0,0,0.14)]",
            "outline-none",
          )}
        >
          {venue && (
            <VenueCardBody
              venue={venue}
              expanded={expanded}
              onToggle={toggle}
              userLocation={userLocation}
            />
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
};

interface BodyProps {
  venue: Venue;
  expanded: boolean;
  onToggle: () => void;
  userLocation: { lat: number; lng: number } | null;
}

const VenueCardBody = ({ venue, expanded, onToggle, userLocation }: BodyProps) => {
  const status = hoursStatus(venue.hours);
  const bars = temporalBars(venue.temporal_signature);
  const miles = userLocation ? haversineMiles(userLocation, venue) : null;
  const todayIdx = mondayIndex(new Date().getDay());

  return (
    <>
      {/* grabber */}
      <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" />

      {/* Collapsed header — always visible. Tapping it toggles the sheet. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex shrink-0 items-start gap-3 px-5 pb-4 pt-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <DrawerPrimitive.Title className="truncate font-serif text-[26px] leading-tight text-foreground">
            {venue.name}
          </DrawerPrimitive.Title>
          <p className="mt-0.5 text-sm text-muted-foreground">{categoryLine(venue)}</p>
          {/* Index line: tracked uppercase ink — rust is reserved for hearts,
              active states, and the activity surface. */}
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {venue.temporal_note} · index {venue.index_score}
          </p>
        </div>
        <ChevronUp
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded body — mounted always; revealed as the sheet grows. */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-5 pb-8">
        {/* Now / distance strip */}
        {(status || miles !== null) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-4 text-sm">
            {status && (
              <span
                className={cn(
                  "font-medium",
                  status.openNow ? "text-primary" : "text-muted-foreground",
                )}
              >
                {status.line}
              </span>
            )}
            {status && miles !== null && <span className="text-muted-foreground/50">·</span>}
            {miles !== null && (
              <span className="text-muted-foreground">{distanceLine(miles)}</span>
            )}
          </div>
        )}

        {/* Engine's factual note — one honest, lowercase, data-derived line. */}
        {venue.factual_note && (
          <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
            {venue.factual_note}
          </p>
        )}

        {/* When locals are around — the hex temporal signature. */}
        <section className="mt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            when locals are around
          </h3>
          <div className="mt-3 flex items-end gap-3">
            {bars.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-16 w-full items-end justify-center">
                  <div
                    className="w-6 rounded-t-sm bg-primary/85"
                    style={{ height: `${Math.max(6, b.height * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] tracking-wide text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Hours for the week. */}
        {venue.hours && (
          <section className="mt-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              hours
            </h3>
            <dl className="mt-2.5 space-y-1">
              {venue.hours.map((ranges, i) => (
                <div
                  key={DAY_LABELS[i]}
                  className={cn(
                    "flex justify-between text-sm",
                    i === todayIdx ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <dt className="w-10">{DAY_LABELS[i]}</dt>
                  <dd className="flex-1 text-right tabular-nums">{formatDay(ranges)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Phase-2 slot: the human layer. Deliberately empty, visually distinct,
            so the dual-signal stack (index + people) is designed for now. */}
        <section className="mt-6">
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-4">
            <Heart className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <p className="text-[13px] leading-snug text-muted-foreground/70">
              hearts and notes from people land here in phase 2
            </p>
          </div>
        </section>

        {/* Route out to the platform's maps app. */}
        <a
          href={directionsUrl(venue)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity active:opacity-80"
        >
          <Navigation className="h-4 w-4" />
          directions
        </a>
      </div>
    </>
  );
};
