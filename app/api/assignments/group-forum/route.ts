import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { getRedis } from '@/lib/redis';
import { bumpRateLimit } from '@/lib/rate-limit';

// Group-assignment discussion forum. ONE route, dispatched on `action`. Every op re-derives its
// ancestry from the DB (post -> thread -> assignment/group -> membership) and NEVER authorizes from a
// caller-supplied assignmentId/groupId when a threadId/postId is given, so a member of group A cannot
// pair a foreign thread/post id with an assignment/group they can reach (IDOR). Reads are limited to
// group members; a platform admin (never an instructor) may read as an out-of-band backstop, and each
// such read is written to assignment_group_forum_access_log. Writes are members-only.
export const dynamic = 'force-dynamic';

const THREAD_PAGE = 30;   // threads per page
const POST_PAGE   = 50;   // posts per page / per poll
const THREAD_RATE = 5;    // new topics / minute / user
const REPLY_RATE  = 20;   // replies / minute / user
const RATE_WINDOW = 60;
const MAX_TITLE   = 200;
const MAX_BODY    = 4000;

type Db = ReturnType<typeof adminClient>;

// Plain-text only. Strip any HTML so nothing downstream can render markup; the UI renders bodies as
// text and linkifies URLs at display time. Returns '' when the content is empty after cleaning.
function cleanBody(raw: unknown): string {
  return String(raw ?? '').replace(/<[^>]*>/g, '').replace(/\r\n/g, '\n').trim();
}
function cleanTitle(raw: unknown): string {
  return String(raw ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Opaque keyset cursor "<iso-timestamp>|<uuid>". The timestamp is the RAW Postgres value kept
// verbatim (it can carry microseconds). Round-tripping through Date.getTime() drops sub-millisecond
// digits, which would skip rows during history pagination and re-return rows while polling.
function encodeCursor(ts: string, id: string): string {
  return `${ts}|${id}`;
}
function decodeCursor(c: unknown): { ts: string; id: string } | null {
  if (typeof c !== 'string') return null;
  const bar = c.indexOf('|');
  if (bar < 1) return null;
  const ts = c.slice(0, bar);
  const id = c.slice(bar + 1);
  if (!ts || !id) return null;
  return { ts, id };
}

type Access =
  | { ok: true; mode: 'member'; isLeader: boolean }
  | { ok: true; mode: 'admin' }
  | { ok: false; status: number; error: string };

// The single authorization gate. Members pass; a non-member platform admin passes read-only (logged
// by the caller); everyone else is denied. Instructors/staff have no access.
async function resolveAccess(db: Db, assignmentId: string, groupId: string, userId: string): Promise<Access> {
  const [{ data: assignment }, { data: membership }, { data: me }] = await Promise.all([
    db.from('assignments').select('id, group_ids, status').eq('id', assignmentId).maybeSingle(),
    db.from('group_members').select('is_leader').eq('group_id', groupId).eq('student_id', userId).maybeSingle(),
    db.from('students').select('role').eq('id', userId).maybeSingle(),
  ]);
  if (!assignment || assignment.status !== 'published') return { ok: false, status: 404, error: 'Assignment not found' };
  const groupIds = Array.isArray(assignment.group_ids) ? assignment.group_ids : [];
  if (!groupIds.includes(groupId)) return { ok: false, status: 403, error: 'Assignment is not assigned to this group' };
  if (membership) return { ok: true, mode: 'member', isLeader: !!membership.is_leader };
  if (me?.role === 'admin') return { ok: true, mode: 'admin' };
  return { ok: false, status: 403, error: 'Forbidden' };
}

// Returns false if the audit write failed. Admin access is an audited abuse backstop, so callers
// MUST fail closed (deny the content) when this returns false.
async function logAdminRead(db: Db, adminId: string, assignmentId: string, groupId: string): Promise<boolean> {
  const { error } = await db.from('assignment_group_forum_access_log')
    .insert({ admin_id: adminId, assignment_id: assignmentId, group_id: groupId });
  return !error;
}

// Load a thread and its ancestry from the DB (never trust client-supplied assignment/group).
async function loadThread(db: Db, threadId: string) {
  const { data } = await db.from('assignment_group_threads')
    .select('id, assignment_id, group_id, author_id, title, created_at, deleted_at')
    .eq('id', threadId).maybeSingle();
  return data;
}
async function loadPost(db: Db, postId: string) {
  const { data } = await db.from('assignment_group_posts')
    .select('id, thread_id, author_id, body, created_at, updated_at, deleted_at, thread:assignment_group_threads!thread_id(assignment_id, group_id)')
    .eq('id', postId).maybeSingle();
  if (!data) return null;
  const thread = Array.isArray((data as any).thread) ? (data as any).thread[0] : (data as any).thread;
  return { ...data, assignment_id: thread?.assignment_id as string, group_id: thread?.group_id as string };
}

async function rateLimited(userId: string, kind: 'thread' | 'reply'): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) return null; // rate limiting not configured on this deployment -> allow (don't brick posting)
  const [limit, label] = kind === 'thread' ? [THREAD_RATE, 'topics'] : [REPLY_RATE, 'replies'];
  try {
    if (await bumpRateLimit(redis, `rate:group-forum:${kind}:${userId}`, limit, RATE_WINDOW)) {
      return NextResponse.json({ error: `Slow down - too many ${label} in a short time. Try again in a minute.` }, { status: 429 });
    }
  } catch {
    // Redis configured but unreachable -> FAIL CLOSED for writes (spam protection over availability).
    return NextResponse.json({ error: 'Posting is temporarily unavailable. Please try again shortly.' }, { status: 503 });
  }
  return null;
}

