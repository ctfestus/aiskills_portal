-- Persist the complete course point settings, not only enabled/base points.
-- Existing courses are backfilled with the current player runtime defaults so
-- time/streak bonuses keep behaving the way students already see them.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS points_system jsonb NOT NULL DEFAULT '{
    "enabled": false,
    "basePoints": 100,
    "timeBonusEnabled": true,
    "timeBonusSeconds": 10,
    "timeBonusMultiplier": 1.5,
    "streakEnabled": true,
    "streakCount": 3,
    "streakBonus": 0,
    "hintPenalty": 20,
    "solutionPenalty": 30,
    "milestones": []
  }'::jsonb;

UPDATE public.courses
SET points_system = jsonb_build_object(
  'enabled',             COALESCE(points_enabled, false),
  'basePoints',          COALESCE(points_base, 100),
  'timeBonusEnabled',    COALESCE((points_system->>'timeBonusEnabled')::boolean, true),
  'timeBonusSeconds',    COALESCE((points_system->>'timeBonusSeconds')::integer, 10),
  'timeBonusMultiplier', COALESCE((points_system->>'timeBonusMultiplier')::numeric, 1.5),
  'streakEnabled',       COALESCE((points_system->>'streakEnabled')::boolean, true),
  'streakCount',         COALESCE((points_system->>'streakCount')::integer, 3),
  'streakBonus',         COALESCE((points_system->>'streakBonus')::integer, 0),
  'hintPenalty',         COALESCE((points_system->>'hintPenalty')::integer, 20),
  'solutionPenalty',     COALESCE((points_system->>'solutionPenalty')::integer, 30),
  'milestones',          COALESCE(points_system->'milestones', '[]'::jsonb)
);
