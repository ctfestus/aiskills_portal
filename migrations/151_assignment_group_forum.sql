-- 151: group discussion forum for group assignments (threaded topics + replies).
--
-- Replaces the WhatsApp-link/workspace with an in-app, group-members-only forum. Two levels:
-- a THREAD (topic, with an opening post) and POSTS (replies). Enforcement lives in the DB, not just
-- the API, so a student hitting these tables directly with their anon key is still constrained:
--
--   * RLS restricts NON-deleted rows to members of a PUBLISHED assignment whose group_ids include
--     THAT group (all three via can_access_group_forum, which uses my_group_ids() to avoid the
--     group_members RLS recursion). Soft-deleted rows are invisible to direct clients; the
--     service-role polling route still sees them (to emit "deleted" placeholders). No instructor/staff.
--   * Threads are created and deleted ONLY through SECURITY DEFINER RPCs (atomic; no orphan topic,
--     no partial delete). Direct clients have no INSERT/UPDATE on threads at all.
--   * Members insert/edit/soft-delete only their OWN posts; triggers forbid resurrecting or editing a
--     deleted post and keep identity columns immutable. A thread deletes only while nobody else has a
--     surviving reply (trigger + RPC), so a topic author can never erase others' contributions.
--   * author_id is nullable ON DELETE SET NULL so a discussion survives a student deletion.
--   * updated_at is bumped on every write so incremental polling by (updated_at, id) sees edits and
--     deletions. last_post_at is recomputed on every post write (deleting the newest reply moves it
--     back). The opening post is flagged is_opening so reply counts stay correct if it is deleted.
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
  is_opening boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Admin abuse backstop: forum rows are members-only in RLS, so an admin read goes through a
-- service-role route that records the access here (and fails closed if the log write fails).
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
-- Called by the server route (service role) with the authenticated user's id as p_author_id. Inserts
-- the thread + opening post in ONE transaction (the ONLY way to create a thread), re-deriving the
-- ancestry check from the DB (published + group in group_ids + membership). Does not use auth.uid()
-- because the route runs under the service role.
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

  INSERT INTO public.assignment_group_posts (thread_id, author_id, body, is_opening)
  VALUES (v_thread.id, p_author_id, left(v_body, 4000), true)
  RETURNING * INTO v_post;

  RETURN jsonb_build_object('thread', to_jsonb(v_thread), 'post', to_jsonb(v_post));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_group_thread(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_group_thread(uuid, uuid, uuid, text, text) TO service_role;

-- ============================== Atomic thread deletion ==============================
-- Soft-deletes a thread AND all its posts in one transaction (the ONLY way to delete a thread).
-- Refuses if anyone other than the author has a surviving reply; idempotent if already deleted.
CREATE OR REPLACE FUNCTION public.delete_group_thread(p_thread_id uuid, p_author_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_thread public.assignment_group_threads;
BEGIN
  SELECT * INTO v_thread FROM public.assignment_group_threads WHERE id = p_thread_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_thread.deleted_at IS NOT NULL THEN RETURN; END IF; -- idempotent
  IF v_thread.author_id IS DISTINCT FROM p_author_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.assignment_group_posts p
    WHERE p.thread_id = p_thread_id AND p.deleted_at IS NULL
      AND p.author_id IS DISTINCT FROM v_thread.author_id
  ) THEN
    RAISE EXCEPTION 'thread_has_replies';
  END IF;
  UPDATE public.assignment_group_posts   SET deleted_at = now() WHERE thread_id = p_thread_id AND deleted_at IS NULL;
  UPDATE public.assignment_group_threads SET deleted_at = now() WHERE id = p_thread_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_group_thread(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_group_thread(uuid, uuid) TO service_role;

-- ============================== Triggers ==============================
-- Posts: stamp updated_at; keep identity immutable; forbid ANY change to an already-deleted post
-- (no resurrection, no editing a tombstone). author_id may only be cleared to NULL by the FK cascade.
CREATE OR REPLACE FUNCTION public.agp_before_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'post_deleted';
    END IF;
    IF NEW.thread_id  IS DISTINCT FROM OLD.thread_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.is_opening IS DISTINCT FROM OLD.is_opening
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

-- Posts: after any write, recompute the parent thread's last_post_at from surviving posts. SECURITY
-- DEFINER so it can maintain the thread even though members have NO direct UPDATE on threads.
CREATE OR REPLACE FUNCTION public.agp_after_write() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Threads: identity + title immutable; deleted_at is write-once (no resurrection); a thread may be
-- soft-deleted only while no OTHER member has a surviving reply.
CREATE OR REPLACE FUNCTION public.agt_before_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.group_id   IS DISTINCT FROM OLD.group_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.title      IS DISTINCT FROM OLD.title
     OR (NEW.author_id IS DISTINCT FROM OLD.author_id AND NEW.author_id IS NOT NULL) THEN
    RAISE EXCEPTION 'immutable_columns';
  END IF;
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'thread_deleted'; -- write-once: never un-delete or re-stamp
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

-- Threads: members read NON-deleted rows only. Creation/deletion are RPC-only (SECURITY DEFINER), so
-- there is deliberately NO thread INSERT or UPDATE policy -> a direct client can neither make an
-- orphan topic nor resurrect / re-order one.
DROP POLICY IF EXISTS "agt: member select" ON public.assignment_group_threads;
DROP POLICY IF EXISTS "agt: member insert" ON public.assignment_group_threads;
DROP POLICY IF EXISTS "agt: author update" ON public.assignment_group_threads;
CREATE POLICY "agt: member select" ON public.assignment_group_threads FOR SELECT
  USING (deleted_at IS NULL AND public.can_access_group_forum(assignment_id, group_id));

-- Posts: members read NON-deleted rows; post as themselves into a live thread; edit/soft-delete own
-- (the trigger enforces valid transitions, incl. no touching a deleted post).
DROP POLICY IF EXISTS "agp: member select" ON public.assignment_group_posts;
CREATE POLICY "agp: member select" ON public.assignment_group_posts FOR SELECT
  USING (deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM public.assignment_group_threads t
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
