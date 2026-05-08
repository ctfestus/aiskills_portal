-- ── 085_badges_category ─────────────────────────────────────────────────────
-- Adds category column to badges so badges can be grouped by type.
-- Categories: achievement | course | learning_path | virtual_experience

ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'achievement';

-- Existing badges are achievements
UPDATE public.badges
  SET category = 'achievement'
  WHERE id IN ('course_5','course_10','course_25','streak_7','streak_14','streak_30','streak_90','streak_180','streak_365');
