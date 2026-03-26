-- ============================================================
-- FestForms Notifications Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  form_id    uuid REFERENCES public.forms(id) ON DELETE CASCADE,
  type       text NOT NULL, -- 'response' | 'registration' | 'course_pass' | 'course_fail'
  title      text NOT NULL,
  body       text,
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id, created_at DESC);

-- 2. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications_own_read" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update (mark read) their own notifications
CREATE POLICY "notifications_own_update" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Trigger function inserts — runs as SECURITY DEFINER (bypasses RLS)
-- No client insert policy needed.

-- 3. Postgres trigger — fires on every new response
CREATE OR REPLACE FUNCTION public.create_response_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id      uuid;
  v_form_title   text;
  v_is_course    boolean;
  v_is_event     boolean;
  v_type         text;
  v_title        text;
  v_body         text;
  v_name         text;
  v_percentage   text;
BEGIN
  -- Look up form owner
  SELECT user_id,
         config->>'title',
         COALESCE((config->>'isCourse')::boolean, false),
         COALESCE((config->'eventDetails'->>'isEvent')::boolean, false)
  INTO v_user_id, v_form_title, v_is_course, v_is_event
  FROM public.forms
  WHERE id = NEW.form_id;

  -- No owner found — skip
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_name       := COALESCE(NEW.data->>'name', NEW.data->>'full_name', 'Someone');
  v_percentage := COALESCE(NEW.data->>'percentage', '');

  IF v_is_course THEN
    IF COALESCE((NEW.data->>'passed')::boolean, false) THEN
      v_type  := 'course_pass';
      v_title := v_name || ' passed your course';
      v_body  := v_form_title || CASE WHEN v_percentage <> '' THEN ' — ' || v_percentage || '%' ELSE '' END;
    ELSE
      v_type  := 'course_fail';
      v_title := v_name || ' completed your course';
      v_body  := v_form_title || CASE WHEN v_percentage <> '' THEN ' — ' || v_percentage || '%' ELSE '' END;
    END IF;
  ELSIF v_is_event THEN
    v_type  := 'registration';
    v_title := v_name || ' registered for your event';
    v_body  := v_form_title;
  ELSE
    v_type  := 'response';
    v_title := v_name || ' submitted a response';
    v_body  := v_form_title;
  END IF;

  INSERT INTO public.notifications (user_id, form_id, type, title, body)
  VALUES (v_user_id, NEW.form_id, v_type, v_title, v_body);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to responses table
DROP TRIGGER IF EXISTS on_response_insert ON public.responses;
CREATE TRIGGER on_response_insert
  AFTER INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.create_response_notification();
