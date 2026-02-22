/**
 * Typed interfaces for joined query results.
 * Import these instead of using inline `as Record<string, unknown>` casts.
 */

import type { Place, Log, List, ListItem, City, Profile, ScenarioPair, Notification } from "./database";

// ── Profile types ──

/** Profile with its home city */
export interface ProfileWithCity extends Profile {
  city: City | null;
}

/** Profile with home city coordinates only — used on map page */
export interface ProfileWithCityCoords extends Profile {
  city: Pick<City, "latitude" | "longitude"> | null;
}

// ── Log types ──

/** Log with its nested place (and that place's city name) */
export interface LogWithPlace extends Log {
  place: Place & { city: Pick<City, "name"> | null } | null;
}

/** Log with nested place (full) — used on map page, uses "places" alias */
export interface LogWithPlaceFull extends Log {
  places: Place | null;
}

/** Log with place category — used in discover/similarity */
export interface LogWithPlaceCategory {
  place_id: string;
  rating: number;
  tags: string[];
  vibe_tags: string[];
  places: Pick<Place, "category"> | null;
}

/** Log with profile + place for discover/places scoring */
export interface DiscoverLog {
  id: string;
  user_id: string;
  place_id: string;
  rating: number;
  tags: string[];
  vibe_tags: string[];
  is_local_log: boolean;
  profiles: Pick<Profile, "home_city_id"> | null;
  places: Pick<Place, "category" | "city_id"> | null;
}

/** Place detail page: log with author profile */
export interface LogWithProfile extends Log {
  profiles: Pick<Profile, "username" | "display_name" | "avatar_url"> | null;
}

/** Feed log (client-side) — log with profile + place + city via aliases */
export interface FeedLogRow extends Log {
  profiles: Pick<Profile, "username" | "display_name" | "avatar_url"> | null;
  places: (Pick<Place, "id" | "name" | "category"> & {
    city: Pick<City, "name"> | null;
  }) | null;
}

// ── Place types ──

/** Place with its resolved city */
export interface PlaceWithCity extends Place {
  city: Pick<City, "name" | "country"> | null;
}

// ── List types ──

/** List item with nested place (full) — used on map page and list detail */
export interface ListItemWithPlaceFull extends ListItem {
  place: Place;
}

/** List item with nested place (full) — uses "places" alias from .select("*, places(*)") */
export interface ListItemWithPlaces extends ListItem {
  places: Place | null;
}

/** List item with place photo_urls — used for profile page list thumbnails */
export interface ListItemWithPlacePhotos {
  id: string;
  place: Pick<Place, "photo_urls"> | null;
}

/** List with its items (for profile page) */
export interface ListWithItems extends List {
  list_items: ListItemWithPlacePhotos[];
}

/** List with author and city — used on city page and list detail */
export interface ListWithAuthor extends List {
  profiles: Pick<Profile, "username" | "display_name" | "avatar_url"> | null;
  city: Pick<City, "name"> | null;
}

/** Save with nested list, author, city, and items — used on saved page */
export interface SaveWithList {
  list: (List & {
    profiles: Pick<Profile, "username" | "display_name" | "avatar_url"> | null;
    city: Pick<City, "name"> | null;
    list_items: { id: string }[];
  }) | null;
}

// ── Taste vector / matching types ──

/** Scenario pair with the user's choice (if any) */
export type ScenarioPairWithChoice = ScenarioPair & {
  user_choice?: {
    chose_b: boolean;
    position: number;
  } | null;
};

/** Notification with actor profile joined */
export type NotificationWithActor = Notification & {
  actor: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
};

/** Taste match result — profile + similarity score */
export interface TasteMatch {
  profile: ProfileWithCity;
  similarity: number;
}

/** Place save with place + source user joined */
export interface PlaceSaveWithDetails {
  user_id: string;
  place_id: string;
  source_user_id: string | null;
  created_at: string;
  place: Place;
  source_user: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
}
