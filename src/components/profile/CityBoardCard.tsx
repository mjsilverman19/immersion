interface CityBoardCardProps {
  cityName: string;
  savedCount: number;
  photos: (string | null)[];
}

export default function CityBoardCard({ cityName, savedCount, photos }: CityBoardCardProps) {
  // Always show 4 slots
  const slots = [photos[0] ?? null, photos[1] ?? null, photos[2] ?? null, photos[3] ?? null];

  return (
    <div className="flex-shrink-0 w-[140px] bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden snap-start">
      {/* 2x2 thumbnail grid */}
      <div className="grid grid-cols-2 grid-rows-2 w-full h-[100px] gap-px bg-cream-dark">
        {slots.map((photo, i) =>
          photo ? (
            <img
              key={i}
              src={photo}
              alt=""
              className="w-full h-full object-cover block"
            />
          ) : (
            <div key={i} className="w-full h-full bg-cream-dark" />
          )
        )}
      </div>
      {/* City name + count */}
      <div className="px-3 pt-2.5 pb-3">
        <p className="font-serif text-[15px] text-ink leading-tight">{cityName}</p>
        <p className="text-xs text-ink-light mt-0.5 leading-tight">{savedCount} saved</p>
      </div>
    </div>
  );
}
