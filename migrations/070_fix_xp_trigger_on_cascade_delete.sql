-- 070_fix_xp_trigger_on_cascade_delete.sql
--
-- When an auth user is deleted, PostgreSQL cascades to students, then to
-- course_attempts. The AFTER DELETE trigger on course_attempts calls
-- recalc_student_xp(), which tries to upsert into student_xp using a FK
-- back to students -- but that row is already gone. This causes a FK
-- violation and blocks the whole deletion.
--
-- Fix: bail out early if the student row no longer exists.

CREATE OR REPLACE FUNCTION public.recalc_student_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := COALESCE(NEW.student_id, OLD.student_id);

  -- Student row is already gone (cascade delete in progress) -- nothing to update
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.student_xp (student_id, total_xp, updated_at)
  SELECT
    v_id,
    COALESCE((
      SELECT SUM(course_xp) FROM (
        SELECT
          course_id,
          CASE
            WHEN MAX(CASE WHEN passed = true THEN 1 ELSE 0 END) = 1
              THEN MAX(CASE WHEN passed = true THEN points ELSE 0 END)
            ELSE (
              SELECT points FROM public.course_attempts ca2
              WHERE  ca2.student_id = v_id AND ca2.course_id = ca.course_id
              ORDER  BY started_at DESC LIMIT 1
            )
          END AS course_xp
        FROM   public.course_attempts ca
        WHERE  ca.student_id = v_id
        GROUP  BY course_id
      ) sub
    ), 0),
    now()
  ON CONFLICT (student_id) DO UPDATE
    SET total_xp   = EXCLUDED.total_xp,
        updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;
