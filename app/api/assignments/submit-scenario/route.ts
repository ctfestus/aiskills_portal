import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { sanitizeRichText } from '@/lib/sanitize';
import { isScenarioConfig, buildScenarioRecord, isAllowedUpload, type RawTaskAnswer } from '@/lib/assignment-scenarios';

// Authoritative submission for scenario-based (standard) assignments. The client sends only
// RAW answers; this route (service role) builds the stored record, enforces the upload
// allowlist, and writes status ('draft'|'submitted', never 'graded') and score (always null
// -- the instructor sets the final grade). Client-provided score/status/keys are never trusted.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authRes = await requireUser(req);
  if (isAuthError(authRes)) return authRes.error;
  const { user } = authRes;

  const body = await req.json().catch(() => ({}));
  const { assignmentId, answers, groupId, participants, asDraft } = body as {
    assignmentId?: string; answers?: RawTaskAnswer[]; groupId?: string; participants?: string[]; asDraft?: boolean;
  };
  if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });
  if (!Array.isArray(answers)) return NextResponse.json({ error: 'answers required' }, { status: 400 });

  const supabase = adminClient();

  const [{ data: assignment }, { data: studentRow }] = await Promise.all([
    supabase.from('assignments').select('id, config, cohort_ids, group_ids, status, type').eq('id', assignmentId).single(),
    supabase.from('students').select('id, cohort_id, role').eq('id', user.id).single(),
  ]);

  if (!assignment || assignment.status !== 'published') return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (assignment.type !== 'standard' || !isScenarioConfig(assignment.config)) return NextResponse.json({ error: 'Not a scenario assignment' }, { status: 400 });
  if (studentRow?.role && studentRow.role !== 'student') return NextResponse.json({ error: 'Only students can submit' }, { status: 403 });

  const groupIds: string[] = Array.isArray(assignment.group_ids) ? assignment.group_ids : [];
  const cohortIds: string[] = Array.isArray(assignment.cohort_ids) ? assignment.cohort_ids : [];
  const isGroupAssignment = groupIds.length > 0;

  // Access + (for group submits) leader/participant validation.
  let participantIds: string[] = [];
  if (isGroupAssignment) {
    if (!groupId || !groupIds.includes(groupId)) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    const { data: membership } = await supabase.from('group_members').select('is_leader').eq('group_id', groupId).eq('student_id', user.id).maybeSingle();
    if (!membership?.is_leader) return NextResponse.json({ error: 'Only the group leader can submit' }, { status: 403 });
    if (!asDraft) {
      if (!Array.isArray(participants) || participants.length === 0) return NextResponse.json({ error: 'At least one participant is required' }, { status: 400 });
      participantIds = [...new Set(participants)];
      const { data: gm } = await supabase.from('group_members').select('student_id').eq('group_id', groupId);
      const valid = new Set((gm ?? []).map((m: any) => m.student_id as string));
      if (participantIds.some(id => !valid.has(id))) return NextResponse.json({ error: 'Invalid participant IDs' }, { status: 400 });
    } else if (Array.isArray(participants)) {
      participantIds = [...new Set(participants)];
    }
  } else if (!studentRow?.cohort_id || !cohortIds.includes(studentRow.cohort_id)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Validate every uploaded file server-side (the client `accept` attribute is not a control):
  // both fields present, allowed extension, the URL must be a real object in OUR form-assets
  // bucket under THIS submitter's own path (a full-prefix startsWith, not a substring `includes`
  // that an external URL could satisfy), and the object must actually exist.
  const publicBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/form-assets/`;
  const ownerPrefix = `submissions/${assignmentId}/${user.id}/`;
  for (const a of answers) {
    if (!a || (!a.fileUrl && !a.fileName)) continue;
    if (!a.fileUrl || !a.fileName) return NextResponse.json({ error: 'Incomplete file upload.' }, { status: 400 });
    if (!isAllowedUpload(a.fileName)) return NextResponse.json({ error: `File type not allowed: ${a.fileName}` }, { status: 400 });
    if (!a.fileUrl.startsWith(publicBase + ownerPrefix)) {
      return NextResponse.json({ error: 'Uploaded file is not in your submission path.' }, { status: 403 });
    }
    const objectPath = a.fileUrl.slice(publicBase.length).split('?')[0].split('#')[0];
    const { error: existErr } = await supabase.storage.from('form-assets').createSignedUrl(objectPath, 60);
    if (existErr) return NextResponse.json({ error: 'Uploaded file could not be verified.' }, { status: 400 });
  }

  const record = buildScenarioRecord(assignment.config, answers, (html) => sanitizeRichText(html));

  // Update the existing row in place, else insert. Never overwrite a graded row.
  const existingQuery = isGroupAssignment && groupId
    ? supabase.from('assignment_submissions').select('id, status').eq('assignment_id', assignmentId).eq('group_id', groupId).maybeSingle()
    : supabase.from('assignment_submissions').select('id, status').eq('assignment_id', assignmentId).eq('student_id', user.id).is('group_id', null).maybeSingle();
  const { data: existing } = await existingQuery;
  if (existing?.status === 'graded') return NextResponse.json({ error: 'This has been graded. Reset it to resubmit.' }, { status: 409 });

  const status = asDraft ? 'draft' : 'submitted';
  const responseText = JSON.stringify(record);
  const now = new Date().toISOString();

  let saved: any;
  if (existing?.id) {
    const upd: any = { response_text: responseText, status };
    if (!asDraft) upd.submitted_at = now;
    if (isGroupAssignment && groupId) { upd.submitted_by = user.id; upd.participants = participantIds; }
    const { data, error } = await supabase.from('assignment_submissions').update(upd).eq('id', existing.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data;
  } else {
    const ins: any = { assignment_id: assignmentId, student_id: user.id, response_text: responseText, status };
    if (!asDraft) ins.submitted_at = now;
    if (isGroupAssignment && groupId) { ins.group_id = groupId; ins.submitted_by = user.id; ins.participants = participantIds; }
    const { data, error } = await supabase.from('assignment_submissions').insert(ins).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    saved = data;
  }

  return NextResponse.json({ submission: saved });
}
