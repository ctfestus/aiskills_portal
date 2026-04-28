-- ============================================================
-- Notifications Migration v2
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Create table if it does not exist yet ────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id    uuid,
  type       text        NOT NULL,
  title      text        NOT NULL,
  body       text,
  link       text,
  read       boolean     DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add link column if table already existed without it
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;

-- ── Helper: keep only the 4 most recent notifications per user ──
CREATE OR REPLACE FUNCTION public.trim_notifications(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id FROM public.notifications
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT 4
    );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trim_notifications(uuid) FROM PUBLIC;


-- ── 1. Instructor: new response / course submission / event registration ──

CREATE OR REPLACE FUNCTION public.create_response_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id    uuid;
  v_form_title  text;
  v_content_type text;  -- 'course' | 've' | 'event' | 'assignment' | 'other'
  v_type        text;
  v_title       text;
  v_body        text;
  v_name        text;
  v_pct         text;
BEGIN
  -- Check courses
  SELECT user_id, title INTO v_owner_id, v_form_title
  FROM public.courses WHERE id = NEW.form_id;
  IF v_owner_id IS NOT NULL THEN v_content_type := 'course'; END IF;

  -- Check virtual_experiences
  IF v_owner_id IS NULL THEN
    SELECT user_id, title INTO v_owner_id, v_form_title
    FROM public.virtual_experiences WHERE id = NEW.form_id;
    IF v_owner_id IS NOT NULL THEN v_content_type := 've'; END IF;
  END IF;

  -- Check events
  IF v_owner_id IS NULL THEN
    SELECT user_id, title INTO v_owner_id, v_form_title
    FROM public.events WHERE id = NEW.form_id;
    IF v_owner_id IS NOT NULL THEN v_content_type := 'event'; END IF;
  END IF;

  -- Check assignments
  IF v_owner_id IS NULL THEN
    SELECT user_id, title INTO v_owner_id, v_form_title
    FROM public.assignments WHERE id = NEW.form_id;
    IF v_owner_id IS NOT NULL THEN v_content_type := 'assignment'; END IF;
  END IF;

  IF v_owner_id IS NULL THEN RETURN NEW; END IF;

  v_name := COALESCE(NEW.data->>'name', NEW.data->>'full_name', 'Someone');
  v_pct  := COALESCE(NEW.data->>'percentage', '');

  IF v_content_type = 'course' THEN
    IF COALESCE((NEW.data->>'passed')::boolean, false) THEN
      v_type  := 'course_pass';
      v_title := v_name || ' passed your course';
      v_body  := v_form_title || CASE WHEN v_pct <> '' THEN ' - ' || v_pct || '%' ELSE '' END;
    ELSE
      v_type  := 'course_fail';
      v_title := v_name || ' completed your course';
      v_body  := v_form_title || CASE WHEN v_pct <> '' THEN ' - ' || v_pct || '%' ELSE '' END;
    END IF;
  ELSIF v_content_type = 've' THEN
    v_type  := 'course_pass';
    v_title := v_name || ' completed your virtual experience';
    v_body  := v_form_title;
  ELSIF v_content_type = 'event' THEN
    v_type  := 'registration';
    v_title := v_name || ' registered for your event';
    v_body  := v_form_title;
  ELSIF v_content_type = 'assignment' THEN
    v_type  := 'response';
    v_title := v_name || ' submitted an assignment';
    v_body  := v_form_title;
  ELSE
    v_type  := 'response';
    v_title := v_name || ' submitted a response';
    v_body  := v_form_title;
  END IF;

  INSERT INTO public.notifications (user_id, form_id, type, title, body)
  VALUES (v_owner_id, NEW.form_id, v_type, v_title, v_body);

  PERFORM public.trim_notifications(v_owner_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_response_insert ON public.responses;
CREATE TRIGGER on_response_insert
  AFTER INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.create_response_notification();


-- ── 2. Student: new announcement posted to their cohort ──

CREATE OR REPLACE FUNCTION public.notify_students_on_announcement()
RETURNS TRIGGER AS $$
DECLARE
  v_student record;
  v_title   text;
  v_body    text;
BEGIN
  v_title := 'New announcement: ' || NEW.title;
  v_body  := LEFT(REGEXP_REPLACE(NEW.content, '<[^>]+>', '', 'g'), 120);

  FOR v_student IN
    SELECT id FROM public.students
    WHERE
      (array_length(NEW.cohort_ids, 1) IS NULL OR NEW.cohort_ids = '{}')
      OR cohort_id = ANY(NEW.cohort_ids)
  LOOP
    INSERT INTO public.notifications (user_id, form_id, type, title, body, link)
    VALUES (v_student.id, NULL, 'response', v_title, v_body, '/student#announcements');
    PERFORM public.trim_notifications(v_student.id);
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_announcement_insert ON public.announcements;
CREATE TRIGGER on_announcement_insert
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_students_on_announcement();


-- ── 3. Student: assignment graded ──

CREATE OR REPLACE FUNCTION public.notify_student_on_grade()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body  text;
  v_asgn  text;
BEGIN
  IF NEW.status = 'graded' AND (OLD.status IS DISTINCT FROM 'graded') THEN
    SELECT title INTO v_asgn FROM public.assignments WHERE id = NEW.assignment_id;

    v_title := 'Your assignment has been graded';
    v_body  := COALESCE(v_asgn, 'Assignment')
               || CASE WHEN NEW.score IS NOT NULL THEN ' - Score: ' || NEW.score::text ELSE '' END;

    INSERT INTO public.notifications (user_id, form_id, type, title, body, link)
    VALUES (NEW.student_id, NULL, 'response', v_title, v_body, '/student#assignments');
    PERFORM public.trim_notifications(NEW.student_id);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_submission_graded ON public.assignment_submissions;
CREATE TRIGGER on_submission_graded
  AFTER UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_student_on_grade();


-- ── 4. Student: course completed ──

CREATE OR REPLACE FUNCTION public.notify_student_on_course_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_title  text;
  v_body   text;
  v_course text;
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    SELECT title INTO v_course FROM public.courses WHERE id = NEW.course_id;

    IF NEW.passed THEN
      v_title := 'You passed ' || COALESCE(v_course, 'a course') || '!';
      v_body  := CASE WHEN NEW.score IS NOT NULL THEN 'Score: ' || NEW.score::text || '%' ELSE 'Certificate available.' END;
    ELSE
      v_title := 'Course completed';
      v_body  := COALESCE(v_course, 'Course') || CASE WHEN NEW.score IS NOT NULL THEN ' - Score: ' || NEW.score::text || '%' ELSE '' END;
    END IF;

    INSERT INTO public.notifications (user_id, form_id, type, title, body, link)
    VALUES (
      NEW.student_id, NULL,
      CASE WHEN NEW.passed THEN 'course_pass' ELSE 'course_fail' END,
      v_title, v_body, '/student#courses'
    );
    PERFORM public.trim_notifications(NEW.student_id);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_course_completed ON public.course_attempts;
CREATE TRIGGER on_course_completed
  AFTER UPDATE ON public.course_attempts
  FOR EACH ROW EXECUTE FUNCTION public.notify_student_on_course_complete();


-- ── 5. Student: new course or VE assigned to their cohort ──

CREATE OR REPLACE FUNCTION public.notify_students_on_content_assign()
RETURNS TRIGGER AS $$
DECLARE
  v_student     record;
  v_title       text;
  v_body        text;
  v_new_cohorts uuid[];
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM 'published' AND NEW.status = 'published') THEN
    v_new_cohorts := NEW.cohort_ids;
  ELSE
    SELECT array_agg(c) INTO v_new_cohorts
    FROM unnest(NEW.cohort_ids) c
    WHERE c <> ALL(COALESCE(OLD.cohort_ids, '{}'));
  END IF;

  IF v_new_cohorts IS NULL OR array_length(v_new_cohorts, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'courses' THEN
    v_title := 'New course available: ' || NEW.title;
    v_body  := COALESCE(NEW.description, 'A new course has been assigned to you.');
  ELSIF TG_TABLE_NAME = 'virtual_experiences' THEN
    v_title := 'New virtual experience: ' || NEW.title;
    v_body  := COALESCE(NEW.description, 'A new virtual experience has been assigned to you.');
  END IF;

  FOR v_student IN
    SELECT id FROM public.students
    WHERE cohort_id = ANY(v_new_cohorts)
  LOOP
    INSERT INTO public.notifications (user_id, form_id, type, title, body, link)
    VALUES (v_student.id, NULL, 'response', v_title, LEFT(COALESCE(v_body, ''), 120), COALESCE('/' || NEW.slug, '/student'));
    PERFORM public.trim_notifications(v_student.id);
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_course_assign ON public.courses;
CREATE TRIGGER on_course_assign
  AFTER INSERT OR UPDATE OF cohort_ids, status ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.notify_students_on_content_assign();

DROP TRIGGER IF EXISTS on_ve_assign ON public.virtual_experiences;
CREATE TRIGGER on_ve_assign
  AFTER INSERT OR UPDATE OF cohort_ids, status ON public.virtual_experiences
  FOR EACH ROW EXECUTE FUNCTION public.notify_students_on_content_assign();


-- ── 6. Student: new assignment assigned to their cohort ──

CREATE OR REPLACE FUNCTION public.notify_students_on_assignment_assign()
RETURNS TRIGGER AS $$
DECLARE
  v_student     record;
  v_new_cohorts uuid[];
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' OR (OLD.status IS DISTINCT FROM 'published' AND NEW.status = 'published') THEN
    v_new_cohorts := NEW.cohort_ids;
  ELSE
    SELECT array_agg(c) INTO v_new_cohorts
    FROM unnest(NEW.cohort_ids) c
    WHERE c <> ALL(COALESCE(OLD.cohort_ids, '{}'));
  END IF;

  IF v_new_cohorts IS NULL OR array_length(v_new_cohorts, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_student IN
    SELECT id FROM public.students
    WHERE cohort_id = ANY(v_new_cohorts)
  LOOP
    INSERT INTO public.notifications (user_id, form_id, type, title, body, link)
    VALUES (
      v_student.id, NULL, 'response',
      'New assignment: ' || NEW.title,
      LEFT(COALESCE(NEW.scenario, NEW.brief, 'A new assignment has been assigned to you.'), 120),
      '/student#assignments'
    );
    PERFORM public.trim_notifications(v_student.id);
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_assignment_assign ON public.assignments;
CREATE TRIGGER on_assignment_assign
  AFTER INSERT OR UPDATE OF cohort_ids, status ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.notify_students_on_assignment_assign();
