# Immersion - Development Guide

## Project Overview

Social travel discovery platform. Users log places they visit (restaurants, cafes, bars, etc.), rate them, tag them, and share with others. Built with Next.js 14 App Router + Supabase + Tailwind.

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Database/Auth:** Supabase (PostgreSQL + Auth + RLS + Storage)
- **Styling:** Tailwind CSS
- **Maps:** Leaflet + react-leaflet@4 + OpenStreetMap
- **Hosting:** Vercel
- **APIs:** Google Places API (place search + enrichment)

## Critical Architecture Pattern: Server-Side Auth

**Client-side Supabase auth (`useAuth()`) does NOT work reliably for data operations.** The auth provider's `isLoading` state has timing issues that cause `user` and `profile` to be null when components try to read/write data.

### What Works

- **Server Components** for data fetching (use `createClient()` from `@/lib/supabase/server`)
- **API Routes** for mutations (use `createClient()` from `@/lib/supabase/server`)
- Both read auth from cookies, which are always available server-side

### What Does NOT Work

- **Client-side `createClient()` from `@/lib/supabase/client`** for database writes
- **`useAuth()` hook** for getting user ID before writes — `user` and `profile` can be null
- Direct Supabase client inserts/updates from client components

### Pattern to Follow

```
# For new pages that READ data:
# Use a Server Component (like city page, map page)

src/app/(main)/example/page.tsx        # Server component — fetches data
src/app/(main)/example/example-client.tsx  # Client component — renders UI

# For new features that WRITE data:
# Use an API Route

src/app/api/example/route.ts           # Server-side — handles auth + DB writes
src/components/example/ExampleForm.tsx  # Client-side — calls fetch("/api/example")
```

### Example: Adding a new write operation

Use the `authenticated()` helper from `@/lib/api/handler` — it handles auth, JSON parsing, and Zod validation:

```typescript
// 1. Add a Zod schema (src/lib/validation/schemas.ts)
export const createExampleSchema = z.object({
  name: z.string().min(1),
  value: z.number().optional(),
});

// 2. API Route (src/app/api/example/route.ts)
import { authenticated } from "@/lib/api/handler";
import { createExampleSchema } from "@/lib/validation/schemas";

export const POST = authenticated(createExampleSchema, async (user, supabase, body) => {
  // user is already verified, body is already validated
  const { error } = await supabase.from("examples").insert({ ...body, user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

// For routes that don't need a request body:
export const DELETE = authenticated(null, async (user, supabase, request) => {
  // ...
});

// 3. Client Component
const res = await fetch("/api/example", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "test" }),
});
```

**Do NOT** write manual auth boilerplate in API routes — always use `authenticated()`.

## Typed Query Results

All Supabase joined query results have typed interfaces in `src/lib/types/queries.ts`. **Do NOT use `as Record<string, unknown>` or inline `as` casts** — import the appropriate type instead.

```typescript
import type { LogWithPlace, ProfileWithCity } from "@/lib/types/queries";

const { data: logs } = await supabase.from("logs").select("*, places(*)");
// Use LogWithPlace[] instead of casting
```

When adding a new joined query pattern, add the interface to `queries.ts`.

## Parallel Queries in Server Components

When a server component makes multiple independent Supabase queries, use `Promise.all`:

```typescript
const [{ data: logs }, { data: lists }] = await Promise.all([
  supabase.from("logs").select("*").eq("user_id", id),
  supabase.from("lists").select("*").eq("user_id", id),
]);
```

## Client Component Rules

- **Never use `createClient()` in a `useEffect` dependency array** — it creates a new reference each render. Call it inside the effect or at module scope.
- **Never use `createClient()` from `@/lib/supabase/client` for writes** — use API routes instead.

## Taste Vector System

Immersion uses an 8-dimensional taste vector to match users with aligned locals and rank places.

### Dimensions
```
[0] Quiet(-) / Lively(+)
[1] Budget(-) / Splurge(+)
[2] Solo(-) / Social(+)
[3] Cautious(-) / Adventurous(+)
[4] Linger(-) / Move(+)
[5] Morning(-) / Night(+)
[6] Food-focused(-) / Broad(+)
[7] Planned(-) / Spontaneous(+)
```

### How it works
1. **Onboarding quiz** — 7 pairwise scenario questions (from 20 pairs), each probing 1-2 dimensions → produces an onboarding vector via `computeOnboardingVector()`
2. **Behavioral vector** — computed from log data (rating patterns, tags, categories) via `computeBehavioralVector()`
3. **Blended vector** — sigmoid-weighted blend that shifts from onboarding → behavioral as user logs more places (50/50 at ~10 logs, behavioral-dominant by ~20)
4. **Matching** — cosine similarity between blended vectors, mapped to 0-100% match score

### Key files
- `src/constants/scenarios.ts` — 20 scenario pairs, quiz sequence, dimension definitions
- `src/lib/taste-vector.ts` — vector computation, blending, cosine similarity
- `src/app/api/onboarding/route.ts` — processes quiz choices into taste vectors
- `src/app/api/discover/locals/route.ts` — taste-aligned local matching
- `src/app/api/discover/places/route.ts` — taste-weighted place ranking

