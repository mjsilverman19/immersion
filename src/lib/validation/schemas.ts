import { z } from "zod";

export const createLogSchema = z.object({
  place_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string()).default([]),
  vibe_tags: z.array(z.string()).default([]),
  review: z.string().nullish().transform((v) => v || null),
  is_local_log: z.boolean().default(false),
});

export const createListSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullish().transform((v) => v || null),
  city_id: z.string().uuid().nullish().transform((v) => v || null),
  is_public: z.boolean().default(true),
  items: z
    .array(
      z.object({
        place_id: z.string().uuid(),
        note: z.string().nullish().transform((v) => v || null),
      })
    )
    .default([]),
});

export const updateListSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().nullish().transform((v) => v || null),
  city_id: z.string().uuid().nullish().transform((v) => v || null),
  items: z
    .array(
      z.object({
        place_id: z.string().uuid(),
        note: z.string().nullish().transform((v) => v || null),
      })
    )
    .optional(),
});

export const onboardingSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(
      /^[a-z0-9_]+$/,
      "Lowercase letters, numbers, and underscores only"
    ),
  display_name: z.string().max(100).nullish().transform((v) => v || null),
  home_city_id: z.string().uuid().nullish().transform((v) => v || null),
  avatar_url: z.string().url().nullish().transform((v) => v || null),
  taste_preferences: z.array(z.string()).default([]),
  category_preferences: z.array(z.string()).default([]),
});

export const updateProfileSchema = z.object({
  display_name: z.string().max(100).nullish().transform((v) => v || null),
  bio: z.string().max(500).nullish().transform((v) => v || null),
  home_city_id: z.string().uuid().nullish().transform((v) => v || null),
  avatar_url: z.string().url().nullish().transform((v) => v || null),
});

export const tastePreferencesSchema = z.object({
  taste_preferences: z.array(z.string()),
  category_preferences: z.array(z.string()).optional(),
});

export const saveSchema = z.object({
  list_id: z.string().uuid(),
});

export const createFromGoogleSchema = z.object({
  google_place_id: z.string().min(1),
});

export const savePlaceSchema = z.object({
  place_id: z.string().uuid(),
  source_user_id: z.string().uuid().nullish().transform((v) => v || null),
});

export const unsavePlaceSchema = z.object({
  place_id: z.string().uuid(),
});
