"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CitySelector from "@/components/ui/CitySelector";
import AvatarUpload from "@/components/ui/AvatarUpload";
import { VIBE_TAGS, CATEGORY_PREFERENCES } from "@/constants/tags";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [homeCityId, setHomeCityId] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  // Step 2 fields
  const [tastePreferences, setTastePreferences] = useState<string[]>([]);
  const [categoryPreferences, setCategoryPreferences] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Verify user is authenticated
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push("/login");
    };
    getUser();
  }, [supabase, router]);

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

  const toggleVibeTag = (tag: string) => {
    setTastePreferences((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleCategory = (cat: string) => {
    setCategoryPreferences((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleNext = () => {
    if (!usernameAvailable) return;
    setStep(2);
  };

  const handleSubmit = async () => {
    if (tastePreferences.length < 3) return;
    setError(null);
    setLoading(true);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.toLowerCase(),
        display_name: displayName || null,
        home_city_id: homeCityId || null,
        avatar_url: avatarUrl || null,
        taste_preferences: tastePreferences,
        category_preferences: categoryPreferences,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    router.push("/feed");
    router.refresh();
  };

  const canProceedStep1 = username.length >= 3 && usernameAvailable === true;
  const canSubmit = tastePreferences.length >= 3;

  return (
    <div>
      {step === 1 ? (
        <>
          <h1 className="mb-2 font-serif text-2xl text-ink">Set up your profile</h1>
          <p className="mb-8 text-sm text-ink-light">
            Tell us about yourself and where you call home.
          </p>

          <div className="space-y-6">
            <AvatarUpload
              currentUrl={avatarUrl || null}
              onUpload={setAvatarUrl}
            />

            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-ink">
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
                className="w-full rounded-xl border border-cream-dark bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                placeholder="your_username"
              />
              {checking && <p className="mt-1 text-xs text-ink-light">Checking availability...</p>}
              {usernameAvailable === true && (
                <p className="mt-1 text-xs text-green-600">Username is available</p>
              )}
              {usernameAvailable === false && (
                <p className="mt-1 text-xs text-red-600">Username is taken</p>
              )}
            </div>

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
                placeholder="How you want to be known"
              />
            </div>

            <CitySelector value={homeCityId || null} onChange={setHomeCityId} />

            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceedStep1}
              className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="mb-2 font-serif text-2xl text-ink">Your vibe</h1>
          <p className="mb-6 text-sm text-ink-light">
            What kind of places do you gravitate toward? Pick at least 3.
          </p>

          <div className="space-y-8">
            {/* Vibe tags */}
            <div>
              <div className="flex flex-wrap gap-2">
                {VIBE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleVibeTag(tag)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      tastePreferences.includes(tag)
                        ? "bg-ink text-cream"
                        : "bg-cream-dark text-ink-light hover:bg-cream-dark/80"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {tastePreferences.length > 0 && tastePreferences.length < 3 && (
                <p className="mt-2 text-xs text-ink-light">
                  Pick {3 - tastePreferences.length} more
                </p>
              )}
            </div>

            {/* Category preferences */}
            <div>
              <p className="mb-3 text-sm font-medium text-ink">
                What are you usually looking for?{" "}
                <span className="font-normal text-ink-light">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_PREFERENCES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      categoryPreferences.includes(cat)
                        ? "bg-ink text-cream"
                        : "bg-white text-ink shadow-sm hover:shadow-md"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-cream-dark px-6 py-2.5 text-sm font-medium text-ink hover:bg-cream-dark"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !canSubmit}
                className="flex-1 rounded-full bg-ink py-2.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
              >
                {loading ? "Setting up..." : "Get started"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
