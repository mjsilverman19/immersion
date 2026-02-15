import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Link from "next/link";
import SaveButton from "./SaveButton";

interface Props {
  params: { id: string };
}

export default async function ListDetailPage({ params }: Props) {
  const supabase = createClient();

  const { data: list } = await supabase
    .from("lists")
    .select("*, profiles!lists_user_id_fkey(username, display_name, avatar_url), city:cities!lists_city_id_fkey(name)")
    .eq("id", params.id)
    .single();

  if (!list) notFound();

  const { data: items } = await supabase
    .from("list_items")
    .select("*, place:places!list_items_place_id_fkey(*)")
    .eq("list_id", params.id)
    .order("position");

  const author = list.profiles as Record<string, unknown> | null;
  const city = list.city as Record<string, unknown> | null;

  return (
    <div>
      <div className="border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold">{list.title}</h1>
        {list.description && (
          <p className="mt-2 text-sm text-gray-500">{list.description}</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          {author && (
            <Link href={`/profile/${author.username}`} className="flex items-center gap-2">
              <Avatar
                src={author.avatar_url as string | null}
                alt={(author.display_name || author.username) as string}
                size="sm"
              />
              <span className="text-sm font-medium">
                {(author.display_name || author.username) as string}
              </span>
            </Link>
          )}
          {city && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {city.name as string}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-gray-500">{list.save_count} saves</span>
          <SaveButton listId={list.id} />
        </div>
      </div>

      <div className="p-4">
        <div className="space-y-4">
          {(items || []).map((item, idx) => {
            const place = item.place as Record<string, unknown>;
            return (
              <Link key={item.id} href={`/place/${place.id}`} className="block">
                <div className="flex gap-4 rounded-xl border border-gray-200 p-4 hover:bg-gray-50">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{place.name as string}</p>
                    <p className="text-sm text-gray-500">{place.address as string}</p>
                    <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {place.category as string}
                    </span>
                    {item.note && (
                      <p className="mt-2 text-sm italic text-gray-600">
                        &ldquo;{item.note}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
