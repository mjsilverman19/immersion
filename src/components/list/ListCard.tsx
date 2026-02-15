import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

interface ListCardProps {
  list: {
    id: string;
    title: string;
    description: string | null;
    save_count: number;
    user?: {
      username: string;
      avatar_url: string | null;
      display_name: string | null;
    } | null;
    city?: {
      name: string;
    } | null;
    itemCount?: number;
  };
}

export default function ListCard({ list }: ListCardProps) {
  return (
    <Link href={`/list/${list.id}`} className="block">
      <div className="rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        <h3 className="font-medium text-ink">{list.title}</h3>
        {list.description && (
          <p className="mt-1 text-sm text-ink-light line-clamp-2">
            {list.description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {list.user && (
              <>
                <Avatar
                  src={list.user.avatar_url}
                  alt={list.user.display_name || list.user.username}
                  size="sm"
                />
                <span className="text-xs text-ink-light">
                  {list.user.display_name || list.user.username}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-light">
            {list.city && <span>{list.city.name}</span>}
            {list.itemCount !== undefined && <span>{list.itemCount} places</span>}
            <span>{list.save_count} saves</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
