"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-provider";
import CitySelector from "@/components/ui/CitySelector";
import AvatarUpload from "@/components/ui/AvatarUpload";
import { useToast } from "@/components/ui/Toast";

export default function EditProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [homeCityId, setHomeCityId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setHomeCityId(profile.home_city_id || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        bio: bio || null,
        home_city_id: homeCityId || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", user.id);

    await refreshProfile();
    toast("Profile updated");
    setLoading(false);
    router.push(`/profile/${profile?.username}`);
  };

  if (!profile) return null;

  return (
    <div className="p-4">
      <h1 className="mb-6 text-2xl font-bold">Edit Profile</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {user && (
          <AvatarUpload
            currentUrl={avatarUrl || null}
            userId={user.id}
            onUpload={setAvatarUrl}
          />
        )}

        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="bio" className="mb-1 block text-sm font-medium">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <CitySelector value={homeCityId || null} onChange={setHomeCityId} />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>

      <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Import Data</h2>
        <Link
          href="/import"
          className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium dark:text-white">Import from Google Maps</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Upload your Google Takeout saved places
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
