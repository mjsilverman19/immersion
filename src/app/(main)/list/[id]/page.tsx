import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Link from "next/link";
import SaveButton from "./SaveButton";
import type { ListWithAuthor, ListItemWithPlaceFull } from "@/lib/types/queries";

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

  const typedList = list as unknown as ListWithAuthor;
  const author = typedList.profiles;
  const city = typedList.city;

  return (
    <div className="bg-cream min-h-screen">
      <div className="px-4 pt-5 pb-4">
        <h1 className="font-serif text-2xl text-ink">{list.title}</h1>
        {list.description && (
          <p className="mt-2 text-sm text-ink-light">{list.description}</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          {author && (
            <Link href={`/profile/${author.username}`} className="flex items-center gap-2">
              <Avatar
                src={author.avatar_url}
                alt={author.display_name || author.username}
                size="sm"
              />
              <span className="text-sm font-medium text-ink">
                {author.display_name || author.username}
              </span>
            </Link>
          )}
          {city && (
            <span className="rounded-full bg-cream-dark px-2 py-0.5 text-xs text-ink-light">
              {city.name}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-ink-light">{list.save_count} saves</span>
          <SaveButton listId={list.id} />
        </div>
      </div>

      <div className="px-4 pb-24">
        <div className="space-y-3">
          {((items || []) as unknown as ListItemWithPlaceFull[]).map((item, idx) => {
            const place = item.place;
            const photos = place.photo_urls || [];
            return (
              <Link key={item.id} href={`/place/${place.id}`} className="block">
                <div className="flex gap-3 rounded-xl bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                  {photos[0] ? (
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-cream-dark">
                      <img src={photos[0]} alt={place.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream-dark text-sm font-medium text-ink-light">
                      {idx + 1}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink truncate">{place.name}</p>
                    <p className="text-sm text-ink-light truncate">{place.address}</p>
                    <span className="mt-1 inline-block rounded-full bg-cream-dark px-2 py-0.5 text-[10px] text-ink-light capitalize">
                      {place.category?.replace("_", " ")}
                    </span>
                    {item.note && (
                      <p className="mt-2 text-sm italic text-ink-light">
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
