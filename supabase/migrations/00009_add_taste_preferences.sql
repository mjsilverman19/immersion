-- Add taste preference columns to profiles for onboarding cold-start signal
ALTER TABLE profiles ADD COLUMN taste_preferences text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN category_preferences text[] DEFAULT '{}';

-- Add vibe_tags column to logs for the new universal tag system
ALTER TABLE logs ADD COLUMN vibe_tags text[] DEFAULT '{}';
