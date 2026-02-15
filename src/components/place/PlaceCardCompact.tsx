import Link from "next/link";
import RatingStars from "./RatingStars";

interface PlaceCardCompactProps {
  placeId: string;
  name: string;
  cityName?: string | null;
  category: string;
  rating: number;
  review?: string | null;
  photoUrl?: string | null;
}

export default function PlaceCardCompact({
  placeId,
  name,
  cityName,
  category,
  rating,
  review,
  photoUrl,
}: PlaceCardCompactProps) {
  return (
    <Link href={`/place/${placeId}`} className="block">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="aspect-[4/3] w-full overflow-hidden bg-cream-dark">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 text-ink-light/30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
          )}
        </div>
        <div className="p-2.5">
          <p className="text-sm font-medium text-ink truncate">{name}</p>
          {cityName && (
            <p className="text-xs text-ink-light truncate">{cityName}</p>
          )}
          <span className="mt-1 inline-block rounded-full bg-cream-dark px-2 py-0.5 text-[10px] text-ink-light capitalize">
            {category?.replace("_", " ")}
          </span>
          <div className="mt-1.5">
            <RatingStars rating={rating} size="sm" />
          </div>
          {review && (
            <p className="mt-1.5 text-xs text-ink-light line-clamp-2">
              {review}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
