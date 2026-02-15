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

  useEffect(() => {
    const fetchCities = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("cities").select("*").order("name");
      if (data) setCities(data);
    };
    fetchCities();
  }, []);

  const filtered = cities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase())
  );

  const selected = cities.find((c) => c.id === value);

  return (
    <div className={`relative ${className}`}>
      <label className="mb-1 block text-sm font-medium text-ink">Home City</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-cream-dark bg-white px-3 py-2 text-left text-sm text-ink focus:border-ink focus:outline-none"
      >
        {selected ? `${selected.name}, ${selected.country}` : "Select your city"}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-cream-dark bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cities..."
              className="w-full rounded-lg border border-cream-dark px-3 py-1.5 text-sm text-ink placeholder:text-ink-light/50 focus:border-ink focus:outline-none"
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
                  className={`w-full px-3 py-2 text-left text-sm text-ink hover:bg-cream-dark ${
                    city.id === value ? "bg-cream-dark font-medium" : ""
                  }`}
                >
                  {city.name}, {city.country}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-light">No cities found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
