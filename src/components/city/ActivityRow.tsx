import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { timeAgo } from "@/lib/utils/timeAgo";

interface ActivityRowProps {
  log: {
    id: string;
    user: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
    place: {
      id: string;
      name: string;
    };
    created_at: string;
  };
}

export default function ActivityRow({ log }: ActivityRowProps) {
  const displayName = log.user.display_name || log.user.username;

  return (
    <div className="flex items-center gap-3 py-3">
      <Link href={`/profile/${log.user.username}`} className="flex-shrink-0">
        <Avatar src={log.user.avatar_url} alt={displayName} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          <span className="font-medium">{displayName}</span>
          {" logged "}
          <Link
            href={`/place/${log.place.id}`}
            className="font-serif italic text-ink hover:underline"
          >
            {log.place.name}
          </Link>
        </p>
      </div>
      <span className="flex-shrink-0 text-xs text-ink-light">
        {timeAgo(log.created_at)}
      </span>
    </div>
  );
}
