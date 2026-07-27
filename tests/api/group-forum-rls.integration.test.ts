import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// User-scoped RLS integration test for the group forum. Unlike the mocked route tests (which run
// under the service role with RLS OFF), this drives the tables with real end-user anon clients to
// prove the row-level policies themselves. It requires a throwaway Supabase project that already has
// migration 151 applied, and is SKIPPED unless these env vars are set:
//
//   FORUM_RLS_URL           project URL
//   FORUM_RLS_SERVICE_KEY   service_role key (seeds + cleans up)
//   FORUM_RLS_ANON_KEY      anon key (the user-scoped clients)
//
// Run:  FORUM_RLS_URL=... FORUM_RLS_SERVICE_KEY=... FORUM_RLS_ANON_KEY=... npx vitest run tests/api/group-forum-rls.integration.test.ts

const URL = process.env.FORUM_RLS_URL;
const SERVICE = process.env.FORUM_RLS_SERVICE_KEY;
const ANON = process.env.FORUM_RLS_ANON_KEY;
const configured = !!(URL && SERVICE && ANON);

const rand = Math.floor(Math.random() * 1e9);
const uniq = (p: string) => `${p}-${rand}@example.test`;
// Throw loudly if a setup step failed, and hand back its data (loosely typed - this is a fixture).
function must(label: string, res: { data: any; error: any }): any {
  if (res.error) throw new Error(`${label}: ${JSON.stringify(res.error)}`);
  return res.data;
}

describe.skipIf(!configured)('group forum RLS (user-scoped)', () => {
  let admin: SupabaseClient;
  let clientA: SupabaseClient, clientB: SupabaseClient;
  const pwA = 'Passw0rd!A', pwB = 'Passw0rd!B';
  const emailA = uniq('a'), emailB = uniq('b');
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });

    ids.userA = must('createUser A', await admin.auth.admin.createUser({ email: emailA, password: pwA, email_confirm: true })).user!.id;
    ids.userB = must('createUser B', await admin.auth.admin.createUser({ email: emailB, password: pwB, email_confirm: true })).user!.id;

    ids.cohort = must('cohort', await admin.from('cohorts').insert({ name: `RLS ${rand}`, created_by: ids.userA }).select('id').single()).id;

    must('students', await admin.from('students').upsert([
      { id: ids.userA, email: emailA, full_name: 'Member A', role: 'student', cohort_id: ids.cohort },
      { id: ids.userB, email: emailB, full_name: 'Student B', role: 'student', cohort_id: ids.cohort },
    ]).select('id'));

    ids.groupA = must('groupA', await admin.from('groups').insert({ name: 'Group A', cohort_id: ids.cohort, created_by: ids.userA }).select('id').single()).id;
    ids.groupB = must('groupB', await admin.from('groups').insert({ name: 'Group B', cohort_id: ids.cohort, created_by: ids.userA }).select('id').single()).id;
    must('members', await admin.from('group_members').insert([
      { group_id: ids.groupA, student_id: ids.userA, is_leader: true },
      { group_id: ids.groupB, student_id: ids.userB, is_leader: true },
    ]).select('group_id'));

    ids.assignment = must('assignment', await admin.from('assignments').insert({
      title: 'RLS forum test', type: 'standard', status: 'published',
      group_ids: [ids.groupA], cohort_ids: [ids.cohort], created_by: ids.userA, config: {},
    }).select('id').single()).id;

    const rpc = must('create_group_thread', await admin.rpc('create_group_thread', {
      p_assignment_id: ids.assignment, p_group_id: ids.groupA, p_author_id: ids.userA,
      p_title: 'Topic', p_body: 'opening',
    })) as any;
    ids.thread = rpc.thread.id;
    ids.openingPost = rpc.post.id;

    clientA = createClient(URL!, ANON!, { auth: { persistSession: false } });
    clientB = createClient(URL!, ANON!, { auth: { persistSession: false } });
    must('signin A', await clientA.auth.signInWithPassword({ email: emailA, password: pwA }));
    must('signin B', await clientB.auth.signInWithPassword({ email: emailB, password: pwB }));
  }, 45000);

  afterAll(async () => {
    if (!admin) return;
    try { await admin.from('assignments').delete().eq('id', ids.assignment); } catch { /* */ }
    try { await admin.from('groups').delete().in('id', [ids.groupA, ids.groupB].filter(Boolean)); } catch { /* */ }
    try { await admin.from('cohorts').delete().eq('id', ids.cohort); } catch { /* */ }
    for (const uid of [ids.userA, ids.userB].filter(Boolean)) {
      try { await admin.auth.admin.deleteUser(uid); } catch { /* cascades students */ }
    }
  }, 30000);

  it('a group-A member can read the topic', async () => {
    const { data } = await clientA.from('assignment_group_threads').select('id').eq('id', ids.thread);
    expect((data ?? []).length).toBe(1);
  });

  it('a group-B student cannot read group A threads or posts', async () => {
    const threads = await clientB.from('assignment_group_threads').select('id').eq('id', ids.thread);
    expect((threads.data ?? []).length).toBe(0);
    const posts = await clientB.from('assignment_group_posts').select('id').eq('thread_id', ids.thread);
    expect((posts.data ?? []).length).toBe(0);
  });

  it('a group-B student cannot insert a post into group A', async () => {
    const { error } = await clientB.from('assignment_group_posts')
      .insert({ thread_id: ids.thread, author_id: ids.userB, body: 'intrusion' });
    expect(error).not.toBeNull();
  });

  it('a member cannot post as someone else (author must be self)', async () => {
    const { error } = await clientA.from('assignment_group_posts')
      .insert({ thread_id: ids.thread, author_id: ids.userB, body: 'spoofed' });
    expect(error).not.toBeNull();
  });

  it('nobody can hard-delete a post (no DELETE policy) - the row survives', async () => {
    await clientA.from('assignment_group_posts').delete().eq('id', ids.openingPost);
    const { data } = await admin.from('assignment_group_posts').select('id').eq('id', ids.openingPost);
    expect((data ?? []).length).toBe(1); // still there
  });
});
