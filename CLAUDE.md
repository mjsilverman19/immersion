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

```typescript
// API Route (src/app/api/example/route.ts)
import { createClient } from "@/lib/supabase/server";
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ... do the write with user.id
}

// Client Component
const res = await fetch("/api/example", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
});
```

## Known Issues / Technical Debt

### Client-side write components (need migration to API routes)
These files still use client-side Supabase for writes and may fail:
- `src/app/(main)/profile/[username]/edit/page.tsx` — profile updates
- `src/app/(main)/list/[id]/edit/page.tsx` — list editing
- `src/app/(main)/lists/new/page.tsx` — creating new lists
- `src/app/(main)/list/[id]/SaveButton.tsx` — saving/unsaving lists
- `src/components/ui/AvatarUpload.tsx` — avatar upload to storage

### `useAuth()` hook limitations
The hook provides `{ user, profile, isLoading }` but:
- `isLoading` may never resolve to `false` in some edge cases
- `profile` requires a join with the cities table that can fail
- Don't rely on `isLoading` for conditional rendering — use server components instead

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
      import/        # Google Takeout import
    api/
      logs/          # Create/update logs (server-side auth)
      places/search/ # Hybrid search (local DB + Google Places)
      places/create-from-google/  # Create place from Google place_id
      import/takeout/             # Process Takeout file upload
  components/
    layout/          # BottomNav, etc.
    map/             # MapView, CityMap (Leaflet wrappers)
    place/           # PlaceSearch, PlaceCard, LogForm, TagSelector
    list/            # ListCard
    feed/            # FeedItem
    ui/              # Avatar, Toast, CitySelector, etc.
    import/          # TakeoutUpload
  lib/
    supabase/
      client.ts      # Browser Supabase client (reads only!)
      server.ts      # Server Supabase client (reads + writes)
      auth-provider.tsx  # React context for auth state
      middleware.ts   # Route protection
    types/
      database.ts    # Supabase-generated types
    import/          # Takeout parser + place resolver
  constants/
    tags.ts          # Place categories, tags, Google type mapping
```

## Database Schema (Key Tables)

- **profiles** — user profiles, FK to cities via home_city_id
- **cities** — seeded cities with lat/lng
- **places** — locations with Google place data, category, coordinates
- **logs** — user ratings/reviews of places (unique per user+place)
- **lists** — curated place lists
- **list_items** — places in a list
- **follows** — social follows
- **saves** — saved lists

All tables have RLS enabled. Logs/places are publicly readable. Writes require `auth.uid() = user_id`.

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
