/**
 * Taste dimensions (8-element vector):
 * [0] Quiet / Lively        — atmosphere
 * [1] Budget / Splurge       — price sensitivity
 * [2] Solo / Social          — solo vs. group/date
 * [3] Cautious / Adventurous — willingness to try unfamiliar things
 * [4] Linger / Move          — tempo
 * [5] Morning / Night        — time-of-day
 * [6] Food-focused / Broad   — dining vs. culture/shopping/outdoors
 * [7] Planned / Spontaneous  — research-heavy vs. wander-and-discover
 *
 * Option A = negative direction (first label), Option B = positive direction (second label).
 * vector_direction has 1.0 on probed axes, 0 elsewhere.
 * When user picks A, we subtract the direction; when user picks B, we add it.
 */

export const TASTE_DIMENSIONS = [
  "quiet_lively",
  "budget_splurge",
  "solo_social",
  "cautious_adventurous",
  "linger_move",
  "morning_night",
  "food_broad",
  "planned_spontaneous",
] as const;

export type TasteDimension = (typeof TASTE_DIMENSIONS)[number];

export interface ScenarioPairData {
  dimension: string;
  prompt: string;
  option_a_label: string;
  option_a_description: string;
  option_b_label: string;
  option_b_description: string;
  vector_direction: number[];
  display_order: number;
}

/**
 * 20 scenario pairs across 8 taste dimensions.
 * Each probes 1-2 dimensions via the vector_direction array.
 */
