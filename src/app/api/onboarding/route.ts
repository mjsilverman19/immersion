import { NextResponse } from "next/server";
import { authenticated } from "@/lib/api/handler";
import { computeOnboardingVector } from "@/lib/taste-vector";
import { SCENARIO_PAIRS, QUIZ_SEQUENCE_INDICES } from "@/constants/scenarios";

interface ChoicePayload {
  scenario_pair_index: number;
  chose_b: boolean;
  position: number;
}

// Use null schema — this route has complex branching (quiz vs legacy) that
// doesn't fit a single Zod schema cleanly
export const POST = authenticated(null, async (_req, { user, supabase }) => {
  let body: Record<string, unknown>;
  try {
    body = await _req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, display_name, home_city_id, avatar_url } = body as {
    username?: string;
    display_name?: string;
    home_city_id?: string;
    avatar_url?: string;
  };

  if (!username || (username as string).length < 3) {
    return NextResponse.json(
      { error: "Username must be at least 3 characters" },
      { status: 400 }
    );
  }

  // Determine if this is the new quiz-based payload or legacy keyword payload
  const isQuizPayload = Array.isArray(body.choices);

  if (isQuizPayload) {
    // --- New quiz-based onboarding ---
    const choices: ChoicePayload[] = body.choices as ChoicePayload[];

    if (choices.length === 0) {
      return NextResponse.json(
        { error: "At least one choice is required" },
        { status: 400 }
      );
    }

    // Compute taste vector from choices
    const vectorChoices = choices.map((c) => {
      const pairIndex = QUIZ_SEQUENCE_INDICES[c.scenario_pair_index];
      const pair = SCENARIO_PAIRS[pairIndex];
      return {
        vectorDirection: pair?.vector_direction ?? [0, 0, 0, 0, 0, 0, 0, 0],
        choseB: c.chose_b,
      };
    });

    const tasteVector = computeOnboardingVector(vectorChoices);

    // Upsert profile with taste vector
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      username: (username as string).toLowerCase(),
      display_name: (display_name as string) || null,
      home_city_id: (home_city_id as string) || null,
      avatar_url: (avatar_url as string) || null,
      taste_vector: tasteVector,
      taste_vector_version: 1,
      onboarding_version: 2,
      taste_preferences: [],
      category_preferences: [],
    });

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    // Fetch scenario pair IDs from DB to link choices
    const { data: dbPairs } = await supabase
      .from("scenario_pairs")
      .select("id, display_order")
      .eq("active", true)
      .order("display_order");

    if (dbPairs && dbPairs.length > 0) {
      const orderToId = new Map(
        dbPairs.map((p) => [p.display_order, p.id])
      );

      const choiceInserts = choices
        .map((c) => {
          const pairIndex = QUIZ_SEQUENCE_INDICES[c.scenario_pair_index];
          const pair = SCENARIO_PAIRS[pairIndex];
          if (!pair) return null;
          const dbId = orderToId.get(pair.display_order);
          if (!dbId) return null;
          return {
            user_id: user.id,
            scenario_pair_id: dbId,
            chose_b: c.chose_b,
            position: c.position,
          };
        })
        .filter(Boolean);

      if (choiceInserts.length > 0) {
        await supabase.from("onboarding_choices").upsert(
          choiceInserts as {
            user_id: string;
            scenario_pair_id: string;
            chose_b: boolean;
            position: number;
          }[],
          { onConflict: "user_id,scenario_pair_id" }
        );
      }
    }

    return NextResponse.json({ success: true });
  }

  // --- Legacy keyword-based onboarding (backward compatibility) ---
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username: (username as string).toLowerCase(),
    display_name: (display_name as string) || null,
    home_city_id: (home_city_id as string) || null,
    avatar_url: (avatar_url as string) || null,
    taste_preferences: (body.taste_preferences as string[]) || [],
    category_preferences: (body.category_preferences as string[]) || [],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
