import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import RatingStars from "@/components/place/RatingStars";

interface FeedItemProps {
  item: {
    type: "log" | "list";
    id: string;
    user: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
    created_at: string;
    // Log fields
    rating?: number;
    tags?: string[];
    review?: string | null;
    place?: {
      id: string;
      name: string;
      category: string;
      city?: { name: string } | null;
    } | null;
    // List fields
    listTitle?: string;
    listId?: string;
    itemCount?: number;
  };
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function FeedItem({ item }: FeedItemProps) {
  const href = item.type === "log" ? `/place/${item.place?.id}` : `/list/${item.listId}`;

  return (
    <Link href={href} className="block">
      <div className="rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50">
        <div className="flex items-center gap-3">
          <Avatar
            src={item.user.avatar_url}
            alt={item.user.display_name || item.user.username}
            size="md"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {item.user.display_name || item.user.username}
            </p>
            <p className="text-xs text-gray-500">
              {item.type === "log" ? "logged" : "created a list"}{" "}
              &middot; {timeAgo(item.created_at)}
            </p>
          </div>
        </div>

        {item.type === "log" && item.place && (
          <div className="mt-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{item.place.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {item.place.category}
                  </span>
                  {item.place.city && (
                    <span className="text-xs text-gray-500">{item.place.city.name}</span>
                  )}
                </div>
              </div>
              {item.rating && <RatingStars rating={item.rating} size="sm" />}
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {item.review && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                {item.review}
              </p>
            )}
          </div>
        )}

        {item.type === "list" && (
          <div className="mt-3">
            <p className="font-medium">{item.listTitle}</p>
            {item.itemCount !== undefined && (
              <p className="mt-0.5 text-sm text-gray-500">
                {item.itemCount} places
              </p>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
