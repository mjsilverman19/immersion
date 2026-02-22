-- Backfill taste_vector for existing profiles based on their taste_preferences.
-- This is lossy but gives existing users an approximate vector so the new
-- matching engine has something to work with.
--
-- Mapping from vibe tags to the 8-dimension taste vector:
--   [0] Quiet(-) / Lively(+)
--   [1] Budget(-) / Splurge(+)
--   [2] Solo(-) / Social(+)
--   [3] Cautious(-) / Adventurous(+)
--   [4] Linger(-) / Move(+)
--   [5] Morning(-) / Night(+)
--   [6] Food-focused(-) / Broad(+)
--   [7] Planned(-) / Spontaneous(+)

-- We use a PL/pgSQL function to iterate and accumulate, then normalize.
DO $$
DECLARE
  r RECORD;
  vec float8[];
  tag text;
  mag float8;
BEGIN
  FOR r IN SELECT id, taste_preferences FROM profiles
           WHERE array_length(taste_preferences, 1) > 0
             AND (taste_vector IS NULL OR taste_vector = '{}')
  LOOP
    vec := ARRAY[0,0,0,0,0,0,0,0]::float8[];

    FOREACH tag IN ARRAY r.taste_preferences LOOP
      -- Dim 0: Quiet / Lively
      IF tag = 'quiet' THEN vec[1] := vec[1] - 1; END IF;
      IF tag = 'lively' THEN vec[1] := vec[1] + 1; END IF;

      -- Dim 1: Budget / Splurge
      IF tag IN ('no-frills', 'hole in the wall', 'cash only') THEN vec[2] := vec[2] - 1; END IF;
      IF tag IN ('splurge-worthy', 'reservations recommended') THEN vec[2] := vec[2] + 1; END IF;

      -- Dim 2: Solo / Social
      IF tag = 'go alone' THEN vec[3] := vec[3] - 1; END IF;
      IF tag IN ('group-friendly', 'date-worthy', 'people-watching') THEN vec[3] := vec[3] + 1; END IF;

      -- Dim 3: Cautious / Adventurous
      IF tag IN ('neighborhood staple', 'local institution') THEN vec[4] := vec[4] - 1; END IF;
      IF tag IN ('one-of-a-kind', 'off the beaten path') THEN vec[4] := vec[4] + 1; END IF;

      -- Dim 4: Linger / Move
      IF tag IN ('worth the wait', 'order everything') THEN vec[5] := vec[5] - 1; END IF;
      IF tag = 'off the beaten path' THEN vec[5] := vec[5] + 0.5; END IF;

      -- Dim 5: Morning / Night
      IF tag = 'morning ritual' THEN vec[6] := vec[6] - 1; END IF;
      IF tag = 'late night' THEN vec[6] := vec[6] + 1; END IF;

      -- Dim 6: Food-focused / Broad (default toward food for tag-based users)
      -- No direct mapping; leave at 0

      -- Dim 7: Planned / Spontaneous
      IF tag = 'reservations recommended' THEN vec[8] := vec[8] - 0.5; END IF;
      IF tag = 'off the beaten path' THEN vec[8] := vec[8] + 0.5; END IF;
    END LOOP;

    -- Normalize to unit length
    mag := sqrt(
      vec[1]*vec[1] + vec[2]*vec[2] + vec[3]*vec[3] + vec[4]*vec[4] +
      vec[5]*vec[5] + vec[6]*vec[6] + vec[7]*vec[7] + vec[8]*vec[8]
    );

    IF mag > 0 THEN
      FOR i IN 1..8 LOOP
        vec[i] := vec[i] / mag;
      END LOOP;
    END IF;

    UPDATE profiles
    SET taste_vector = vec,
        taste_vector_version = 1,
        onboarding_version = 1
    WHERE id = r.id;
  END LOOP;
END $$;
