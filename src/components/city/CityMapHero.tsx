"use client";

import dynamic from "next/dynamic";

const CityMapHeroInner = dynamic(() => import("./CityMapHeroInner"), {
  ssr: false,
  loading: () => <div className="h-[180px] w-full bg-cream-dark" />,
});

interface CityMapHeroProps {
  center: [number, number];
  places: { latitude: number; longitude: number }[];
}

export default function CityMapHero({ center, places }: CityMapHeroProps) {
  return <CityMapHeroInner center={center} places={places} />;
}
