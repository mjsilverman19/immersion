"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CitySelector from "@/components/ui/CitySelector";
import AvatarUpload from "@/components/ui/AvatarUpload";
import Avatar from "@/components/ui/Avatar";
import { getQuizPairs, type ScenarioPairData } from "@/constants/scenarios";

const quizPairs = getQuizPairs();

interface TasteChoice {
  scenarioPairIndex: number;
  choseB: boolean;
  position: number;
}

interface MatchedLocal {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  taste_match: number;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [homeCityId, setHomeCityId] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [checking, setChecking] = useState(false);

  // Step 2: taste quiz
  const [quizIndex, setQuizIndex] = useState(0);
  const [choices, setChoices] = useState<TasteChoice[]>([]);
  const [selectedOption, setSelectedOption] = useState<"a" | "b" | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Step 3: taste reveal
  const [matchedLocals, setMatchedLocals] = useState<MatchedLocal[]>([]);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) router.push("/login");
    };
    getUser();
  }, [supabase, router]);

  const checkUsername = useCallback(
    async (name: string) => {
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
    },
    [supabase]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) checkUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleNext = () => {
    if (!usernameAvailable) return;
    setStep(2);
  };

  // --- Quiz logic ---
  const handleOptionSelect = (choseB: boolean) => {
    if (selectedOption !== null || transitioning) return;

    setSelectedOption(choseB ? "b" : "a");

    const choice: TasteChoice = {
      scenarioPairIndex: quizIndex,
      choseB,
      position: quizIndex,
    };

    const newChoices = [...choices, choice];
    setChoices(newChoices);

    // Brief highlight, then auto-advance
    setTimeout(() => {
      setTransitioning(true);

      setTimeout(() => {
        if (quizIndex < quizPairs.length - 1) {
          setQuizIndex(quizIndex + 1);
          setSelectedOption(null);
          setTransitioning(false);
        } else {
          // Quiz complete — submit + move to reveal
          setStep(3);
          setTransitioning(false);
          setSelectedOption(null);
          submitOnboarding(newChoices);
        }
      }, 300);
    }, 400);
  };

  const submitOnboarding = async (finalChoices: TasteChoice[]) => {
    setError(null);
    setLoading(true);

    const payload = {
      username: username.toLowerCase(),
      display_name: displayName || null,
      home_city_id: homeCityId || null,
      avatar_url: avatarUrl || null,
      choices: finalChoices.map((c) => ({
        scenario_pair_index: c.scenarioPairIndex,
        chose_b: c.choseB,
        position: c.position,
      })),
    };

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
    }

    setLoading(false);
  };

  const handleReveal = async () => {
    setRevealLoading(true);
    setRevealed(true);

    if (homeCityId) {
      try {
        const res = await fetch(
          `/api/discover/locals?city_id=${homeCityId}`
        );
        if (res.ok) {
          const data = await res.json();
          setMatchedLocals(
            (data.locals || [])
              .filter((l: MatchedLocal) => l.taste_match > 0)
              .slice(0, 5)
          );
        }
      } catch {
        // Silently fail — we'll show the fallback
      }
    }

    setRevealLoading(false);
  };

  const handleFinish = () => {
    router.push("/feed");
    router.refresh();
  };

  const canProceedStep1 = username.length >= 3 && usernameAvailable === true;
  const currentPair: ScenarioPairData | undefined = quizPairs[quizIndex];

  return (
    <div className="w-full">
      {/* Step 1: Profile setup */}
      {step === 1 && (
        <>
          <h1 className="mb-2 font-serif text-2xl text-ink">
            Set up your profile
          </h1>
          <p className="mb-8 text-sm text-ink-light">
            Tell us about yourself and where you call home.
          </p>

          <div className="space-y-6">
            <AvatarUpload
              currentUrl={avatarUrl || null}
              onUpload={setAvatarUrl}
            />

            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-sm font-medium text-ink"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                }
                required
                minLength={3}
                maxLength={30}
                className="w-full rounded-xl border border-cream-dark bg-white px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                placeholder="your_username"
              />
              {checking && (
                <p className="mt-1 text-xs text-ink-light">
                  Checking availability...
                </p>
              )}
              {usernameAvailable === true && (
                <p className="mt-1 text-xs text-green-600">
                  Username is available
                </p>
              )}
              {usernameAvailable === false && (
                <p className="mt-1 text-xs text-red-600">Username is taken</p>
              )}
            </div>

            <div>
              <label
                htmlFor="displayName"
                className="mb-1 block text-sm font-medium text-ink"
              >
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
              className="w-full rounded-full bg-rust py-2.5 text-sm font-medium text-white hover:bg-rust/90 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Step 2: Taste quiz */}
      {step === 2 && currentPair && (
        <div className="flex flex-col items-center">
          {/* Progress counter */}
          <p className="mb-6 text-sm font-medium tracking-wide text-rust">
            {quizIndex + 1} OF {quizPairs.length}
          </p>

          {/* Prompt */}
          <h1
            className={`mb-3 text-center font-serif text-2xl leading-snug text-ink transition-opacity duration-300 ${
              transitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {currentPair.prompt}
          </h1>

          <p className="mb-8 text-center text-sm text-ink-light">
            Choose the one that pulls you.
          </p>

          {/* Option cards */}
          <div
            className={`grid w-full grid-cols-2 gap-3 transition-opacity duration-300 ${
              transitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {/* Option A */}
            <button
              type="button"
              onClick={() => handleOptionSelect(false)}
              disabled={selectedOption !== null}
              className={`flex flex-col rounded-2xl border-2 bg-white p-4 text-left transition-all duration-200 ${
                selectedOption === "a"
                  ? "border-rust shadow-md"
                  : selectedOption === "b"
                    ? "border-transparent opacity-50"
                    : "border-transparent hover:border-cream-dark hover:shadow-sm"
              }`}
            >
              {/* Placeholder illustration area */}
              <div className="mb-3 flex h-28 w-full items-center justify-center rounded-xl bg-cream">
                <span className="text-3xl opacity-40">
                  {getOptionEmoji(currentPair.dimension, false)}
                </span>
              </div>
              <span className="mb-1 text-sm font-semibold text-ink">
                {currentPair.option_a_label}
              </span>
              <span className="text-xs leading-snug text-ink-light">
                {currentPair.option_a_description}
              </span>
            </button>

            {/* Option B */}
            <button
              type="button"
              onClick={() => handleOptionSelect(true)}
              disabled={selectedOption !== null}
              className={`flex flex-col rounded-2xl border-2 bg-white p-4 text-left transition-all duration-200 ${
                selectedOption === "b"
                  ? "border-rust shadow-md"
                  : selectedOption === "a"
                    ? "border-transparent opacity-50"
                    : "border-transparent hover:border-cream-dark hover:shadow-sm"
              }`}
            >
              <div className="mb-3 flex h-28 w-full items-center justify-center rounded-xl bg-cream">
                <span className="text-3xl opacity-40">
                  {getOptionEmoji(currentPair.dimension, true)}
                </span>
              </div>
              <span className="mb-1 text-sm font-semibold text-ink">
                {currentPair.option_b_label}
              </span>
              <span className="text-xs leading-snug text-ink-light">
                {currentPair.option_b_description}
              </span>
            </button>
          </div>

          {/* Progress dots */}
          <div className="mt-auto flex gap-2 pt-12">
            {quizPairs.map((_, i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  i === quizIndex
                    ? "bg-rust"
                    : i < quizIndex
                      ? "bg-rust/40"
                      : "bg-cream-dark"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Taste reveal */}
      {step === 3 && (
        <div className="flex flex-col items-center text-center">
          {!revealed ? (
            <>
              <h1 className="mb-4 font-serif text-3xl leading-snug text-ink">
                We think we know
                <br />
                what you&apos;ll love.
              </h1>
              <p className="mb-10 text-sm text-ink-light">
                Based on your choices, we&apos;ve mapped your taste.
              </p>

              {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

              {loading ? (
                <p className="text-sm text-ink-light">
                  Setting up your profile...
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleReveal}
                  className="rounded-full bg-rust px-10 py-3 text-sm font-medium text-white hover:bg-rust/90"
                >
                  Show me.
                </button>
              )}
            </>
          ) : (
            <>
              {revealLoading ? (
                <div className="py-12">
                  <p className="text-sm text-ink-light">
                    Finding people like you...
                  </p>
                </div>
              ) : matchedLocals.length > 0 ? (
                <>
                  <h2 className="mb-2 font-serif text-2xl text-ink">
                    Locals who get it.
                  </h2>
                  <p className="mb-8 text-sm text-ink-light">
                    These people share your taste. Follow them to see their
                    favorite places.
                  </p>

                  <div className="w-full space-y-3">
                    {matchedLocals.map((local) => (
                      <div
                        key={local.id}
                        className="flex items-center gap-3 rounded-2xl bg-white p-4"
                      >
                        <Avatar
                          src={local.avatar_url}
                          alt={local.display_name || local.username}
                          size="md"
                        />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-ink">
                            {local.display_name || local.username}
                          </p>
                          <p className="text-xs text-ink-light">
                            @{local.username}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-rust">
                          {local.taste_match}% match
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mb-2 font-serif text-2xl text-ink">
                    You&apos;re one of the first.
                  </h2>
                  <p className="mb-2 text-sm text-ink-light">
                    Your taste is mapped. As more locals join,
                    <br />
                    we&apos;ll match you with people who get it.
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={handleFinish}
                className="mt-10 w-full rounded-full bg-rust py-3 text-sm font-medium text-white hover:bg-rust/90"
              >
                Start exploring
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Light placeholder emoji per dimension to fill the illustration area */
function getOptionEmoji(dimension: string, isB: boolean): string {
  const map: Record<string, [string, string]> = {
    quiet_lively: ["\u{1F377}", "\u{1F3AA}"],
    budget_splurge: ["\u{1F37D}\uFE0F", "\u{2728}"],
    solo_social: ["\u{1F3A7}", "\u{1F37B}"],
    cautious_adventurous: ["\u{1F4D6}", "\u{1F3B2}"],
    linger_move: ["\u{2615}", "\u{1F45F}"],
    morning_night: ["\u{1F305}", "\u{1F303}"],
    food_broad: ["\u{1F372}", "\u{1F30D}"],
    planned_spontaneous: ["\u{1F4CB}", "\u{1F6B6}"],
    "budget_splurge+cautious_adventurous": ["\u{1F3E8}", "\u{1F344}"],
    "quiet_lively+solo_social": ["\u{1F4DA}", "\u{1F483}"],
    "linger_move+planned_spontaneous": ["\u{2764}\uFE0F", "\u{1F6A3}"],
    "morning_night+food_broad": ["\u{1F33E}", "\u{1F307}"],
  };
  const pair = map[dimension];
  if (!pair) return isB ? "\u{2728}" : "\u{2B50}";
  return isB ? pair[1] : pair[0];
}
