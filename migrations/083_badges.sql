-- ── 083_badges ─────────────────────────────────────────────────────────────
-- Tables  : badges, student_badges, student_streaks
-- Triggers: streak on students.last_login_at, badges on course_attempts + student_streaks

-- Badge definitions table
CREATE TABLE IF NOT EXISTS public.badges (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  description text        NOT NULL,
  icon        text        NOT NULL,
  color       text        NOT NULL DEFAULT '#6366f1'
);

-- Clear and reseed badge definitions
DELETE FROM public.badges;

INSERT INTO public.badges (id, name, description, icon, color) VALUES
  -- Course milestones
  ('course_5',    '5 Course Milestone',    'Earned after completing 5 courses on the platform',         '🥉', '#3b82f6'),
  ('course_10',   '10 Course Milestone',   'Earned after completing 10 courses',                        '🥈', '#f59e0b'),
  ('course_25',   '25 Course Milestone',   'Earned after completing 25 courses on the platform',        '🥇', '#ef4444'),
  -- Streak milestones
  ('streak_7',    '7-Day Learning Streak', 'Awarded for a 7-day consecutive learning streak',           '🔥', '#f97316'),
  ('streak_14',   '14-Day Learning Streak','Awarded for a 14-day continuous learning streak',           '⚡', '#eab308'),
  ('streak_30',   '30-Day Learning Streak','Awarded for maintaining a 30-day continuous learning streak','🌟', '#8b5cf6'),
  ('streak_90',   '90-Day Learning Streak','Awarded for maintaining a 90-day learning streak',          '💎', '#6366f1'),
  ('streak_180',  '180-Day Learning Streak','Awarded for maintaining a 180-day learning streak',        '👑', '#10b981'),
  ('streak_365',  '365-Day Learning Streak','Awarded for maintaining a full-year learning streak',      '🏆', '#7c3aed');

-- Earned badges per student (one row per badge, unique)
CREATE TABLE IF NOT EXISTS public.student_badges (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  badge_id   text        NOT NULL REFERENCES public.badges(id),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, badge_id)
);

-- Daily login streak per student
CREATE TABLE IF NOT EXISTS public.student_streaks (
  student_id         uuid    PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  current_streak     integer NOT NULL DEFAULT 0,
  longest_streak     integer NOT NULL DEFAULT 0,
  last_activity_date date,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.badges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges_public_read"               ON public.badges;
DROP POLICY IF EXISTS "student_badges_own_read"          ON public.student_badges;
DROP POLICY IF EXISTS "student_badges_instructor_read"   ON public.student_badges;
DROP POLICY IF EXISTS "student_streaks_own_read"         ON public.student_streaks;
DROP POLICY IF EXISTS "student_streaks_instructor_read"  ON public.student_streaks;

CREATE POLICY "badges_public_read"
  ON public.badges FOR SELECT USING (true);

CREATE POLICY "student_badges_own_read"
  ON public.student_badges FOR SELECT
  USING (student_id = (SELECT auth.uid()));

CREATE POLICY "student_badges_instructor_read"
  ON public.student_badges FOR SELECT
  USING ((SELECT public.is_instructor_or_admin()));

CREATE POLICY "student_streaks_own_read"
  ON public.student_streaks FOR SELECT
  USING (student_id = (SELECT auth.uid()));

CREATE POLICY "student_streaks_instructor_read"
  ON public.student_streaks FOR SELECT
  USING ((SELECT public.is_instructor_or_admin()));

-- ── Streak update: fires when students.last_login_at changes ─────────────
CREATE OR REPLACE FUNCTION public.update_student_streak()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last_date date;
  v_today     date := CURRENT_DATE;
  v_current   integer;
  v_longest   integer;
BEGIN
  IF NEW.last_login_at IS NOT DISTINCT FROM OLD.last_login_at THEN
    RETURN NEW;
  END IF;

  SELECT last_activity_date, current_streak, longest_streak
    INTO v_last_date, v_current, v_longest
    FROM public.student_streaks
    WHERE student_id = NEW.id;

  IF NOT FOUND THEN
    INSERT INTO public.student_streaks (student_id, current_streak, longest_streak, last_activity_date)
    VALUES (NEW.id, 1, 1, v_today);
    RETURN NEW;
  END IF;

  -- Already logged in today: no change
  IF v_last_date = v_today THEN
    RETURN NEW;
  -- Consecutive day: extend streak
  ELSIF v_last_date = v_today - 1 THEN
    v_current := v_current + 1;
    v_longest := GREATEST(v_longest, v_current);
  -- Gap: reset streak
  ELSE
    v_current := 1;
  END IF;

  UPDATE public.student_streaks
    SET current_streak     = v_current,
        longest_streak     = v_longest,
        last_activity_date = v_today,
        updated_at         = now()
    WHERE student_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_student_streak ON public.students;
CREATE TRIGGER trg_update_student_streak
  AFTER UPDATE OF last_login_at ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_student_streak();

-- ── Badge award function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_completed integer;
  v_streak    integer;
BEGIN
  -- Count completed courses
  SELECT COUNT(*) INTO v_completed
    FROM public.course_attempts
    WHERE student_id = p_student_id AND completed_at IS NOT NULL;

  -- Get current login streak
  SELECT COALESCE(current_streak, 0) INTO v_streak
    FROM public.student_streaks WHERE student_id = p_student_id;

  -- Course milestone badges
  IF v_completed >= 5   THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'course_5')    ON CONFLICT DO NOTHING; END IF;
  IF v_completed >= 10  THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'course_10')   ON CONFLICT DO NOTHING; END IF;
  IF v_completed >= 25  THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'course_25')   ON CONFLICT DO NOTHING; END IF;

  -- Streak badges
  IF v_streak >= 7   THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'streak_7')   ON CONFLICT DO NOTHING; END IF;
  IF v_streak >= 14  THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'streak_14')  ON CONFLICT DO NOTHING; END IF;
  IF v_streak >= 30  THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'streak_30')  ON CONFLICT DO NOTHING; END IF;
  IF v_streak >= 90  THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'streak_90')  ON CONFLICT DO NOTHING; END IF;
  IF v_streak >= 180 THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'streak_180') ON CONFLICT DO NOTHING; END IF;
  IF v_streak >= 365 THEN INSERT INTO public.student_badges (student_id, badge_id) VALUES (p_student_id, 'streak_365') ON CONFLICT DO NOTHING; END IF;
END;
$$;

-- Trigger wrapper for course_attempts
CREATE OR REPLACE FUNCTION public.trg_check_badges()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.check_and_award_badges(COALESCE(NEW.student_id, OLD.student_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_check_badges_on_attempt ON public.course_attempts;
CREATE TRIGGER trg_check_badges_on_attempt
  AFTER INSERT OR UPDATE ON public.course_attempts
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_badges();

-- Trigger wrapper for student_streaks (re-checks streak badges after each login)
CREATE OR REPLACE FUNCTION public.trg_check_badges_on_streak()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.check_and_award_badges(NEW.student_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_badges_on_streak ON public.student_streaks;
CREATE TRIGGER trg_check_badges_on_streak
  AFTER INSERT OR UPDATE ON public.student_streaks
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_badges_on_streak();
