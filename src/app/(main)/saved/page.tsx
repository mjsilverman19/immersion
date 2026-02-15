import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ListCard from "@/components/list/ListCard";
import type { SaveWithList } from "@/lib/types/queries";

export default async function SavedPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: saves } = await supabase
    .from("saves")
    .select("*, list:lists!saves_list_id_fkey(*, profiles!lists_user_id_fkey(username, display_name, avatar_url), city:cities!lists_city_id_fkey(name), list_items(id))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const typedSaves = (saves || []) as unknown as SaveWithList[];
  const savedLists = typedSaves
    .map((save) => save.list)
    .filter((list): list is NonNullable<typeof list> => list !== null);

  return (
    <div className="bg-cream min-h-screen">
      <div className="px-4 pt-4 pb-2">
        <h1 className="font-serif text-2xl text-ink">Saved</h1>
        <p className="mt-1 text-sm text-ink-light">
          Lists you&apos;ve saved for later
        </p>
      </div>

      <div className="px-4 pb-24 pt-4">
        {savedLists.length === 0 ? (
          <div className="py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="mx-auto h-10 w-10 text-ink-light/30">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            </svg>
            <p className="mt-3 text-sm text-ink-light">
              No saved lists yet. Browse lists and save ones you like!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedLists.map((list) => (
                <ListCard
                  key={list.id}
                  list={{
                    id: list.id,
                    title: list.title,
                    description: list.description,
                    save_count: list.save_count,
                    user: list.profiles ? {
                      username: list.profiles.username,
                      avatar_url: list.profiles.avatar_url,
                      display_name: list.profiles.display_name,
                    } : null,
                    city: list.city,
                    itemCount: list.list_items?.length,
                  }}
                />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
