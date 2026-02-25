import Link from "next/link";
import RatingHearts from "@/components/place/RatingHearts";

interface LocalFavoriteCardProps {
  place: {
    id: string;
    name: string;
    address: string | null;
    category: string;
    photo_urls: string[] | null;
  };
  averageRating: number;
  topVibeTag: string | null;
}

function formatMeta(address: string | null, category: string): string {
  const parts: string[] = [];
  if (address) {
    // Use the first meaningful segment of the address
    const segment = address.split(",")[0]?.trim();
    if (segment) parts.push(segment);
  }
  parts.push(category.charAt(0).toUpperCase() + category.slice(1).replace("_", " "));
  return parts.join(" · ");
}

export default function LocalFavoriteCard({
  place,
  averageRating,
  topVibeTag,
}: LocalFavoriteCardProps) {
  const photo = place.photo_urls?.[0];

  return (
    <Link href={`/place/${place.id}`} className="block">
      <div className="w-[152px] min-w-[152px] overflow-hidden rounded-xl bg-white shadow-sm">
        {/* Photo */}
        <div className="h-[100px] w-full bg-cream-dark">
          {photo ? (
            <img
              src={photo}
              alt={place.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-ink-light">
              No photo
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-2.5">
          <p className="font-serif text-sm leading-tight text-ink line-clamp-1">
            {place.name}
          </p>
          <p className="mt-1 text-[11px] text-ink-light line-clamp-1">
            {formatMeta(place.address, place.category)}
          </p>
          <div className="mt-1.5">
            <RatingHearts rating={Math.round(averageRating)} size="sm" />
          </div>
          {topVibeTag && (
            <span className="mt-1.5 inline-block whitespace-nowrap rounded-full bg-cream px-2 py-0.5 text-[11px] font-medium text-ink-light">
              {topVibeTag}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
