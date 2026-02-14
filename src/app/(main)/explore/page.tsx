import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ExplorePage() {
  const supabase = createClient();

  const { data: cities } = await supabase
    .from("cities")
    .select("*")
    .order("name");

  return (
    <div>
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <h1 className="text-2xl font-bold">Explore</h1>
        <p className="mt-1 text-sm text-gray-500">
          Discover cities through the eyes of locals
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {(cities || []).map((city) => (
          <Link
            key={city.id}
            href={`/city/${city.slug}`}
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-950"
          >
            <div className="aspect-[16/9] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900" />
            <div className="p-4">
              <h2 className="font-semibold group-hover:underline">
                {city.name}
              </h2>
              <p className="text-sm text-gray-500">
                {city.country}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
