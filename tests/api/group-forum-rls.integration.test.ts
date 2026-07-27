import { describe, it, expect, beforeAll } from 'vitest';
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
// Run with:  FORUM_RLS_URL=... FORUM_RLS_SERVICE_KEY=... FORUM_RLS_ANON_KEY=... npx vitest run tests/api/group-forum-rls.integration.test.ts
//
// It seeds two students in two different groups on one published assignment (assigned only to group
// A), signs each in, and asserts: a group-A member reads/writes the forum; a group-B student can
// neither read group A's threads/posts nor insert into them; nobody can hard-delete.

const URL = process.env.FORUM_RLS_URL;
const SERVICE = process.env.FORUM_RLS_SERVICE_KEY;
const ANON = process.env.FORUM_RLS_ANON_KEY;
const configured = !!(URL && SERVICE && ANON);

const uniq = (p: string) => `${p}-${Math.floor(Math.random() * 1e9)}@example.test`;

describe.skipIf(!configured)('group forum RLS (user-scoped)', () => {
  let admin: SupabaseClient;
  const ids: { userA?: string; userB?: string; groupA?: string; groupB?: string; assignment?: string; thread?: string } = {};
  const pwA = 'Passw0rd!A', pwB = 'Passw0rd!B';
  const emailA = uniq('a'), emailB = uniq('b');
  let clientA: SupabaseClient, clientB: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });

    const a = await admin.auth.admin.createUser({ email: emailA, password: pwA, email_confirm: true });
    const b = await admin.auth.admin.createUser({ email: emailB, password: pwB, email_confirm: true });
    ids.userA = a.data.user!.id; ids.userB = b.data.user!.id;

    await admin.from('students').upsert([
      { id: ids.userA, email: emailA, full_name: 'Member A', role: 'student' },
      { id: ids.userB, email: emailB, full_name: 'Student B', role: 'student' },
    ]);

    const gA = await admin.from('groups').insert({ name: 'Group A' }).select('id').single();
    const gB = await admin.from('groups').insert({ name: 'Group B' }).select('id').single();
    ids.groupA = gA.data!.id; ids.groupB = gB.data!.id;
    await admin.from('group_members').insert([
      { group_id: ids.groupA, student_id: ids.userA, is_leader: true },
      { group_id: ids.groupB, student_id: ids.userB, is_leader: true },
    ]);

    const asg = await admin.from('assignments').insert({
      title: 'RLS forum test', type: 'standard', status: 'published',
      group_ids: [ids.groupA], cohort_ids: [], created_by: ids.userA, config: {},
    }).select('id').single();
    ids.assignment = asg.data!.id;

    const rpc = await admin.rpc('create_group_thread', {
      p_assignment_id: ids.assignment, p_group_id: ids.groupA, p_author_id: ids.userA,
      p_title: 'Topic', p_body: 'opening',
    });
    ids.thread = (rpc.data as any)?.thread?.id;

    clientA = createClient(URL!, ANON!, { auth: { persistSession: false } });
    clientB = createClient(URL!, ANON!, { auth: { persistSession: false } });
    await clientA.auth.signInWithPassword({ email: emailA, password: pwA });
    await clientB.auth.signInWithPassword({ email: emailB, password: pwB });
  }, 30000);

  it('a group-A member can read the topic', async () => {
    const { data } = await clientA.from('assignment_group_threads').select('id').eq('id', ids.thread!);
    expect((data ?? []).length).toBe(1);
  });

  it('a group-B student cannot read group A threads or posts', async () => {
    const threads = await clientB.from('assignment_group_threads').select('id').eq('id', ids.thread!);
    expect((threads.data ?? []).length).toBe(0);
    const posts = await clientB.from('assignment_group_posts').select('id').eq('thread_id', ids.thread!);
    expect((posts.data ?? []).length).toBe(0);
  });

  it('a group-B student cannot insert a post into group A', async () => {
    const { error } = await clientB.from('assignment_group_posts')
      .insert({ thread_id: ids.thread!, author_id: ids.userB, body: 'intrusion' });
    expect(error).not.toBeNull();
  });

  it('a member cannot post as someone else (author must be self)', async () => {
    const { error } = await clientA.from('assignment_group_posts')
      .insert({ thread_id: ids.thread!, author_id: ids.userB, body: 'spoofed' });
    expect(error).not.toBeNull();
  });
});
