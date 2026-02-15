"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { City } from "@/lib/types/database";

interface CitySelectorProps {
  value?: string | null;
  onChange: (cityId: string) => void;
  className?: string;
}

export default function CitySelector({ value, onChange, className = "" }: CitySelectorProps) {
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchCities = async () => {
      const { data } = await supabase.from("cities").select("*").order("name");
      if (data) setCities(data);
    };
    fetchCities();
  }, [supabase]);

  const filtered = cities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase())
  );

  const selected = cities.find((c) => c.id === value);

  return (
    <div className={`relative ${className}`}>
      <label className="mb-1 block text-sm font-medium">Home City</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
      >
        {selected ? `${selected.name}, ${selected.country}` : "Select your city"}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cities..."
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
              autoFocus
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.map((city) => (
              <li key={city.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(city.id);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                    city.id === value ? "bg-gray-50 font-medium" : ""
                  }`}
                >
                  {city.name}, {city.country}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">No cities found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