const authorName = (row: any): string | null => {
  const s = Array.isArray(row?.author) ? row.author[0] : row?.author;
  return s?.full_name || s?.email || null;
};
// Never leak a soft-deleted post's body; surface placeholder flags instead.
function shapePost(p: any) {
  const deleted = !!p.deleted_at;
  return {
    id: p.id,
    threadId: p.thread_id,
    authorId: p.author_id,
    authorName: deleted ? null : authorName(p),
    body: deleted ? null : p.body,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    deleted,
    edited: !deleted && new Date(p.updated_at).getTime() - new Date(p.created_at).getTime() > 1000,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (isAuthError(auth)) return auth.error;
  const userId = auth.user.id;
  const db = adminClient();

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? '');

  try {
    switch (action) {
      // ---------------------------------------------------------------- reads
      case 'listThreads': {
        const assignmentId = String(body.assignmentId ?? '');
        const groupId = String(body.groupId ?? '');
        if (!assignmentId || !groupId) return NextResponse.json({ error: 'assignmentId and groupId required' }, { status: 400 });
        const access = await resolveAccess(db, assignmentId, groupId, userId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (access.mode === 'admin' && !(await logAdminRead(db, userId, assignmentId, groupId))) {
          return NextResponse.json({ error: 'Access temporarily unavailable.' }, { status: 503 });
        }

        let q = db.from('assignment_group_threads')
          .select('id, title, author_id, created_at, last_post_at, author:students!author_id(full_name, email)')
          .eq('assignment_id', assignmentId).eq('group_id', groupId).is('deleted_at', null)
          .order('last_post_at', { ascending: false }).order('id', { ascending: false })
          .limit(THREAD_PAGE + 1);
        const cur = decodeCursor(body.cursor);
        if (cur) q = q.or(`last_post_at.lt.${cur.ts},and(last_post_at.eq.${cur.ts},id.lt.${cur.id})`);
        const { data: rows, error } = await q;
        if (error) return NextResponse.json({ error: 'Could not load discussions' }, { status: 500 });

        const page = (rows ?? []).slice(0, THREAD_PAGE);
        const nextCursor = (rows ?? []).length > THREAD_PAGE
          ? encodeCursor(page[page.length - 1].last_post_at, page[page.length - 1].id) : null;

        // reply counts (non-deleted posts minus the opening post) for this page
        const ids = page.map((t: any) => t.id);
        const counts: Record<string, number> = {};
        if (ids.length) {
          // Count non-deleted, non-opening posts. The opening post is flagged is_opening, so the
          // count stays correct even if the opening post itself is later deleted.
          const { data: posts } = await db.from('assignment_group_posts')
            .select('thread_id').in('thread_id', ids).is('deleted_at', null).eq('is_opening', false);
          for (const p of posts ?? []) counts[(p as any).thread_id] = (counts[(p as any).thread_id] ?? 0) + 1;
        }
        return NextResponse.json({
          threads: page.map((t: any) => ({
            id: t.id, title: t.title, authorId: t.author_id, authorName: authorName(t),
            createdAt: t.created_at, lastPostAt: t.last_post_at,
            replyCount: counts[t.id] ?? 0,
          })),
          nextCursor,
        });
      }

      case 'listPosts': {
        const threadId = String(body.threadId ?? '');
        if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 });
        const thread = await loadThread(db, threadId);
        if (!thread || thread.deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const access = await resolveAccess(db, thread.assignment_id, thread.group_id, userId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (access.mode === 'admin' && !(await logAdminRead(db, userId, thread.assignment_id, thread.group_id))) {
          return NextResponse.json({ error: 'Access temporarily unavailable.' }, { status: 503 });
        }

        const mode = body.mode === 'earlier' || body.mode === 'poll' ? body.mode : 'initial';
        const sel = 'id, thread_id, author_id, body, created_at, updated_at, deleted_at, author:students!author_id(full_name, email)';
        const cur = decodeCursor(body.cursor);

        if (mode === 'poll') {
          // Incremental feed by (updated_at, id): catches new posts AND edits/soft-deletions of ones
          // already on screen (a plain created_at feed would miss those).
          let q = db.from('assignment_group_posts').select(sel).eq('thread_id', threadId)
            .order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(POST_PAGE);
          if (cur) q = q.or(`updated_at.gt.${cur.ts},and(updated_at.eq.${cur.ts},id.gt.${cur.id})`);
          const { data: rows, error } = await q;
          if (error) return NextResponse.json({ error: 'Could not load replies' }, { status: 500 });
          const shaped = (rows ?? []).map(shapePost);
          const last = (rows ?? [])[(rows ?? []).length - 1] as any;
          return NextResponse.json({ posts: shaped, pollCursor: last ? encodeCursor(last.updated_at, last.id) : body.cursor ?? null });
        }

        // history: newest-first page, returned oldest-first for display
        let q = db.from('assignment_group_posts').select(sel).eq('thread_id', threadId)
          .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(POST_PAGE + 1);
        if (mode === 'earlier' && cur) q = q.or(`created_at.lt.${cur.ts},and(created_at.eq.${cur.ts},id.lt.${cur.id})`);
        const { data: rows, error } = await q;
        if (error) return NextResponse.json({ error: 'Could not load replies' }, { status: 500 });
        const desc = (rows ?? []).slice(0, POST_PAGE);
        const hasMoreEarlier = (rows ?? []).length > POST_PAGE;
        const olderCursor = desc.length ? encodeCursor(desc[desc.length - 1].created_at, desc[desc.length - 1].id) : null;
        const ordered = [...desc].reverse();
        // pollCursor = the max updated_at across the loaded page (raw ISO, so polling resumes after
        // everything shown without losing sub-millisecond precision).
        let pollTs = '', pollId = '';
        for (const p of ordered) { if (!pollTs || new Date(p.updated_at).getTime() >= new Date(pollTs).getTime()) { pollTs = p.updated_at; pollId = p.id; } }
        return NextResponse.json({
          thread: { id: thread.id, title: thread.title, authorId: thread.author_id },
          posts: ordered.map(shapePost),
          hasMoreEarlier, olderCursor,
          pollCursor: pollId ? encodeCursor(pollTs, pollId) : null,
        });
      }

      // ---------------------------------------------------------------- writes (members only)
      case 'createThread': {
        const assignmentId = String(body.assignmentId ?? '');
        const groupId = String(body.groupId ?? '');
        if (!assignmentId || !groupId) return NextResponse.json({ error: 'assignmentId and groupId required' }, { status: 400 });
        const access = await resolveAccess(db, assignmentId, groupId, userId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (access.mode !== 'member') return NextResponse.json({ error: 'Only group members can post' }, { status: 403 });

        const title = cleanTitle(body.title);
        const text = cleanBody(body.body);
        if (!title) return NextResponse.json({ error: 'A topic needs a title.' }, { status: 400 });
        if (!text) return NextResponse.json({ error: 'A topic needs an opening message.' }, { status: 400 });
        if (title.length > MAX_TITLE || text.length > MAX_BODY) return NextResponse.json({ error: 'Content is too long.' }, { status: 400 });

        const limited = await rateLimited(userId, 'thread');
        if (limited) return limited;

        const { data, error } = await db.rpc('create_group_thread', {
          p_assignment_id: assignmentId, p_group_id: groupId, p_author_id: userId, p_title: title, p_body: text,
        });
        if (error) {
          if (/forbidden/i.test(error.message)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          if (/empty/i.test(error.message)) return NextResponse.json({ error: 'A topic needs a title and a message.' }, { status: 400 });
          return NextResponse.json({ error: 'Could not create the topic' }, { status: 500 });
        }
        const t = (data as any)?.thread; const p = (data as any)?.post;
        return NextResponse.json({
          thread: { id: t.id, title: t.title, authorId: t.author_id, createdAt: t.created_at, lastPostAt: t.last_post_at, replyCount: 0 },
          post: shapePost(p),
        });
      }

      case 'createPost': {
        const threadId = String(body.threadId ?? '');
        if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 });
        const thread = await loadThread(db, threadId);
        if (!thread || thread.deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const access = await resolveAccess(db, thread.assignment_id, thread.group_id, userId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (access.mode !== 'member') return NextResponse.json({ error: 'Only group members can post' }, { status: 403 });

        const text = cleanBody(body.body);
        if (!text) return NextResponse.json({ error: 'Your reply is empty.' }, { status: 400 });
        if (text.length > MAX_BODY) return NextResponse.json({ error: 'Reply is too long.' }, { status: 400 });

        const limited = await rateLimited(userId, 'reply');
        if (limited) return limited;

        const { data, error } = await db.from('assignment_group_posts')
          .insert({ thread_id: threadId, author_id: userId, body: text })
          .select('id, thread_id, author_id, body, created_at, updated_at, deleted_at, author:students!author_id(full_name, email)').single();
        if (error) return NextResponse.json({ error: 'Could not post your reply' }, { status: 500 });
        return NextResponse.json({ post: shapePost(data) });
      }

      case 'editPost': {
        const postId = String(body.postId ?? '');
        if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });
        const post = await loadPost(db, postId);
        if (!post || post.deleted_at) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const access = await resolveAccess(db, post.assignment_id, post.group_id, userId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (access.mode !== 'member' || post.author_id !== userId) return NextResponse.json({ error: 'You can only edit your own posts' }, { status: 403 });

        const text = cleanBody(body.body);
        if (!text) return NextResponse.json({ error: 'Your reply is empty.' }, { status: 400 });
        if (text.length > MAX_BODY) return NextResponse.json({ error: 'Reply is too long.' }, { status: 400 });

        // Optimistic-concurrency guard: reject if the row changed since the client last saw it.
        let upd = db.from('assignment_group_posts').update({ body: text }).eq('id', postId).is('deleted_at', null);
        if (typeof body.expectedUpdatedAt === 'string') upd = upd.eq('updated_at', body.expectedUpdatedAt);
        const { data, error } = await upd
          .select('id, thread_id, author_id, body, created_at, updated_at, deleted_at, author:students!author_id(full_name, email)').maybeSingle();
        if (error) return NextResponse.json({ error: 'Could not save your edit' }, { status: 500 });
        if (!data) return NextResponse.json({ error: 'This post changed since you opened it. Reload and try again.' }, { status: 409 });
        return NextResponse.json({ post: shapePost(data) });
      }

      case 'deletePost': {
        const postId = String(body.postId ?? '');
        if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 });
        const post = await loadPost(db, postId);
        if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (post.deleted_at) return NextResponse.json({ ok: true }); // idempotent
        const access = await resolveAccess(db, post.assignment_id, post.group_id, userId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (access.mode !== 'member' || post.author_id !== userId) return NextResponse.json({ error: 'You can only delete your own posts' }, { status: 403 });

        let upd = db.from('assignment_group_posts').update({ deleted_at: new Date().toISOString() }).eq('id', postId).is('deleted_at', null);
        if (typeof body.expectedUpdatedAt === 'string') upd = upd.eq('updated_at', body.expectedUpdatedAt);
        const { data, error } = await upd.select('id').maybeSingle();
        if (error) return NextResponse.json({ error: 'Could not delete the post' }, { status: 500 });
        if (!data) return NextResponse.json({ error: 'This post changed since you opened it. Reload and try again.' }, { status: 409 });
        return NextResponse.json({ ok: true });
      }

      case 'deleteThread': {
        const threadId = String(body.threadId ?? '');
        if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 });
        const thread = await loadThread(db, threadId);
        if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (thread.deleted_at) return NextResponse.json({ ok: true });
        const access = await resolveAccess(db, thread.assignment_id, thread.group_id, userId);
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (access.mode !== 'member' || thread.author_id !== userId) return NextResponse.json({ error: 'You can only delete your own topic' }, { status: 403 });

        // Atomic: the RPC soft-deletes the thread AND its posts in one transaction, and refuses if
        // anyone other than the author has a surviving reply.
        const { error } = await db.rpc('delete_group_thread', { p_thread_id: threadId, p_author_id: userId });
        if (error) {
          if (/thread_has_replies/i.test(error.message)) {
            return NextResponse.json({ error: 'This topic has replies from others and can no longer be deleted. You can delete your own posts instead.' }, { status: 409 });
          }
          if (/forbidden/i.test(error.message)) return NextResponse.json({ error: 'You can only delete your own topic' }, { status: 403 });
          if (/not_found/i.test(error.message)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
          return NextResponse.json({ error: 'Could not delete the topic' }, { status: 500 });
        }
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[group-forum]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