export const SCENARIO_PAIRS: ScenarioPairData[] = [
  // --- Quiet / Lively (dim 0) ---
  {
    dimension: "quiet_lively",
    prompt: "Your first evening in a city you've never been to.",
    option_a_label: "Wine bar",
    option_a_description: "A quiet counter with no menu. The bartender picks for you.",
    option_b_label: "Night market",
    option_b_description: "Smoke and noise and strangers. You'll figure it out.",
    vector_direction: [1, 0, 0, 0, 0, 0, 0, 0],
    display_order: 1,
  },
  {
    dimension: "quiet_lively",
    prompt: "It's your last night. You want to remember this one.",
    option_a_label: "Candlelit dinner",
    option_a_description: "Somewhere small. Six tables. Nobody rushes you.",
    option_b_label: "Rooftop with a crowd",
    option_b_description: "Music, people everywhere, the whole city laid out below.",
    vector_direction: [1, 0, 0, 0, 0, 0, 0, 0],
    display_order: 2,
  },

  // --- Budget / Splurge (dim 1) ---
  {
    dimension: "budget_splurge",
    prompt: "Someone says you have to try one place before you leave.",
    option_a_label: "Street cart",
    option_a_description: "Plastic stool, paper plate, five dollars. Perfection.",
    option_b_label: "Tasting menu",
    option_b_description: "Seven courses, paired wines, a meal you'll talk about for years.",
    vector_direction: [0, 1, 0, 0, 0, 0, 0, 0],
    display_order: 3,
  },
  {
    dimension: "budget_splurge",
    prompt: "You're celebrating something. Dinner is on you.",
    option_a_label: "The local spot",
    option_a_description: "Cash only, family-run, portions meant for sharing.",
    option_b_label: "The reservation",
    option_b_description: "You booked this weeks ago. Jacket optional but you wore one.",
    vector_direction: [0, 1, 0, 0, 0, 0, 0, 0],
    display_order: 4,
  },

  // --- Solo / Social (dim 2) ---
  {
    dimension: "solo_social",
    prompt: "You've got a free afternoon in a neighborhood you love.",
    option_a_label: "Wander alone",
    option_a_description: "Headphones in, ducking into shops, no one to consult.",
    option_b_label: "Call someone",
    option_b_description: "This is better with company. You know exactly who.",
    vector_direction: [0, 0, 1, 0, 0, 0, 0, 0],
    display_order: 5,
  },
  {
    dimension: "solo_social",
    prompt: "You found an incredible little restaurant.",
    option_a_label: "Counter seat",
    option_a_description: "Just you and the chef. You don't even need conversation.",
    option_b_label: "Big table",
    option_b_description: "Bring everyone. Order the whole menu. Pass plates.",
    vector_direction: [0, 0, 1, 0, 0, 0, 0, 0],
    display_order: 6,
  },

  // --- Cautious / Adventurous (dim 3) ---
  {
    dimension: "cautious_adventurous",
    prompt: "The menu is entirely in a language you don't speak.",
    option_a_label: "Ask for a translation",
    option_a_description: "You'd rather know what you're getting into.",
    option_b_label: "Point at something",
    option_b_description: "Surprises are the whole point of being here.",
    vector_direction: [0, 0, 0, 1, 0, 0, 0, 0],
    display_order: 7,
  },
  {
    dimension: "cautious_adventurous",
    prompt: "A local insists you try something unusual.",
    option_a_label: "Politely pass",
    option_a_description: "You have a pretty good sense of what you enjoy.",
    option_b_label: "Try it blind",
    option_b_description: "That's what travel is for. Worst case, it's a story.",
    vector_direction: [0, 0, 0, 1, 0, 0, 0, 0],
    display_order: 8,
  },

  // --- Linger / Move (dim 4) ---
  {
    dimension: "linger_move",
    prompt: "You have one full day. No plans.",
    option_a_label: "One perfect spot",
    option_a_description: "Find a cafe. Stay for hours. Let the afternoon happen.",
    option_b_label: "Cover ground",
    option_b_description: "Three neighborhoods, four cafes, a museum. You'll rest later.",
    vector_direction: [0, 0, 0, 0, 1, 0, 0, 0],
    display_order: 9,
  },
  {
    dimension: "linger_move",
    prompt: "You find a beautiful square with a cafe and a view.",
    option_a_label: "Order a second coffee",
    option_a_description: "You could sit here all day and not be bored.",
    option_b_label: "Take a photo, keep walking",
    option_b_description: "There's so much more to see around the next corner.",
    vector_direction: [0, 0, 0, 0, 1, 0, 0, 0],
    display_order: 10,
  },

  // --- Morning / Night (dim 5) ---
  {
    dimension: "morning_night",
    prompt: "When does a city show you its real self?",
    option_a_label: "Early morning",
    option_a_description: "Bakers, empty streets, the light before anyone else is up.",
    option_b_label: "Late night",
    option_b_description: "After dark, when the locals come out and the tourists go to bed.",
    vector_direction: [0, 0, 0, 0, 0, 1, 0, 0],
    display_order: 11,
  },
  {
    dimension: "morning_night",
    prompt: "Your ideal first hour in a new place.",
    option_a_label: "Coffee and a pastry",
    option_a_description: "Jet lag is real. Find the best cafe within walking distance.",
    option_b_label: "Drinks and dinner",
    option_b_description: "Drop your bags and go. The city is waiting.",
    vector_direction: [0, 0, 0, 0, 0, 1, 0, 0],
    display_order: 12,
  },

  // --- Food-focused / Broad (dim 6) ---
  {
    dimension: "food_broad",
    prompt: "You're planning three days in a new city.",
    option_a_label: "Eating itinerary",
    option_a_description: "Breakfast, lunch, dinner, snacks. The food IS the trip.",
    option_b_label: "A bit of everything",
    option_b_description: "Museums, markets, a park, a neighborhood walk. Food fits in.",
    vector_direction: [0, 0, 0, 0, 0, 0, 1, 0],
    display_order: 13,
  },
  {
    dimension: "food_broad",
    prompt: "A friend asks what made the trip special.",
    option_a_label: "The meals",
    option_a_description: "That pasta, that bakery, that thing you ate standing up.",
    option_b_label: "The moments",
    option_b_description: "Getting lost, a sunset, a conversation with a stranger.",
    vector_direction: [0, 0, 0, 0, 0, 0, 1, 0],
    display_order: 14,
  },

  // --- Planned / Spontaneous (dim 7) ---
  {
    dimension: "planned_spontaneous",
    prompt: "You arrive somewhere for the first time.",
    option_a_label: "Check your list",
    option_a_description: "You've saved twelve places. You know exactly where to start.",
    option_b_label: "Start walking",
    option_b_description: "No plan. You'll know the right place when you see it.",
    vector_direction: [0, 0, 0, 0, 0, 0, 0, 1],
    display_order: 15,
  },
  {
    dimension: "planned_spontaneous",
    prompt: "How do you find the best places?",
    option_a_label: "Research",
    option_a_description: "Blogs, lists, asking friends. You come prepared.",
    option_b_label: "Stumble in",
    option_b_description: "The best places aren't on anyone's list. You just find them.",
    vector_direction: [0, 0, 0, 0, 0, 0, 0, 1],
    display_order: 16,
  },

  // --- Multi-dimension pairs ---
  {
    dimension: "budget_splurge+cautious_adventurous",
    prompt: "A taxi driver tells you about his favorite place to eat.",
    option_a_label: "The safe pick",
    option_a_description: "A well-known restaurant where you can read the menu first.",
    option_b_label: "His actual spot",
    option_b_description: "Down an alley, no sign, no English, incredible food. Maybe.",
    vector_direction: [0, 1, 0, 1, 0, 0, 0, 0],
    display_order: 17,
  },
  {
    dimension: "quiet_lively+solo_social",
    prompt: "Saturday night. You've been traveling for a week.",
    option_a_label: "Room service",
    option_a_description: "A book, something simple, your own company. Bliss.",
    option_b_label: "Ask the concierge",
    option_b_description: "Where are people going tonight? You want to be there.",
    vector_direction: [1, 0, 1, 0, 0, 0, 0, 0],
    display_order: 18,
  },
  {
    dimension: "linger_move+planned_spontaneous",
    prompt: "You wake up with no alarm in a city you're starting to love.",
    option_a_label: "Return to your favorite spot",
    option_a_description: "You've been thinking about that corner table since yesterday.",
    option_b_label: "Try somewhere new",
    option_b_description: "You saw a side street yesterday. Today you follow it.",
    vector_direction: [0, 0, 0, 0, 1, 0, 0, 1],
    display_order: 19,
  },
  {
    dimension: "morning_night+food_broad",
    prompt: "You have 24 hours left. What do you do first?",
    option_a_label: "Dawn at the market",
    option_a_description: "Watch the city wake up. Espresso. Fresh bread. Locals only.",
    option_b_label: "One last night out",
    option_b_description: "Gallery, dinner, bar, somewhere you haven't been yet.",
    vector_direction: [0, 0, 0, 0, 0, 1, 1, 0],
    display_order: 20,
  },
];

/**
 * The 7-pair quiz sequence — indices into SCENARIO_PAIRS.
 * Selected to cover all 8 dimensions with minimal redundancy.
 * Covers: [0]quiet/lively, [1]budget/splurge, [2]solo/social,
 *         [3]cautious/adventurous, [4]linger/move, [5]morning/night,
 *         [6]food/broad, [7]planned/spontaneous
 */
export const QUIZ_SEQUENCE_INDICES = [
  0,   // quiet_lively (dim 0)
  2,   // budget_splurge (dim 1)
  4,   // solo_social (dim 2)
  6,   // cautious_adventurous (dim 3)
  8,   // linger_move (dim 4)
  16,  // budget_splurge+cautious_adventurous (dims 1,3 — reinforces + covers cross-dim)
  19,  // morning_night+food_broad (dims 5,6 — covers remaining two)
] as const;

/** Get the 7 scenario pairs for the onboarding quiz, in order. */
export function getQuizPairs(): ScenarioPairData[] {
  return QUIZ_SEQUENCE_INDICES.map((i) => SCENARIO_PAIRS[i]);
}
