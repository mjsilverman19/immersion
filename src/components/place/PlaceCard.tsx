import Link from "next/link";
import type { Place } from "@/lib/types/database";
import RatingStars from "./RatingStars";

interface PlaceCardProps {
  place: Place;
  averageRating?: number;
  logCount?: number;
}

export default function PlaceCard({ place, averageRating, logCount }: PlaceCardProps) {
  const photos = (place as Record<string, unknown>).photo_urls as string[] | null;

  return (
    <Link href={`/place/${place.id}`} className="block">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="flex gap-3 p-3">
          {photos?.[0] && (
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-cream-dark">
              <img src={photos[0]} alt={place.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-ink truncate">{place.name}</h3>
            {place.address && (
              <p className="mt-0.5 text-sm text-ink-light truncate">{place.address}</p>
            )}
            <span className="mt-1 inline-block rounded-full bg-cream-dark px-2 py-0.5 text-[10px] text-ink-light capitalize">
              {place.category?.replace("_", " ")}
            </span>
          </div>
          {averageRating !== undefined && (
            <div className="flex-shrink-0 text-right">
              <RatingStars rating={Math.round(averageRating)} size="sm" />
              {logCount !== undefined && (
                <p className="mt-0.5 text-xs text-ink-light">{logCount} logs</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
