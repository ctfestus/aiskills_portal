-- 151: group discussion forum for group assignments (threaded topics + replies).
--
-- Replaces the WhatsApp-link/workspace with an in-app, group-members-only forum. Two levels:
-- a THREAD (topic, with an opening post) and POSTS (replies). Enforcement lives in the DB, not just
-- the API, so a student hitting these tables directly with their anon key is still constrained:
--
--   * RLS restricts every row to members of a PUBLISHED assignment whose group_ids include THAT group
--     (all three checked via can_access_group_forum, which uses my_group_ids() to avoid the
--     group_members RLS recursion this repo previously fixed). Instructors/staff get NO access.
--   * Members edit/soft-delete only their OWN posts; a thread can be soft-deleted only while nobody
--     else has replied (enforced by a trigger, so even a direct client cannot erase others' replies).
--   * Identity columns are immutable after insert; author_id is nullable ON DELETE SET NULL so a
--     discussion survives a student deletion.
--   * updated_at is bumped on every write, so incremental polling by (updated_at, id) sees edits and
--     soft-deletions, not just new rows. last_post_at is recomputed on every post write (so deleting
--     the newest reply moves the thread's ordering back correctly).
--   * create_group_thread() inserts the thread AND its opening post in one transaction (no orphans).
--   * Platform admins have NO row access; an out-of-band admin read path logs to the access-log table.

-- ============================== Tables ==============================
CREATE TABLE IF NOT EXISTS public.assignment_group_threads (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id uuid        NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  group_id      uuid        NOT NULL REFERENCES public.groups(id)      ON DELETE CASCADE,
  author_id     uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_post_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE IF NOT EXISTS public.assignment_group_posts (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id  uuid        NOT NULL REFERENCES public.assignment_group_threads(id) ON DELETE CASCADE,
  author_id  uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Admin abuse backstop: forum rows are members-only in RLS, so an admin read goes through a
-- service-role route that records the access here. No instructor access anywhere.
CREATE TABLE IF NOT EXISTS public.assignment_group_forum_access_log (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  assignment_id uuid        NOT NULL,
  group_id      uuid        NOT NULL,
  accessed_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================== Indexes ==============================
CREATE INDEX IF NOT EXISTS idx_agt_group_activity ON public.assignment_group_threads (assignment_id, group_id, last_post_at DESC);
CREATE INDEX IF NOT EXISTS idx_agt_author         ON public.assignment_group_threads (author_id);
CREATE INDEX IF NOT EXISTS idx_agp_thread_created ON public.assignment_group_posts (thread_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_agp_thread_updated ON public.assignment_group_posts (thread_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_agp_author         ON public.assignment_group_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_agfal_group        ON public.assignment_group_forum_access_log (assignment_id, group_id, accessed_at DESC);

-- ============================== Access helper (RLS) ==============================
-- Caller is a group member AND the assignment is published AND that group is one of its group_ids.
-- SECURITY DEFINER + my_group_ids() (itself SECURITY DEFINER) sidesteps group_members RLS recursion.
CREATE OR REPLACE FUNCTION public.can_access_group_forum(p_assignment_id uuid, p_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_group_id = ANY(public.my_group_ids())
     AND EXISTS (
       SELECT 1 FROM public.assignments a
       WHERE a.id = p_assignment_id
         AND a.status = 'published'
         AND p_group_id = ANY(a.group_ids)
     );
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_group_forum(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.can_access_group_forum(uuid, uuid) TO authenticated;

-- ============================== Atomic thread creation ==============================
-- Called by the server route (service role) with the authenticated user's id as p_author_id. Runs
-- the thread + opening-post inserts in ONE transaction, and re-derives the ancestry check from the
-- DB (published + group in group_ids + membership) rather than trusting the caller. Does not use
-- auth.uid() because the route runs under the service role.
CREATE OR REPLACE FUNCTION public.create_group_thread(
  p_assignment_id uuid,
  p_group_id      uuid,
  p_author_id     uuid,
  p_title         text,
  p_body          text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title  text := btrim(coalesce(p_title, ''));
  v_body   text := btrim(coalesce(p_body, ''));
  v_thread public.assignment_group_threads;
  v_post   public.assignment_group_posts;
BEGIN
  IF char_length(v_title) = 0 OR char_length(v_body) = 0 THEN
    RAISE EXCEPTION 'empty_content';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = p_assignment_id AND a.status = 'published' AND p_group_id = ANY(a.group_ids)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm WHERE gm.group_id = p_group_id AND gm.student_id = p_author_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.assignment_group_threads (assignment_id, group_id, author_id, title)
  VALUES (p_assignment_id, p_group_id, p_author_id, left(v_title, 200))
  RETURNING * INTO v_thread;

  INSERT INTO public.assignment_group_posts (thread_id, author_id, body)
  VALUES (v_thread.id, p_author_id, left(v_body, 4000))
  RETURNING * INTO v_post;

  RETURN jsonb_build_object('thread', to_jsonb(v_thread), 'post', to_jsonb(v_post));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_group_thread(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_group_thread(uuid, uuid, uuid, text, text) TO service_role;

-- ============================== Triggers ==============================
-- Posts: stamp updated_at on every write; keep identity columns immutable (author_id may only be
-- cleared to NULL by the ON DELETE SET NULL cascade, never repointed).
CREATE OR REPLACE FUNCTION public.agp_before_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.thread_id  IS DISTINCT FROM OLD.thread_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR (NEW.author_id IS DISTINCT FROM OLD.author_id AND NEW.author_id IS NOT NULL) THEN
      RAISE EXCEPTION 'immutable_columns';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agp_before_write ON public.assignment_group_posts;
CREATE TRIGGER trg_agp_before_write BEFORE INSERT OR UPDATE ON public.assignment_group_posts
  FOR EACH ROW EXECUTE FUNCTION public.agp_before_write();

-- Posts: after any write, recompute the parent thread's last_post_at from surviving posts, so a new
-- reply advances ordering and deleting the newest reply moves it back (falls back to the thread's
-- own created_at when nothing survives).
CREATE OR REPLACE FUNCTION public.agp_after_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.assignment_group_threads t
  SET last_post_at = COALESCE(
        (SELECT max(p.created_at) FROM public.assignment_group_posts p
          WHERE p.thread_id = t.id AND p.deleted_at IS NULL),
        t.created_at)
  WHERE t.id = NEW.thread_id;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_agp_after_write ON public.assignment_group_posts;
CREATE TRIGGER trg_agp_after_write AFTER INSERT OR UPDATE ON public.assignment_group_posts
  FOR EACH ROW EXECUTE FUNCTION public.agp_after_write();

-- Threads: identity + title immutable; a thread may be soft-deleted only while no OTHER member has a
-- surviving reply, so a topic author can never erase others' contributions by deleting the topic.
CREATE OR REPLACE FUNCTION public.agt_before_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.group_id   IS DISTINCT FROM OLD.group_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.title      IS DISTINCT FROM OLD.title
     OR (NEW.author_id IS DISTINCT FROM OLD.author_id AND NEW.author_id IS NOT NULL) THEN
    RAISE EXCEPTION 'immutable_columns';
  END IF;
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.assignment_group_posts p
      WHERE p.thread_id = OLD.id AND p.deleted_at IS NULL
        AND p.author_id IS DISTINCT FROM OLD.author_id
    ) THEN
      RAISE EXCEPTION 'thread_has_replies';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agt_before_update ON public.assignment_group_threads;
CREATE TRIGGER trg_agt_before_update BEFORE UPDATE ON public.assignment_group_threads
  FOR EACH ROW EXECUTE FUNCTION public.agt_before_update();

-- ============================== RLS ==============================
ALTER TABLE public.assignment_group_threads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_group_posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_group_forum_access_log ENABLE ROW LEVEL SECURITY; -- no policy => service-role only

-- Threads: members read; members create their own; authors update (soft-delete) their own.
DROP POLICY IF EXISTS "agt: member select" ON public.assignment_group_threads;
CREATE POLICY "agt: member select" ON public.assignment_group_threads FOR SELECT
  USING (public.can_access_group_forum(assignment_id, group_id));
DROP POLICY IF EXISTS "agt: member insert" ON public.assignment_group_threads;
CREATE POLICY "agt: member insert" ON public.assignment_group_threads FOR INSERT
  WITH CHECK (author_id = (SELECT auth.uid()) AND public.can_access_group_forum(assignment_id, group_id));
DROP POLICY IF EXISTS "agt: author update" ON public.assignment_group_threads;
CREATE POLICY "agt: author update" ON public.assignment_group_threads FOR UPDATE
  USING      (author_id = (SELECT auth.uid()) AND public.can_access_group_forum(assignment_id, group_id))
  WITH CHECK (author_id = (SELECT auth.uid()) AND public.can_access_group_forum(assignment_id, group_id));

-- Posts: members read; members post as themselves (into a live thread); authors edit/soft-delete own.
DROP POLICY IF EXISTS "agp: member select" ON public.assignment_group_posts;
CREATE POLICY "agp: member select" ON public.assignment_group_posts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.assignment_group_threads t
                 WHERE t.id = thread_id AND public.can_access_group_forum(t.assignment_id, t.group_id)));
DROP POLICY IF EXISTS "agp: member insert" ON public.assignment_group_posts;
CREATE POLICY "agp: member insert" ON public.assignment_group_posts FOR INSERT
  WITH CHECK (author_id = (SELECT auth.uid())
              AND EXISTS (SELECT 1 FROM public.assignment_group_threads t
                          WHERE t.id = thread_id AND t.deleted_at IS NULL
                            AND public.can_access_group_forum(t.assignment_id, t.group_id)));
DROP POLICY IF EXISTS "agp: author update" ON public.assignment_group_posts;
CREATE POLICY "agp: author update" ON public.assignment_group_posts FOR UPDATE
  USING      (author_id = (SELECT auth.uid())
              AND EXISTS (SELECT 1 FROM public.assignment_group_threads t
                          WHERE t.id = thread_id AND public.can_access_group_forum(t.assignment_id, t.group_id)))
  WITH CHECK (author_id = (SELECT auth.uid())
              AND EXISTS (SELECT 1 FROM public.assignment_group_threads t
                          WHERE t.id = thread_id AND public.can_access_group_forum(t.assignment_id, t.group_id)));
-- No DELETE policy on either table: hard deletes are denied for everyone; removal is soft (deleted_at).
