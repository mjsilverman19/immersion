import SavePlaceButton from "./SavePlaceButton";

interface AlignmentPlaceCardProps {
  placeId: string;
  name: string;
  neighborhood: string | null;
  category: string;
  rating: number;
  review: string | null;
  sourceUserName: string;
  sourceUserId: string;
  initialSaved: boolean;
}

function RatingHearts({ filled }: { filled: number }) {
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill={i < filled ? "#6B6E8A" : "none"}
          stroke={i < filled ? "#6B6E8A" : "#F0ECE6"}
          strokeWidth={i < filled ? 0 : 2}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ))}
    </div>
  );
}

export default function AlignmentPlaceCard({
  placeId,
  name,
  neighborhood,
  category,
  rating,
  review,
  sourceUserName,
  sourceUserId,
  initialSaved,
}: AlignmentPlaceCardProps) {
  const meta = [neighborhood, category].filter(Boolean).join(" · ");

  return (
    <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4">
      {/* Name + rating row */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-serif text-[17px] text-ink leading-tight">{name}</p>
        <RatingHearts filled={rating} />
      </div>

      {/* Metadata */}
      {meta && (
        <p className="text-[13px] text-ink-light mt-1 leading-tight">{meta}</p>
      )}

      {/* Review excerpt */}
      {review && (
        <p className="text-sm text-ink mt-2 italic leading-relaxed line-clamp-2">
          &ldquo;{review}&rdquo;
        </p>
      )}

      {/* Bottom row: attribution + save */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="#6B6E8A" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="text-xs text-ink-light">From {sourceUserName}&apos;s map</span>
        </div>
        <SavePlaceButton
          placeId={placeId}
          sourceUserId={sourceUserId}
          initialSaved={initialSaved}
        />
      </div>
    </div>
  );
}
