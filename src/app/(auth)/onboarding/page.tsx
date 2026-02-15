"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CitySelector from "@/components/ui/CitySelector";
import AvatarUpload from "@/components/ui/AvatarUpload";

export default function OnboardingPage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [homeCityId, setHomeCityId] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, [supabase]);

  const checkUsername = useCallback(async (name: string) => {
    if (name.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setChecking(true);
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", name.toLowerCase())
      .maybeSingle();
    setUsernameAvailable(!data);
    setChecking(false);
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) checkUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!usernameAvailable) {
      setError("Username is not available");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("profiles").upsert({
      id: userId,
      username: username.toLowerCase(),
      display_name: displayName || null,
      home_city_id: homeCityId || null,
      avatar_url: avatarUrl || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/feed");
    router.refresh();
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Set up your profile</h1>
      <p className="mb-8 text-sm text-gray-500">
        Tell us about yourself and where you call home.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <AvatarUpload
          currentUrl={avatarUrl || null}
          onUpload={setAvatarUrl}
        />

        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            required
            minLength={3}
            maxLength={30}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="your_username"
          />
          {checking && <p className="mt-1 text-xs text-gray-500">Checking availability...</p>}
          {usernameAvailable === true && (
            <p className="mt-1 text-xs text-green-600">Username is available</p>
          )}
          {usernameAvailable === false && (
            <p className="mt-1 text-xs text-red-600">Username is taken</p>
          )}
        </div>

        <div>
          <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            placeholder="How you want to be known"
          />
        </div>

        <CitySelector value={homeCityId || null} onChange={setHomeCityId} />

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !username || usernameAvailable !== true}
          className="w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Setting up..." : "Get started"}
        </button>
      </form>
    </div>
  );
}
