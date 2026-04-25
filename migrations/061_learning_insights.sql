-- Learner insights MVP tables
-- "Not big AI. Useful AI."

-- 1) Stored learner insights
CREATE TABLE IF NOT EXISTS public.learning_insights (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content_type    text        NOT NULL CHECK (content_type IN ('course','virtual_experience','assignment','event','system')),
  content_id      uuid,
  insight_type    text        NOT NULL CHECK (insight_type IN ('deadline_risk','stalled_progress','score_drop','assignment_follow_up','win')),
  severity        text        NOT NULL CHECK (severity IN ('info','warning','critical')),
  title           text        NOT NULL,
  message         text        NOT NULL,
  action_label    text,
  action_url      text,
  context         jsonb       NOT NULL DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed','done','expired')),
  dedupe_key      text        NOT NULL,
  source_run_date date        NOT NULL DEFAULT (now() at time zone 'utc')::date,
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_insights_dedupe UNIQUE (student_id, dedupe_key, source_run_date)
);

CREATE INDEX IF NOT EXISTS idx_learning_insights_student_status_created
  ON public.learning_insights(student_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_insights_active_valid_until
  ON public.learning_insights(status, valid_until);

CREATE INDEX IF NOT EXISTS idx_learning_insights_type
  ON public.learning_insights(insight_type, created_at DESC);

-- 2) Learner interaction log
CREATE TABLE IF NOT EXISTS public.learning_insight_actions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id  uuid        NOT NULL REFERENCES public.learning_insights(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  action      text        NOT NULL CHECK (action IN ('opened','dismissed','done','snoozed')),
  meta        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_insight_actions_insight
  ON public.learning_insight_actions(insight_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_insight_actions_student
  ON public.learning_insight_actions(student_id, created_at DESC);

-- 3) updated_at trigger
DROP TRIGGER IF EXISTS trg_learning_insights_updated_at ON public.learning_insights;
CREATE TRIGGER trg_learning_insights_updated_at
  BEFORE UPDATE ON public.learning_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) RLS
ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_insight_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "learning_insights: student read own" ON public.learning_insights;
CREATE POLICY "learning_insights: student read own"
  ON public.learning_insights FOR SELECT
  USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "learning_insights: student update own status" ON public.learning_insights;
CREATE POLICY "learning_insights: student update own status"
  ON public.learning_insights FOR UPDATE
  USING (student_id = (SELECT auth.uid()))
  WITH CHECK (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "learning_insight_actions: student insert own" ON public.learning_insight_actions;
CREATE POLICY "learning_insight_actions: student insert own"
  ON public.learning_insight_actions FOR INSERT
  WITH CHECK (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "learning_insight_actions: student read own" ON public.learning_insight_actions;
CREATE POLICY "learning_insight_actions: student read own"
  ON public.learning_insight_actions FOR SELECT
  USING (student_id = (SELECT auth.uid()));

