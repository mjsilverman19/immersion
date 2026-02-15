import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ExplorePage() {
  const supabase = createClient();

  const { data: cities } = await supabase
    .from("cities")
    .select("*")
    .order("name");

  return (
    <div className="bg-cream min-h-screen">
      <div className="px-4 pt-4 pb-4">
        <h1 className="font-serif text-2xl text-ink">Explore</h1>
        <p className="mt-1 text-sm text-ink-light">
          Discover cities through the eyes of locals
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-24">
        {(cities || []).map((city) => (
          <Link
            key={city.id}
            href={`/city/${city.slug}`}
            className="group relative overflow-hidden rounded-xl bg-white shadow-sm"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-cream-dark">
              {city.photo_url ? (
                <img
                  src={city.photo_url}
                  alt={city.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cream-dark to-cream">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-ink-light/20">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 0 1-1.161.886l-.143.048a1.107 1.107 0 0 0-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 0 1-1.652.928l-.679-.906a1.125 1.125 0 0 0-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 1 0 6.462 14.603M12.75 3.031a9 9 0 0 1 6.462 14.603m0 0-.177-.529A2.25 2.25 0 0 0 17.128 15H16.5l-.324-.324a1.453 1.453 0 0 0-2.328.377l-.036.073a1.586 1.586 0 0 1-.982.816l-.99.282c-.55.157-.894.702-.8 1.267l.073.438c.08.474.49.821.97.821.846 0 1.598.542 1.865 1.345l.215.643m5.276-3.67a9.012 9.012 0 0 1-5.276 3.67m0 0a9 9 0 0 1-10.275-4.835M15.75 9c0 .896-.393 1.7-1.016 2.25" />
                  </svg>
                </div>
              )}
              {/* City name overlay on photo */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <h2 className="font-serif text-lg font-normal text-white">
                  {city.name}
                </h2>
                <p className="text-xs text-white/80">
                  {city.country}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
