import { NextRequest, NextResponse } from 'next/server';
import { requireUser, isAuthError } from '@/lib/api-auth';
import { adminClient } from '@/lib/admin-client';
import { getTenantSettings } from '@/lib/get-tenant-settings';
import { courseResultEmail } from '@/lib/email-templates';
import { gradeQuestion, normalizePythonOutput, signProof, verifyProof, sanitizeExamQuestions } from '@/lib/grade-question';
import { ensureCertificate, awardContentBadge, sendCertificateEmailOnce } from '@/lib/issue-certificate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getSessionUser(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const auth = await requireUser(req);
  if (isAuthError(auth) || !auth.user.email) return null;
  return { id: auth.user.id, email: auth.user.email.trim().toLowerCase() };
}


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Service-role load + manual access check (RLS is bypassed by the admin client). `ref` may be a
// certification id (UUID) or slug. Access model:
// - owner (creator) or admin -> full access, including drafts
// - instructor or staff -> published only (preview / proctor), NOT another creator's draft
// - student -> published + assigned cohort
async function loadAccessibleCertification(
  supabase: ReturnType<typeof adminClient>,
  ref: string,
  user: { id: string },
  select = 'id, user_id, status, cohort_ids, questions, passmark, max_attempts, time_limit',
) {
  const [{ data: cert, error }, { data: student }] = await Promise.all([
    supabase.from('certifications').select(select).eq(UUID_RE.test(ref) ? 'id' : 'slug', ref).maybeSingle(),
    supabase.from('students').select('role, cohort_id').eq('id', user.id).maybeSingle(),
  ]);
  if (error || !cert) return { error: NextResponse.json({ error: 'Certification not found' }, { status: 404 }) };

  const role = String((student as any)?.role ?? '');
  const cohortIds = Array.isArray((cert as any).cohort_ids) ? (cert as any).cohort_ids : [];
  const isOwner = (cert as any).user_id === user.id;
  const isAdmin = role === 'admin';
  const isPublished = (cert as any).status === 'published';
  const cohortAllowed = cohortIds.length === 0 || (!!(student as any)?.cohort_id && cohortIds.includes((student as any).cohort_id));
  const elevatedPublished = (role === 'instructor' || role === 'staff') && isPublished;
  if (!(isOwner || isAdmin || elevatedPublished || (isPublished && cohortAllowed))) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { cert };
}

