-- 152: polls in the group discussion. A poll is a special post (kind='poll') carrying its options in
-- a jsonb column; votes live in their own table, one per member per poll. Additive to migration 151.

-- ---- posts: kind + poll ----
ALTER TABLE public.assignment_group_posts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','poll'));
ALTER TABLE public.assignment_group_posts
  ADD COLUMN IF NOT EXISTS poll jsonb;

-- Poll shape: null (a text post) OR an object with an options array of 2..6 non-empty strings (<=200).
CREATE OR REPLACE FUNCTION public.valid_group_poll(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NULL OR (
    jsonb_typeof(p) = 'object'
    AND jsonb_typeof(p->'options') = 'array'
    AND jsonb_array_length(p->'options') BETWEEN 2 AND 6
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p->'options') AS o
      WHERE jsonb_typeof(o) <> 'string' OR length(btrim(o #>> '{}')) = 0 OR length(o #>> '{}') > 200
    )
  );
$$;

ALTER TABLE public.assignment_group_posts DROP CONSTRAINT IF EXISTS agp_poll_kind_match;
ALTER TABLE public.assignment_group_posts ADD  CONSTRAINT agp_poll_kind_match CHECK ((kind = 'poll') = (poll IS NOT NULL));
ALTER TABLE public.assignment_group_posts DROP CONSTRAINT IF EXISTS agp_poll_valid;
ALTER TABLE public.assignment_group_posts ADD  CONSTRAINT agp_poll_valid CHECK (public.valid_group_poll(poll));

-- ---- votes: one per member per poll ----
CREATE TABLE IF NOT EXISTS public.assignment_group_poll_votes (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    uuid        NOT NULL REFERENCES public.assignment_group_posts(id) ON DELETE CASCADE,
  voter_id   uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  option_idx int         NOT NULL CHECK (option_idx >= 0 AND option_idx < 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_agpv_post ON public.assignment_group_poll_votes (post_id);

CREATE OR REPLACE FUNCTION public.agpv_before_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.post_id IS DISTINCT FROM OLD.post_id OR NEW.voter_id IS DISTINCT FROM OLD.voter_id) THEN
    RAISE EXCEPTION 'immutable_columns';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_agpv_before_write ON public.assignment_group_poll_votes;
CREATE TRIGGER trg_agpv_before_write BEFORE INSERT OR UPDATE ON public.assignment_group_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.agpv_before_write();

-- ---- posts immutability: kind/poll cannot change after creation ----
-- (Votes bump the poll post's updated_at for live tallies, which only touches updated_at.)
CREATE OR REPLACE FUNCTION public.agp_before_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'post_deleted';
    END IF;
    IF NEW.thread_id  IS DISTINCT FROM OLD.thread_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.is_opening IS DISTINCT FROM OLD.is_opening
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.poll IS DISTINCT FROM OLD.poll
       OR (NEW.author_id IS DISTINCT FROM OLD.author_id AND NEW.author_id IS NOT NULL) THEN
      RAISE EXCEPTION 'immutable_columns';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---- extend create_group_thread so a conversation can open with a poll ----
-- (DROP + CREATE rather than OR REPLACE because the argument list changes.)
DROP FUNCTION IF EXISTS public.create_group_thread(uuid, uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.create_group_thread(
  p_assignment_id uuid,
  p_group_id      uuid,
  p_author_id     uuid,
  p_title         text,
  p_body          text,
  p_kind          text  DEFAULT 'text',
  p_poll          jsonb DEFAULT NULL
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

  INSERT INTO public.assignment_group_posts (thread_id, author_id, body, is_opening, kind, poll)
  VALUES (v_thread.id, p_author_id, left(v_body, 4000), true, coalesce(p_kind, 'text'), p_poll)
  RETURNING * INTO v_post;

  RETURN jsonb_build_object('thread', to_jsonb(v_thread), 'post', to_jsonb(v_post));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_group_thread(uuid, uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_group_thread(uuid, uuid, uuid, text, text, text, jsonb) TO service_role;

-- ---- votes RLS: members cast/see only their OWN vote; tallies come from the service-role route as
-- counts, so who-voted-what is never exposed to other members. ----
ALTER TABLE public.assignment_group_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agpv: own select" ON public.assignment_group_poll_votes;
CREATE POLICY "agpv: own select" ON public.assignment_group_poll_votes FOR SELECT
  USING (voter_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "agpv: member insert" ON public.assignment_group_poll_votes;
CREATE POLICY "agpv: member insert" ON public.assignment_group_poll_votes FOR INSERT
  WITH CHECK (voter_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.assignment_group_posts p
                JOIN public.assignment_group_threads t ON t.id = p.thread_id
                WHERE p.id = post_id AND p.kind = 'poll' AND p.deleted_at IS NULL
                  AND public.can_access_group_forum(t.assignment_id, t.group_id)));

DROP POLICY IF EXISTS "agpv: own update" ON public.assignment_group_poll_votes;
CREATE POLICY "agpv: own update" ON public.assignment_group_poll_votes FOR UPDATE
  USING (voter_id = (SELECT auth.uid()))
  WITH CHECK (voter_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.assignment_group_posts p
                JOIN public.assignment_group_threads t ON t.id = p.thread_id
                WHERE p.id = post_id AND p.kind = 'poll' AND p.deleted_at IS NULL
                  AND public.can_access_group_forum(t.assignment_id, t.group_id)));
-- No DELETE policy: no "unvote" in v1 (you can change your choice via update/upsert).