### Confidence gating
Match percentages are only shown when enough data exists:
- **high** (20+ logs) — full match %
- **medium** (5-19 logs) — full match %
- **low** (3-4 logs) — full match %
- **new** (<3 logs) — shows "New local" instead of match %

## Known Issues / Technical Debt

### `useAuth()` hook limitations
The hook provides `{ user, profile, isLoading }` but:
- `isLoading` may never resolve to `false` in some edge cases
- `profile` requires a join with the cities table that can fail
- Don't rely on `isLoading` for conditional rendering — use server components instead

### Pre-existing type error
`src/app/(main)/place/[id]/log/page.tsx` passes `homeCityId` prop to `LogFormWrapper` but the prop isn't declared in `LogFormWrapperProps`. Not yet fixed.

## Project Structure

```
src/
  app/
    (auth)/          # Login, signup, onboarding (public)
    (main)/          # Protected pages (require auth via middleware)
      feed/          # Activity feed
      explore/       # Browse cities
      map/           # Global map view (server component + client map)
      log/           # Log a place (search + rate flow)
      profile/       # User profiles
      city/[slug]/   # City detail with map
      place/[id]/    # Place detail + log form
      list/[id]/     # List detail + edit
      lists/         # User's lists
      saved/         # Saved lists
      import/        # Google Takeout import
      error.tsx      # Error boundary for all (main) routes
      loading.tsx    # Loading state for all (main) routes
    api/
      logs/          # Create/update logs (server-side auth)
      lists/         # Create lists, update list by id
      saves/         # Save/unsave lists
      follows/       # Follow/unfollow users
      profile/       # Update profile, taste preferences
      discover/
        locals/      # Taste-aligned local matching
        places/      # Taste-weighted place ranking
      onboarding/    # Profile setup + taste quiz processing
      places/search/ # Hybrid search (local DB + Google Places)
      places/create-from-google/  # Create place from Google place_id
      import/takeout/             # Process Takeout file upload
      dev/           # Dev-only endpoints (reset-onboarding, etc.)
  components/
    layout/          # BottomNav (5 tabs: Feed, Explore, Log, My Map, Profile)
    city/            # LocalsLikeYou, RecommendedForYou (taste-matched locals + places)
    map/             # MapView, CityMap (Leaflet wrappers)
    place/           # PlaceSearch, PlaceCard, PlaceCardCompact, LogForm, TagSelector
    list/            # ListCard
    feed/            # FeedItem
    ui/              # Avatar, Button, FollowButton, SignOutButton, Toast, etc.
    import/          # TakeoutUpload
  lib/
    api/
      handler.ts     # authenticated() helper for API routes
    supabase/
      client.ts      # Browser Supabase client (reads only!)
      server.ts      # Server Supabase client (reads + writes)
      auth-provider.tsx  # React context for auth state (module-scope client)
      middleware.ts   # Route protection + onboarding guard
    taste-vector.ts  # Vector computation, blending, cosine similarity
    discover/        # Legacy recommendation engine + similarity scoring
    types/
      database.ts    # Supabase-generated types
      queries.ts     # Typed interfaces for joined query results
      google-places.ts # Google Places API response types
    validation/
      schemas.ts     # Zod schemas for all API request bodies
    import/          # Takeout parser + place resolver
  constants/
    tags.ts          # Place categories, tags, Google type mapping
    scenarios.ts     # 20 scenario pairs, quiz sequence, taste dimensions
```

## Database Schema (Key Tables)

- **profiles** — user profiles, FK to cities via home_city_id; includes `taste_vector` (float8[8]), `taste_vector_version`, `onboarding_version`
- **cities** — seeded cities with lat/lng
- **places** — locations with Google place data, category, coordinates
- **logs** — user ratings/reviews of places (unique per user+place)
- **lists** — curated place lists
- **list_items** — places in a list
- **follows** — social follows
- **saves** — saved lists
- **scenario_pairs** — 20 pairwise taste quiz questions with `vector_direction` arrays
- **onboarding_choices** — user quiz responses (FK to scenario_pairs + profiles)
- **place_saves** — bookmarked places (distinct from list saves)
- **notifications** — in-app notifications with type enum

All tables have RLS enabled. Logs/places are publicly readable. Writes require `auth.uid() = user_id`.

### Migrations
Migration files live in `supabase/migrations/`. Key migrations:
- `00010` — taste vector schema (new tables + profile columns)
- `00011` — seed scenario pairs data
- `00012` — backfill taste vectors from legacy taste_preferences

## Build & Deploy

```bash
npm run dev          # Local dev server
npx tsc --noEmit     # Type check (run before committing)
git push origin main # Auto-deploys to Vercel
```

## Environment Variables

Required in Vercel + `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_PLACES_API_KEY` (server-side only)

## Adding New Protected Routes

When adding a new route under `(main)/`:
1. Create the page in `src/app/(main)/your-route/page.tsx`
2. Add `request.nextUrl.pathname.startsWith("/your-route")` to `isMainRoute` in `src/lib/supabase/middleware.ts`

## Leaflet / Map Notes

- Leaflet requires `"use client"` and `next/dynamic` with `ssr: false`
- Use `CityMap` wrapper for server component pages (handles dynamic import)
- Use `MapView` directly in client components
- react-leaflet@4 (not v5 — v5 requires React 19)
