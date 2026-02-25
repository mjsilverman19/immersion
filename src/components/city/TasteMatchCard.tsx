import Avatar from "@/components/ui/Avatar";
import Link from "next/link";

interface TasteMatchCardProps {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  tasteMatch: number;
  tastePreferences: string[];
  isFollowing: boolean;
  onFollow: () => void;
}

export default function TasteMatchCard({
  username,
  displayName,
  avatarUrl,
  tasteMatch,
  tastePreferences,
  isFollowing,
  onFollow,
}: TasteMatchCardProps) {
  const visibleTags = tastePreferences.slice(0, 3);

  return (
    <div className="flex w-[160px] min-w-[160px] flex-col rounded-xl bg-white p-3 shadow-sm">
      {/* Top row: avatar + match */}
      <div className="mb-2 flex items-start justify-between">
        <Link href={`/profile/${username}`}>
          <Avatar src={avatarUrl} alt={displayName || username} size="sm" />
        </Link>
        {tasteMatch > 0 ? (
          <span className="text-[15px] font-bold text-rust">
            {tasteMatch}%
          </span>
        ) : (
          <span className="text-[11px] font-medium text-ink-light">
            New local
          </span>
        )}
      </div>

      {/* Name */}
      <Link href={`/profile/${username}`}>
        <p className="mb-2 truncate text-sm font-medium text-ink">
          {displayName || username}
        </p>
      </Link>

      {/* Vibe tags */}
      <div className="mb-3 flex min-h-[44px] flex-wrap gap-1">
        {visibleTags.map((tag) => (
          <span
            key={tag}
            className="inline-block whitespace-nowrap rounded-full bg-cream px-2 py-0.5 text-[11px] font-medium text-ink-light"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Follow button */}
      <div className="mt-auto">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onFollow();
          }}
          className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
            isFollowing
              ? "bg-rust text-white"
              : "border border-rust/30 text-rust hover:bg-rust/5"
          }`}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}
