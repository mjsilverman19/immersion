import Link from "next/link";
import type { Place } from "@/lib/types/database";
import RatingStars from "./RatingStars";

interface PlaceCardProps {
  place: Place;
  averageRating?: number;
  logCount?: number;
}

export default function PlaceCard({ place, averageRating, logCount }: PlaceCardProps) {
  return (
    <Link href={`/place/${place.id}`} className="block">
      <div className="rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium">{place.name}</h3>
            {place.address && (
              <p className="mt-0.5 text-sm text-gray-500">{place.address}</p>
            )}
            <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {place.category}
            </span>
          </div>
          {averageRating !== undefined && (
            <div className="text-right">
              <RatingStars rating={Math.round(averageRating)} size="sm" />
              {logCount !== undefined && (
                <p className="mt-0.5 text-xs text-gray-500">{logCount} logs</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
