import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { gradeQuestion, verifyProof } from '@/lib/grade-question';

// Server-only loader for a certification's shareable performance report. Keyed by the public
// certificate id (like lib/certificate.ts), so it can back a shareable link. It re-grades the
// student's best passing attempt server-side and groups the result by skill area -- answer keys
// never reach the client; only correct/total counts per skill are returned.

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface SkillResult {
  id: string;
  name: string;
  correct: number;
  total: number;
  pct: number;
}

export interface CertReportData {
  certId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  certTitle: string;
  issueDate: string;       // formatted
  issuedAt: string;        // ISO
  score: number;           // overall %
  passmark: number;
  passed: boolean;
  totalQuestions: number;
  correctQuestions: number;
  skills: SkillResult[];   // per skill area that has mapped questions
  badgeImageUrl: string | null;
  percentile: number | null; // % of other test-takers this score beat (null when too few to be meaningful)
  population: number;        // number of completed attempts for this certification
}

export type CertReportResult =
  | { status: 'notfound' }
  | { status: 'revoked' }
  | { status: 'ready'; data: CertReportData };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export async function loadCertReport(certId: string): Promise<CertReportResult> {
  const { data: cert, error } = await svc
    .from('certificates')
    .select('id, student_name, issued_at, revoked, certification_id, student_id')
    .eq('id', certId)
    .single();

  if (error || !cert || !cert.certification_id) return { status: 'notfound' };
  if (cert.revoked) return { status: 'revoked' };

  const { data: c } = await svc
    .from('certifications')
    .select('title, badge_image_url, questions, skill_areas, passmark')
    .eq('id', cert.certification_id)
    .maybeSingle();
  if (!c) return { status: 'notfound' };

  const { data: studentRow } = await svc
    .from('students').select('avatar_url').eq('id', cert.student_id).maybeSingle();

  // Best passing attempt for this student + certification.
  const { data: attempt } = await svc
    .from('certification_attempts')
    .select('id, answers, score')
    .eq('certification_id', cert.certification_id)
    .eq('student_id', cert.student_id)
    .eq('passed', true)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle();

  const questions: any[] = Array.isArray(c.questions) ? c.questions : [];
  const scorable = questions.filter(q => !q?.lessonOnly && !q?.isSection && !q?.isDownloads);
  const storedAnswers: Record<string, any> = attempt?.answers && typeof attempt.answers === 'object' ? attempt.answers : {};
  const attemptId = attempt?.id ?? '';

  // Re-grade each scorable question. Python proofs are bound to the attempt id (see grade-question).
  const correctById = new Map<string, boolean>();
  let correctCount = 0;
  for (const q of scorable) {
    const ok = gradeQuestion(q, {
      storedAnswers,
      persistedAnswers: storedAnswers,
      verifyProof: (questionId, output, proof) => verifyProof(cert.certification_id, questionId, output, proof, attemptId),
    });
    correctById.set(q.id, ok);
    if (ok) correctCount++;
  }
  const total = scorable.length;
  const score = typeof attempt?.score === 'number' ? attempt.score : (total === 0 ? 100 : Math.round((correctCount / total) * 100));

  // Percentile across all completed attempts for this certification (for the distribution chart).
  const { data: allScores } = await svc
    .from('certification_attempts').select('score').eq('certification_id', cert.certification_id).not('completed_at', 'is', null);
  const scores = (allScores ?? []).map((a: any) => a.score).filter((s: any) => typeof s === 'number') as number[];
  const population = scores.length;
  const below = scores.filter(s => s < score).length;
  const percentile = population >= 2 ? Math.round((below / population) * 100) : null;

  // Per-skill-area performance (only skill areas that actually have questions mapped to them).
  const skillAreas: { id: string; name: string }[] = Array.isArray(c.skill_areas) ? c.skill_areas : [];
  const skills: SkillResult[] = skillAreas
    .map(sa => {
      const qs = scorable.filter(q => q?.skillAreaId === sa.id);
      const correct = qs.filter(q => correctById.get(q.id)).length;
      return { id: sa.id, name: sa.name, correct, total: qs.length, pct: qs.length ? Math.round((correct / qs.length) * 100) : 0 };
    })
    .filter(s => s.total > 0);

  const passmark = typeof c.passmark === 'number' ? c.passmark : 70;
  return {
    status: 'ready',
    data: {
      certId: cert.id,
      studentName: cert.student_name,
      studentAvatarUrl: studentRow?.avatar_url ?? null,
      certTitle: c.title ?? 'Certification',
      issueDate: fmtDate(cert.issued_at),
      issuedAt: cert.issued_at,
      score,
      passmark,
      passed: score >= passmark,
      totalQuestions: total,
      correctQuestions: correctCount,
      skills,
      badgeImageUrl: c.badge_image_url ?? null,
      percentile,
      population,
    },
  };
}
