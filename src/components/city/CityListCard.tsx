import Link from "next/link";

interface CityListCardProps {
  list: {
    id: string;
    title: string;
    authorName: string;
    itemCount: number;
  };
}

export default function CityListCard({ list }: CityListCardProps) {
  return (
    <Link href={`/list/${list.id}`} className="block">
      <div className="rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        <p className="font-serif text-base text-ink">
          {list.title}
        </p>
        <p className="mt-1 text-sm text-ink-light">
          by {list.authorName} · {list.itemCount} places
        </p>
      </div>
    </Link>
  );
}
