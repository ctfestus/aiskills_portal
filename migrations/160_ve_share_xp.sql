-- 160: virtual-experience LinkedIn shares pay XP.
--
-- Until now student_xp came from course_attempts alone, so a VE awarded nothing for anything. Rather
-- than give guided_project_attempts its own points column and a second best-attempt rule, the claim
-- registry is the source: linkedin_shares already records one row per verified share, with a points
-- snapshot, a content_type, and the uniqueness constraints that make a plain SUM safe.
--
-- Global XP is now:
--
--     SUM(best points per course, from course_attempts)
--   + SUM(points from VE LinkedIn share claims)
--
-- THE content_type FILTER IS LOAD-BEARING. A course share's bonus is already folded into
-- course_attempts.points by lib/attempt-points.ts. Summing the whole table would count every course
-- share twice and silently inflate every affected student's total. Only 'virtual_experience' rows
-- may be added here.
--
-- Why SUM and not MAX, when courses need MAX: a course can be retaken indefinitely and each attempt
-- carries its own points, so the best one has to be picked. Shares cannot be farmed --
-- linkedin_shares_slot_unique allows one claim per (student, content, item), and
-- linkedin_shares_post_key_unique means a given post is claimable exactly once by exactly one person,
-- ever. Correcting a link updates the existing row rather than inserting another. So each VE share
-- can contribute its points once, and retaking the VE cannot earn it again.
--
-- Historical claims are grandfathered at zero, deliberately. Every VE claim written before this
-- migration stored points = 0, because VE shares carried no XP. The recompute below therefore does
-- not move anyone's total. Reconstructing what those students "would have" been offered is guesswork
-- -- the requirement had no configured amount at the time -- so they keep zero. A claim always keeps
-- the amount that was on offer when it was made; an instructor raising the bonus later affects
-- future claims only, which falls out of storing the snapshot on the row rather than reading the
-- live config at aggregation time.

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
      SELECT SUM(best_points) FROM (
        SELECT MAX(points) AS best_points
        FROM   public.course_attempts ca
        WHERE  ca.student_id = v_id
        GROUP  BY ca.course_id
      ) sub
    ), 0)
    + COALESCE((
      SELECT SUM(ls.points)
      FROM   public.linkedin_shares ls
      WHERE  ls.student_id = v_id
        AND  ls.content_type = 'virtual_experience'
    ), 0),
    now()
  ON CONFLICT (student_id) DO UPDATE
    SET total_xp   = EXCLUDED.total_xp,
        updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_student_xp ON public.course_attempts;
CREATE TRIGGER trg_recalc_student_xp
  AFTER INSERT OR UPDATE OR DELETE ON public.course_attempts
  FOR EACH ROW EXECUTE FUNCTION public.recalc_student_xp();

-- The claim table now feeds XP, so it needs the trigger too -- otherwise a share would not show up
-- until some unrelated course write happened to fire the other trigger.
--
-- All three operations, even though the claim path upserts: UPDATE covers a student correcting their
-- link (same row, and a changed points snapshot must be reflected), and DELETE covers a claim being
-- removed administratively or cascading when a student is deleted. Leaving DELETE out would strand
-- XP for a share that no longer exists.
DROP TRIGGER IF EXISTS trg_recalc_student_xp_shares ON public.linkedin_shares;
CREATE TRIGGER trg_recalc_student_xp_shares
  AFTER INSERT OR UPDATE OR DELETE ON public.linkedin_shares
  FOR EACH ROW EXECUTE FUNCTION public.recalc_student_xp();

-- Recompute everyone under the new formula. This is a no-op for existing data by design: every VE
-- claim written before this migration has points = 0, so the added term contributes nothing. It runs
-- anyway so the stored totals are known to match the function that now maintains them.
INSERT INTO public.student_xp (student_id, total_xp, updated_at)
SELECT s.id,
       COALESCE((
         SELECT SUM(best_points) FROM (
           SELECT MAX(points) AS best_points
           FROM   public.course_attempts ca
           WHERE  ca.student_id = s.id
           GROUP  BY ca.course_id
         ) sub
       ), 0)
       + COALESCE((
         SELECT SUM(ls.points)
         FROM   public.linkedin_shares ls
         WHERE  ls.student_id = s.id
           AND  ls.content_type = 'virtual_experience'
       ), 0),
       now()
FROM public.students s
ON CONFLICT (student_id) DO UPDATE
  SET total_xp   = EXCLUDED.total_xp,
      updated_at = now();