function runCertificateSideEffects(
  supabase: ReturnType<typeof adminClient>,
  { certification_id, student_id, cert_id }: { certification_id: string; student_id: string; cert_id: string },
): void {
  (async () => {
    try {
      const [{ data: certRow }, { data: studentRow }, { data: bestAttempt }] = await Promise.all([
        supabase.from('certifications').select('title, slug, badge_image_url').eq('id', certification_id).single(),
        supabase.from('students').select('full_name, email').eq('id', student_id).single(),
        supabase.from('certification_attempts').select('score')
          .eq('certification_id', certification_id).eq('student_id', student_id)
          .eq('passed', true).order('score', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!certRow || !studentRow?.email) return;

      let badgeName: string | undefined;
      let badgeImageUrl: string | undefined;
      if (certRow.badge_image_url) {
        await awardContentBadge(supabase, {
          badgeId:     `cert_${certification_id}`,
          name:        `${certRow.title} Badge`,
          description: `Awarded for passing ${certRow.title}`,
          imageUrl:    certRow.badge_image_url,
          category:    'certification',
          studentId:   student_id,
        });
        badgeName = `${certRow.title} Badge`;
        badgeImageUrl = certRow.badge_image_url;
      }

      if (process.env.RESEND_API_KEY) {
        const t        = await getTenantSettings();
        const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
        const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
        const certUrl  = `${t.appUrl}/certificate/${cert_id}`;
        const formUrl  = certRow.slug ? `${t.appUrl}/${certRow.slug}` : `${t.appUrl}/${certification_id}`;
        await sendCertificateEmailOnce(supabase, {
          certId:     cert_id,
          dedupeType: 'certification-certificate',
          from:       FROM,
          to:         studentRow.email,
          subject:    `Congratulations! Your certificate for ${certRow.title} is ready`,
          html:       courseResultEmail({
            name:        studentRow.full_name ?? 'there',
            courseTitle: certRow.title,
            score:       bestAttempt?.score ?? 100,
            total:       100,
            percentage:  bestAttempt?.score ?? 100,
            passed:      true,
            formUrl,
            certUrl,
            badgeName,
            badgeImageUrl,
            branding,
          }),
        });
      }
    } catch (err) {
      console.error('[certification-attempt] side effects failed', err);
    }
  })();
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { action, certification_id } = body;

  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = adminClient();

  // -- Student catalog: published certifications assigned to the student's cohort (no questions) --
  if (action === 'list') {
    try {
      const { data: student } = await supabase.from('students').select('role, cohort_id').eq('id', sessionUser.id).maybeSingle();
      const role = String((student as any)?.role ?? '');
      const privileged = ['admin', 'instructor', 'staff'].includes(role);
      const cohortId = (student as any)?.cohort_id;
      const { data: rows } = await supabase
        .from('certifications')
        .select('id, title, slug, cover_image, passmark, time_limit, max_attempts, description, cohort_ids')
        .eq('status', 'published');
      // A certification with no assigned cohorts is open to everyone; otherwise the student's cohort
      // must be in the list. Privileged users see all.
      const visible = (rows ?? []).filter((r: any) => {
        if (privileged) return true;
        const cids = Array.isArray(r.cohort_ids) ? r.cohort_ids : [];
        return cids.length === 0 || (cohortId && cids.includes(cohortId));
      });
      // Never leak cohort_ids to the client.
      return NextResponse.json({ certifications: visible.map(({ cohort_ids, ...m }: any) => m) });
    } catch (err: any) {
      console.error('[certification-attempt/list]', err);
      return NextResponse.json({ error: 'Failed to load certifications.' }, { status: 500 });
    }
  }

  // -- Title/cover for the caller's earned-certificate cards. Scoped to certifications the caller
  // actually holds a non-revoked certificate for, so it can't enumerate draft/private metadata. --
  if (action === 'meta') {
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === 'string').slice(0, 200) : [];
    if (!ids.length) return NextResponse.json({ certifications: [] });
    const { data: owned } = await supabase.from('certificates')
      .select('certification_id')
      .eq('student_id', sessionUser.id).eq('revoked', false).in('certification_id', ids);
    const allowed = [...new Set((owned ?? []).map((r: any) => r.certification_id).filter(Boolean))];
    if (!allowed.length) return NextResponse.json({ certifications: [] });
    const { data } = await supabase.from('certifications').select('id, title, cover_image').in('id', allowed);
    return NextResponse.json({ certifications: data ?? [] });
  }

  // -- Exam METADATA for the intro screen (no questions). Accepts id or slug. Questions are delivered
  // only by start-attempt, which stamps started_at -- so a student cannot read the questions without
  // the clock starting. --
  if (action === 'get-exam') {
    const ref: string | undefined = body.certification_id || body.slug;
    if (!ref) return NextResponse.json({ error: 'certification_id or slug required' }, { status: 400 });
    try {
      const access = await loadAccessibleCertification(supabase, ref, sessionUser, '*');
      if ('error' in access) return access.error;
      const cert = access.cert as any;
      const questionCount = (Array.isArray(cert.questions) ? cert.questions : [])
        .filter((q: any) => !q?.lessonOnly && !q?.isSection && !q?.isDownloads).length;
      return NextResponse.json({ certification: {
        id: cert.id, slug: cert.slug, user_id: cert.user_id,
        config: {
          title: cert.title, description: cert.description, isCertification: true,
          questionCount,
          passmark: cert.passmark, timeLimit: cert.time_limit,
          maxAttempts: cert.max_attempts, examProtection: cert.exam_protection,
          coverImage: cert.cover_image, deadline_days: cert.deadline_days,
          theme: cert.theme, mode: cert.mode, font: cert.font, customAccent: cert.custom_accent,
          // Foundation assets shown on the intro screen. Study guide + poster are gated on their
          // publish flags; skill areas + practice-test link are always visible.
          skillAreas: Array.isArray(cert.skill_areas) ? cert.skill_areas : [],
          studyGuide: cert.study_guide_published && cert.study_guide_url
            ? { url: cert.study_guide_url, name: cert.study_guide_name || 'Study guide' } : null,
          poster: cert.poster_published && cert.poster_url ? cert.poster_url : null,
          practiceTestUrl: cert.practice_test_url || null,
          // Distinct exam sections present (Technical / Practical), in canonical order, for the overview.
          sections: ['technical', 'practical'].filter(s =>
            (Array.isArray(cert.questions) ? cert.questions : []).some((q: any) => q?.section === s)),
        },
      } });
    } catch (err: any) {
      console.error('[certification-attempt/get-exam]', err);
      return NextResponse.json({ error: 'Failed to load certification.' }, { status: 500 });
    }
  }

  if (!certification_id) return NextResponse.json({ error: 'certification_id required' }, { status: 400 });

  // -- Resume state + existing cert + completed-attempt count --
  if (action === 'get-progress') {
    try {
      const [{ data: cert }, { data: progress }, { count: attemptCount }, { data: passingAttempt }, { data: certRow }] = await Promise.all([
        supabase.from('certificates').select('id')
          .eq('certification_id', certification_id).eq('student_id', sessionUser.id).eq('revoked', false)
          .maybeSingle(),
        supabase.from('certification_attempts').select('*')
          .eq('certification_id', certification_id).eq('student_id', sessionUser.id)
          .is('completed_at', null)
          .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('certification_attempts').select('id', { count: 'exact', head: true })
          .eq('certification_id', certification_id).eq('student_id', sessionUser.id)
          .not('completed_at', 'is', null),
        supabase.from('certification_attempts').select('answers, score')
          .eq('certification_id', certification_id).eq('student_id', sessionUser.id)
          .eq('passed', true).order('score', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('certifications').select('time_limit').eq('id', certification_id).maybeSingle(),
      ]);
      // Server-derived remaining time so a refresh/reopen cannot regain time (the clock runs from
      // the attempt's started_at, computed with the server clock).
      let remainingSeconds: number | null = null;
      const timeLimit = Number((certRow as any)?.time_limit) || 0;
      if (progress?.started_at && timeLimit > 0) {
        const elapsed = Math.floor((Date.now() - new Date(progress.started_at).getTime()) / 1000);
        remainingSeconds = Math.max(0, timeLimit * 60 - elapsed);
      }
      return NextResponse.json({ cert, progress, attemptCount: attemptCount ?? 0, hasPassed: !!passingAttempt, passingAttempt, remainingSeconds });
    } catch (err: any) {
      console.error('[certification-attempt/get-progress]', err);
      return NextResponse.json({ error: 'Failed to load progress.' }, { status: 500 });
    }
  }

  // -- Server-side Python output check: expected output stays private --
  if (action === 'check-python-answer') {
    const { question_id, output } = body;
    if (!question_id) return NextResponse.json({ error: 'question_id required' }, { status: 400 });
    try {
      const access = await loadAccessibleCertification(supabase, certification_id, sessionUser, 'id, user_id, status, cohort_ids, questions, time_limit');
      if ('error' in access) return access.error;
      const cert = access.cert as any;
      const question = (Array.isArray(cert.questions) ? cert.questions : [])
        .find((q: any) => q?.id === question_id && q?.type === 'python_exercise');
      if (!question) return NextResponse.json({ error: 'Python exercise not found.' }, { status: 404 });
      const expected = normalizePythonOutput(question.pythonExpectedOutput);
      if (!expected) return NextResponse.json({ error: 'Python expected output is not configured.' }, { status: 400 });
      const actual = normalizePythonOutput(output);
      const passed = actual === expected;

      // A proof is only minted inside a live, unexpired attempt and is bound to that attempt.id, so it
      // can't be pre-computed outside the exam window or replayed on a later attempt.
      const { data: attempt } = await supabase.from('certification_attempts')
        .select('id, started_at')
        .eq('certification_id', certification_id).eq('student_id', sessionUser.id)
        .is('completed_at', null)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();

      if (!attempt) {
        // Privileged preview has no attempt: report pass/fail for the walkthrough, but never a proof.
        const { data: student } = await supabase.from('students').select('role').eq('id', sessionUser.id).maybeSingle();
        const isPreview = cert.user_id === sessionUser.id || ['admin', 'instructor', 'staff'].includes(String((student as any)?.role ?? ''));
        if (isPreview) {
          return NextResponse.json({ passed, message: passed ? 'Output matches.' : 'Output does not match the expected result.' });
        }
        return NextResponse.json({ passed: false, message: 'No active exam attempt. Start the exam first.' });
      }

      const timeLimit = Number(cert.time_limit) || 0;
      if (timeLimit > 0 && attempt.started_at &&
          (Date.now() - new Date(attempt.started_at).getTime()) / 1000 > timeLimit * 60 + 5) {
        return NextResponse.json({ passed: false, message: 'Time is up for this exam.' });
      }

      return NextResponse.json({
        passed,
        message: passed ? 'Output matches.' : 'Output does not match the expected result.',
        proof: passed ? signProof(certification_id, question_id, actual, attempt.id) : undefined,
      });
    } catch (err: any) {
      console.error('[certification-attempt/check-python-answer]', err);
      return NextResponse.json({ error: 'Failed to check Python answer.' }, { status: 500 });
    }
  }

  // -- Start (or resume) the attempt and deliver the questions. This is the ONLY place an attempt is
  // created, so started_at marks the moment questions are handed out -- the timer cannot be deferred
  // by reading questions first. Privileged users (owner/admin/instructor/staff) get a preview with no
  // attempt and no timer. --
  if (action === 'start-attempt') {
    try {
      const access = await loadAccessibleCertification(
        supabase, certification_id, sessionUser,
        'id, user_id, status, cohort_ids, questions, max_attempts, time_limit',
      );
      if ('error' in access) return access.error;
      const cert = access.cert as any;
      const questions = sanitizeExamQuestions(cert.questions);
      const timeLimit = Number(cert.time_limit) || 0;

      const { data: student } = await supabase.from('students').select('role').eq('id', sessionUser.id).maybeSingle();
      const role = String((student as any)?.role ?? '');
      const isPreview = cert.user_id === sessionUser.id || ['admin', 'instructor', 'staff'].includes(role);
      if (isPreview) {
        return NextResponse.json({ questions, remainingSeconds: timeLimit > 0 ? timeLimit * 60 : null, currentIndex: 0, answers: {}, proctor: {}, preview: true });
      }

      const { data: passedRow } = await supabase.from('certification_attempts').select('id')
        .eq('certification_id', certification_id).eq('student_id', sessionUser.id).eq('passed', true).limit(1).maybeSingle();
      if (passedRow) return NextResponse.json({ error: 'You have already passed this certification.', reason: 'already_passed' }, { status: 409 });

      const sel = 'id, started_at, current_question_index, answers, proctor';
      let attempt = (await supabase.from('certification_attempts').select(sel)
        .eq('certification_id', certification_id).eq('student_id', sessionUser.id).is('completed_at', null)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle()).data;

      // Resolves "one certification in progress at a time" given any in-progress attempt: a different
      // certification means the rule is violated; the same one means resume.
      const inProgressConflict = async () => {
        const { data: other } = await supabase.from('certification_attempts')
          .select('certification_id').eq('student_id', sessionUser.id).is('completed_at', null)
          .neq('certification_id', certification_id).limit(1).maybeSingle();
        if (other) {
          return NextResponse.json({
            error: 'Finish your in-progress certification before starting another.',
            reason: 'other_in_progress',
          }, { status: 409 });
        }
        return null;
      };

      if (!attempt) {
        // Fast-path check (the unique index below is the atomic guarantee against concurrent starts).
        const conflict = await inProgressConflict();
        if (conflict) return conflict;

        const maxAttempts = Number(cert.max_attempts) || 0;
        const [{ count: completedCount }, { data: last }] = await Promise.all([
          supabase.from('certification_attempts').select('id', { count: 'exact', head: true })
            .eq('certification_id', certification_id).eq('student_id', sessionUser.id).not('completed_at', 'is', null),
          supabase.from('certification_attempts').select('attempt_number')
            .eq('certification_id', certification_id).eq('student_id', sessionUser.id)
            .order('attempt_number', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (maxAttempts > 0 && (completedCount ?? 0) >= maxAttempts) {
          return NextResponse.json({ error: 'No attempts remaining.' }, { status: 403 });
        }
        const ins = await supabase.from('certification_attempts').insert({
          student_id: sessionUser.id, certification_id,
          attempt_number: (last?.attempt_number ?? 0) + 1, updated_at: new Date().toISOString(),
        }).select(sel).single();
        if (ins.error) {
          // Lost a race on the one-active-attempt-per-student unique index. If the winner is THIS
          // certification, resume it; if it's a different certification, enforce the rule.
          attempt = (await supabase.from('certification_attempts').select(sel)
            .eq('certification_id', certification_id).eq('student_id', sessionUser.id).is('completed_at', null)
            .order('updated_at', { ascending: false }).limit(1).maybeSingle()).data;
          if (!attempt) {
            const conflict = await inProgressConflict();
            if (conflict) return conflict;
            return NextResponse.json({ error: 'Could not start the exam.' }, { status: 500 });
          }
        } else {
          attempt = ins.data;
        }
      }
      if (!attempt) return NextResponse.json({ error: 'Could not start the exam.' }, { status: 500 });

      let remainingSeconds: number | null = null;
      if (timeLimit > 0 && attempt.started_at) {
        const elapsed = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
        remainingSeconds = Math.max(0, timeLimit * 60 - elapsed);
      }
      return NextResponse.json({
        questions,
        remainingSeconds,
        currentIndex: attempt.current_question_index ?? 0,
        answers: attempt.answers && typeof attempt.answers === 'object' ? attempt.answers : {},
        proctor: attempt.proctor && typeof attempt.proctor === 'object' ? attempt.proctor : {},
      });
    } catch (err: any) {
      console.error('[certification-attempt/start-attempt]', err);
      return NextResponse.json({ error: 'Failed to start the exam.' }, { status: 500 });
    }
  }

  // -- Save in-progress attempt (UPDATE only; the attempt must already exist via start-attempt) --
  if (action === 'save-progress') {
    const { current_question_index, answers, proctor } = body;
    try {
      const access = await loadAccessibleCertification(supabase, certification_id, sessionUser, 'id, user_id, status, cohort_ids, time_limit');
      if ('error' in access) return access.error;
      const timeLimit = Number((access.cert as any).time_limit) || 0;

      const incomingIndex = Number.isFinite(Number(current_question_index)) ? Number(current_question_index) : 0;
      const incomingAnswers = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
      const incomingProctor = proctor && typeof proctor === 'object' && !Array.isArray(proctor) ? proctor : {};

      const { data: existing } = await supabase.from('certification_attempts')
        .select('id, current_question_index, answers, proctor, started_at')
        .eq('certification_id', certification_id).eq('student_id', sessionUser.id)
        .is('completed_at', null)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();

      // Update only: the attempt is created by start-attempt. No active attempt -> nothing to save
      // (and we must NOT create one here, or started_at would be re-stamped and the timer reset).
      if (!existing) return NextResponse.json({ ok: true, ignored: 'no_active_attempt' });

      // Reject writes after the time limit: no answers may be persisted past the deadline.
      if (timeLimit > 0 && existing.started_at &&
          (Date.now() - new Date(existing.started_at).getTime()) / 1000 > timeLimit * 60 + 5) {
        return NextResponse.json({ ok: true, ignored: 'time_expired' });
      }
      const existingAnswers = existing.answers && typeof existing.answers === 'object' ? existing.answers : {};
      await supabase.from('certification_attempts').update({
        current_question_index: Math.max(existing.current_question_index ?? 0, incomingIndex),
        // Existing answers win on conflict so a stale tab cannot overwrite recorded answers.
        answers: { ...incomingAnswers, ...existingAnswers },
        proctor: { ...(existing.proctor ?? {}), ...incomingProctor },
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      return NextResponse.json({ ok: true });
    } catch (err: any) {
      console.error('[certification-attempt/save-progress]', err);
      return NextResponse.json({ error: 'Failed to save progress.' }, { status: 500 });
    }
  }

  // -- Complete the active attempt: re-score server-side, issue cert on pass --
  if (action === 'complete-attempt') {
    const { current_question_index, final_answers, proctor } = body;
    try {
      const access = await loadAccessibleCertification(supabase, certification_id, sessionUser);
      if ('error' in access) return access.error;
      const cert = access.cert as any;

      const attempt = (await supabase.from('certification_attempts')
        .select('id, answers, started_at')
        .eq('certification_id', certification_id).eq('student_id', sessionUser.id)
        .is('completed_at', null)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle()).data;

      // No create-if-missing: the attempt must already exist via start-attempt. Completing without an
      // active attempt would mint a fresh started_at and let a client bypass the timer, so refuse.
      if (!attempt) return NextResponse.json({ ok: true, ignored: 'no_active_attempt' });

      const questions: any[] = Array.isArray(cert.questions) ? cert.questions : [];
      const persistedAnswers: Record<string, any> = attempt.answers ?? {};
      // Past the deadline, ignore client-supplied final_answers and score only what was persisted
      // before time ran out -- the timer cannot be beaten by submitting late.
      const timeLimit = Number(cert.time_limit) || 0;
      const expired = timeLimit > 0 && (attempt as any).started_at &&
        (Date.now() - new Date((attempt as any).started_at).getTime()) / 1000 > timeLimit * 60 + 5;
      const storedAnswers: Record<string, any> = expired
        ? { ...persistedAnswers }
        : { ...persistedAnswers, ...(final_answers && typeof final_answers === 'object' ? final_answers : {}) };
      const passmark = cert.passmark ?? 70;

      const scorable = questions.filter(q => !q.lessonOnly && !q.isSection && !q.isDownloads);
      let correct = 0;
      for (const q of scorable) {
        const ok = gradeQuestion(q, {
          storedAnswers,
          persistedAnswers,
          // Proof must have been minted for THIS attempt (bound to attempt.id) -- blocks cross-attempt reuse.
          verifyProof: (questionId, output, proof) => verifyProof(certification_id, questionId, output, proof, attempt.id),
        });
        if (ok) correct++;
      }
      const total = scorable.length;
      const scorePct = total === 0 ? 100 : Math.round((correct / total) * 100);
      const passed = scorePct >= passmark;

      const { error: updateError } = await supabase.from('certification_attempts').update({
        completed_at:           new Date().toISOString(),
        passed,
        score:                  scorePct,
        current_question_index: Math.max(Number(current_question_index) || 0, questions.length),
        answers:                storedAnswers,
        proctor:                proctor && typeof proctor === 'object' ? proctor : (attempt as any).proctor,
        updated_at:             new Date().toISOString(),
      }).eq('id', attempt.id);
      if (updateError) {
        console.error('[certification-attempt/complete-attempt] update failed', updateError);
        return NextResponse.json({ error: 'Failed to complete attempt.' }, { status: 500 });
      }

      let certId: string | undefined;
      if (passed) {
        try {
          const { data: studentRow } = await supabase.from('students').select('full_name').eq('id', sessionUser.id).single();
          const studentName = studentRow?.full_name?.trim() || sessionUser.email;
          const result = await ensureCertificate(supabase, {
            column: 'certification_id', contentId: certification_id, studentId: sessionUser.id, studentName,
          });
          certId = result.certId;
          if (result.isNew) runCertificateSideEffects(supabase, { certification_id, student_id: sessionUser.id, cert_id: result.certId });
        } catch (certErr) {
          console.error('[certification-attempt/complete-attempt] certificate creation failed', certErr);
        }
      }

      return NextResponse.json({ ok: true, score: scorePct, passed, certId });
    } catch (err: any) {
      console.error('[certification-attempt/complete-attempt]', err);
      return NextResponse.json({ error: 'Failed to complete attempt.' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
