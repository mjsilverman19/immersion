"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";
import { useToast } from "@/components/ui/Toast";
import CitySelector from "@/components/ui/CitySelector";
import PlaceSearch from "@/components/place/PlaceSearch";
import type { Place } from "@/lib/types/database";

interface ListItemDraft {
  place: Place;
  note: string;
}

export default function NewListPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cityId, setCityId] = useState("");
  const [items, setItems] = useState<ListItemDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const addPlace = (place: Place) => {
    if (items.find((i) => i.place.id === place.id)) return;
    setItems([...items, { place, note: "" }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateNote = (idx: number, note: string) => {
    const next = [...items];
    next[idx].note = note;
    setItems(next);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setItems(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || items.length === 0) return;
    setLoading(true);

    const { data: list, error } = await supabase
      .from("lists")
      .insert({
        user_id: profile.id,
        title,
        description: description || null,
        city_id: cityId || null,
        is_public: true,
      })
      .select()
      .single();

    if (error || !list) {
      setLoading(false);
      return;
    }

    const listItems = items.map((item, idx) => ({
      list_id: list.id,
      place_id: item.place.id,
      position: idx,
      note: item.note || null,
    }));

    await supabase.from("list_items").insert(listItems);

    toast("List created!");
    router.push(`/list/${list.id}`);
  };

  return (
    <div className="p-4">
      <h1 className="mb-6 text-2xl font-bold">New List</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-gray-700 dark:bg-gray-900"
            placeholder="My favorite spots"
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-gray-700 dark:bg-gray-900"
            placeholder="What's this list about?"
          />
        </div>

        <CitySelector value={cityId || null} onChange={setCityId} />

        <div>
          <label className="mb-2 block text-sm font-medium">Add Places</label>
          <PlaceSearch onSelect={addPlace} />
        </div>

        {items.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-medium">
              Places ({items.length})
            </label>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.place.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">{idx + 1}.</span>
                      <div>
                        <p className="font-medium">{item.place.name}</p>
                        <p className="text-xs text-gray-500">{item.place.category}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveItem(idx, -1)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" disabled={idx === 0}>
                        ↑
                      </button>
                      <button type="button" onClick={() => moveItem(idx, 1)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" disabled={idx === items.length - 1}>
                        ↓
                      </button>
                      <button type="button" onClick={() => removeItem(idx)} className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                        ✕
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={item.note}
                    onChange={(e) => updateNote(idx, e.target.value)}
                    placeholder="Add a note about this place..."
                    className="mt-2 w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-black focus:outline-none dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !title || items.length === 0}
          className="w-full rounded-lg bg-black py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          {loading ? "Creating..." : "Create List"}
        </button>
      </form>
    </div>
  );
}
