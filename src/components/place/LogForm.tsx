"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";
import { useToast } from "@/components/ui/Toast";
import RatingStars from "./RatingStars";
import TagSelector from "./TagSelector";
import type { Place, PlaceCategory } from "@/lib/types/database";

interface LogFormProps {
  place: Place;
  existingLog?: {
    id: string;
    rating: number;
    tags: string[];
    review: string | null;
  } | null;
}

export default function LogForm({ place, existingLog }: LogFormProps) {
  const [rating, setRating] = useState(existingLog?.rating ?? 0);
  const [tags, setTags] = useState<string[]>(existingLog?.tags ?? []);
  const [review, setReview] = useState(existingLog?.review ?? "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || !user) return;
    setLoading(true);

    const isLocalLog = profile?.home_city_id === place.city_id;

    const logData = {
      user_id: user.id,
      place_id: place.id,
      rating,
      tags,
      review: review || null,
      is_local_log: isLocalLog,
    };

    if (existingLog) {
      await supabase.from("logs").update(logData).eq("id", existingLog.id);
    } else {
      await supabase.from("logs").insert(logData);
    }

    toast(existingLog ? "Log updated" : "Place logged!");
    router.push(`/place/${place.id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{place.name}</h2>
        <p className="text-sm text-gray-500">{place.address}</p>
        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {place.category}
        </span>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Rating</label>
        <RatingStars rating={rating} onChange={setRating} size="lg" interactive />
      </div>

      <TagSelector
        category={place.category as PlaceCategory}
        selectedTags={tags}
        onChange={setTags}
      />

      <div>
        <label htmlFor="review" className="mb-1 block text-sm font-medium">
          Review <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          maxLength={2000}
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-gray-700 dark:bg-gray-900 dark:focus:border-white dark:focus:ring-white"
          placeholder="What made this place special?"
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {review.length}/2000
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || rating === 0}
        className="w-full rounded-lg bg-black py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
      >
        {loading ? "Saving..." : existingLog ? "Update log" : "Log it"}
      </button>
    </form>
  );
}
