"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CitySelector from "@/components/ui/CitySelector";
import AvatarUpload from "@/components/ui/AvatarUpload";
import { useToast } from "@/components/ui/Toast";
import type { Profile } from "@/lib/types/database";

interface Props {
  profile: Profile;
}

export default function EditProfileForm({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [homeCityId, setHomeCityId] = useState(profile.home_city_id || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        bio,
        home_city_id: homeCityId,
        avatar_url: avatarUrl,
      }),
    });

    if (!res.ok) {
      toast("Failed to update profile", "error");
      setLoading(false);
      return;
    }

    toast("Profile updated");
    router.push(`/profile/${profile.username}`);
    router.refresh();
  };

  return (
    <>
      <form onSubmit={handleSave} className="space-y-6">
        <AvatarUpload
          currentUrl={avatarUrl || null}
          onUpload={setAvatarUrl}
        />

        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-ink">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-cream-dark bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="bio" className="mb-1 block text-sm font-medium text-ink">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-cream-dark bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
          />
        </div>

        <CitySelector value={homeCityId || null} onChange={setHomeCityId} />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>

      <div className="mt-8 border-t border-cream-dark pt-6">
        <h2 className="text-sm font-medium text-ink-light">Import Data</h2>
        <Link
          href="/import"
          className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm hover:shadow-md"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-dark">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4 text-ink-light"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Import from Google Maps</p>
            <p className="text-xs text-ink-light">
              Upload your Google Takeout saved places
            </p>
          </div>
        </Link>
      </div>
    </>
  );
}
