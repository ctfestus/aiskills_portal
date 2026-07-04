'use client';

// Student-facing certifications listing. Shows the published certifications assigned to the
// student's cohort, with their attempt status (Start / Continue / Review). Taking one opens the
// full-screen CertificationTaker at /{slug}.

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { LIGHT_C } from '@/lib/theme';
import { resolveCoverUrl } from '@/lib/cloudinary-url';
import type { CertificationType } from '@/lib/course-schema';
import { EmptyState } from '@/components/student/shared';
import { ShieldCheck, Clock, CheckCircle, Award, Briefcase, Cpu } from 'lucide-react';

export function CertificationsSection({ userId, userEmail, C }: { userId: string; userEmail?: string; C: typeof LIGHT_C }) {
  const [items, setItems] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, { passed: boolean; inProgress: boolean; score: number }>>({});
  // The certification the student is currently "enrolled" in: one they have attempted but not passed
  // (in progress OR a prior failed attempt). Only one exists at a time (enforced server-side). Every
  // OTHER exam is locked to a Switch until they pass this one or switch away -- matching the server.
  const [enrolledId, setEnrolledId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Certifications metadata comes from the service-role API (students cannot read the base table,
      // which holds answer keys). Attempts are RLS-scoped to the student, so read those directly.
      const { data: { session } } = await supabase.auth.getSession();
      const [listRes, { data: atts }] = await Promise.all([
        fetch('/api/certification-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ action: 'list' }),
        }).then(r => r.ok ? r.json() : { certifications: [] }).catch(() => ({ certifications: [] })),
        supabase.from('certification_attempts').select('certification_id, passed, completed_at, score').eq('student_id', userId),
      ]);
      const certs = listRes.certifications ?? [];
      const byId: Record<string, { passed: boolean; inProgress: boolean; score: number }> = {};
      let active: string | null = null;
      for (const a of (atts ?? [])) {
        const cur = byId[a.certification_id] ?? { passed: false, inProgress: false, score: 0 };
        if (a.passed) { cur.passed = true; cur.score = Math.max(cur.score, a.score ?? 0); }
        if (!a.completed_at) { cur.inProgress = true; active = a.certification_id; }
        byId[a.certification_id] = cur;
      }
      // Enrollment = any attempted-but-unpassed cert (in progress OR failed). Prefer the in-progress one.
      const enrolled = active ?? (Object.entries(byId).find(([, st]) => !st.passed)?.[0] ?? null);
      setAttempts(byId);
      setEnrolledId(enrolled);
      setItems(certs ?? []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return (
    <div>
      <div className="h-6 w-52 rounded-lg animate-pulse mb-3" style={{ background: C.skeleton }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl p-5 flex flex-col min-h-[320px]" style={{ background: C.card }}>
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-16 h-16 rounded-full flex-shrink-0 animate-pulse" style={{ background: C.skeleton }} />
              <div className="flex-1 pt-1">
                <div className="h-5 w-3/4 rounded animate-pulse mb-2" style={{ background: C.skeleton }} />
                <div className="h-3 w-1/2 rounded animate-pulse" style={{ background: C.skeleton }} />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-3 w-full rounded animate-pulse" style={{ background: C.skeleton }} />
              <div className="h-3 w-5/6 rounded animate-pulse" style={{ background: C.skeleton }} />
              <div className="h-3 w-2/3 rounded animate-pulse" style={{ background: C.skeleton }} />
            </div>
            <div className="mt-auto h-10 rounded-xl animate-pulse" style={{ background: C.skeleton }} />
          </div>
        ))}
      </div>
    </div>
  );
  if (!items.length) return <EmptyState icon={ShieldCheck} title="No certifications yet" body="Published certifications available to you will appear here." />;

  // One certification card. Extracted so both type groups render identical cards.
  const renderCard = (cert: any, i: number) => {
    const st = attempts[cert.id];
    const label = st?.passed ? 'View result' : st?.inProgress ? 'Continue' : 'Start exam';
    // Locked to a Switch while the student is enrolled in a DIFFERENT exam (in progress or failed),
    // mirroring the server's one-at-a-time rule so a quit/fail cannot silently unlock the others.
    const lockedByOther = !!enrolledId && enrolledId !== cert.id && !st?.passed;
    return (
      <motion.div key={cert.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
        className="relative rounded-2xl p-5 flex flex-col min-h-[320px]" style={{ background: C.card }}>
        {st?.passed && (
          <span className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <CheckCircle className="w-3 h-3" /> Passed
          </span>
        )}
        {/* Badge (credential icon) on the left, no background; title + facts on the right. */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
            {cert.badge_image_url
              ? <img src={resolveCoverUrl(cert.badge_image_url)} alt="" className="w-full h-full object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
              : <Award className="w-12 h-12" style={{ color: C.green }} />}
          </div>
          <div className={`min-w-0 flex-1 ${st?.passed ? 'pr-10' : ''}`}>
            <h3 className="text-lg font-bold leading-tight line-clamp-3" style={{ color: C.text }}>{cert.title}</h3>
            <div className="flex items-center gap-3 text-xs mt-1.5" style={{ color: C.faint }}>
              <span>Pass {cert.passmark ?? 70}%</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{cert.time_limit ? `${cert.time_limit}m` : 'Untimed'}</span>
            </div>
          </div>
        </div>
        {cert.description && (
          <p className="text-sm mb-4" style={{ color: C.muted }}>{cert.description}</p>
        )}
        {lockedByOther ? (
          // Another exam is in progress. Keep this actionable: opening it lets the student switch
          // (the taker asks to confirm, discarding the other) instead of a dead-end message.
          <div className="mt-auto">
            <a href={`/${cert.slug || cert.id}`}
              className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: C.pill, color: C.text }}>
              Switch to this exam
            </a>
            <p className="text-[11px] text-center mt-1.5" style={{ color: C.faint }}>You have another exam in progress.</p>
          </div>
        ) : (
          <a href={`/${cert.slug || cert.id}`}
            className="mt-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: st?.passed ? C.pill : C.cta, color: st?.passed ? C.muted : C.ctaText }}>
            {st?.passed && <Award className="w-4 h-4" />} {label}
          </a>
        )}
      </motion.div>
    );
  };

  // Grouped by type. Anything without a type (legacy rows) falls under Technology.
  const GROUPS: { type: CertificationType; label: string; Icon: typeof Briefcase }[] = [
    { type: 'career', label: 'Career Certifications', Icon: Briefcase },
    { type: 'technology', label: 'Technology Certifications', Icon: Cpu },
  ];

  return (
    <div className="space-y-8">
      {GROUPS.map(g => {
        const groupItems = items.filter(c => (c.cert_type === 'career' ? 'career' : 'technology') === g.type);
        if (!groupItems.length) return null;
        return (
          <section key={g.type}>
            <h3 className="flex items-center gap-2 text-lg font-bold mb-3" style={{ color: C.text }}>
              <g.Icon className="w-5 h-5" style={{ color: C.green }} /> {g.label}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupItems.map((cert, i) => renderCard(cert, i))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
