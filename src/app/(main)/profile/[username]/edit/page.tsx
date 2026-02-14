"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    </div>
  );
}
