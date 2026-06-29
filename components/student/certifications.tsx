'use client';

// Student-facing certifications listing. Shows the published certifications assigned to the
// student's cohort, with their attempt status (Start / Continue / Review). Taking one opens the
// full-screen CertificationTaker at /{slug}.

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { LIGHT_C } from '@/lib/theme';
import { resolveCoverUrl } from '@/lib/cloudinary-url';
import { CarouselSkeleton, EmptyState } from '@/components/student/shared';
import { ShieldCheck, Clock, CheckCircle, Award } from 'lucide-react';

export function CertificationsSection({ userId, userEmail, C }: { userId: string; userEmail?: string; C: typeof LIGHT_C }) {
  const [items, setItems] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<Record<string, { passed: boolean; inProgress: boolean; score: number }>>({});
  // The single certification the student currently has in progress (one allowed at a time).
  const [inProgressId, setInProgressId] = useState<string | null>(null);
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
      setAttempts(byId);
      setInProgressId(active);
      setItems(certs ?? []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <CarouselSkeleton C={C} rows={1} />;
  if (!items.length) return <EmptyState icon={ShieldCheck} title="No certifications yet" body="Published certifications available to you will appear here." />;

  return (
    <div>
      <h2 className="text-lg font-bold mb-4" style={{ color: C.text }}>Certifications</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((cert, i) => {
          const st = attempts[cert.id];
          const label = st?.passed ? 'View result' : st?.inProgress ? 'Continue' : 'Start exam';
          // Locked while another certification is in progress (one at a time).
          const lockedByOther = !!inProgressId && inProgressId !== cert.id && !st?.passed;
          return (
            <motion.div key={cert.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-2xl overflow-hidden flex flex-col" style={{ background: C.card }}>
              <div className="relative h-32 flex-shrink-0" style={{ background: `${C.green}14` }}>
                {cert.cover_image
                  ? <img src={resolveCoverUrl(cert.cover_image)} alt={cert.title} className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  : <div className="w-full h-full flex items-center justify-center"><ShieldCheck className="w-9 h-9 opacity-25" style={{ color: C.green }} /></div>}
                {st?.passed && (
                  <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                    <CheckCircle className="w-3 h-3" /> Passed
                  </span>
                )}
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h3 className="text-sm font-semibold mb-1 line-clamp-2" style={{ color: C.text }}>{cert.title}</h3>
                <div className="flex items-center gap-3 text-xs mb-3" style={{ color: C.faint }}>
                  <span>Pass {cert.passmark ?? 70}%</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{cert.time_limit ? `${cert.time_limit}m` : 'Untimed'}</span>
                </div>
                {lockedByOther ? (
                  <div className="mt-auto text-center px-4 py-2 rounded-xl text-xs font-medium" style={{ background: C.pill, color: C.faint }}>
                    Finish your certification in progress first
                  </div>
                ) : (
                  <a href={`/${cert.slug || cert.id}`}
                    className="mt-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: st?.passed ? C.pill : C.cta, color: st?.passed ? C.muted : C.ctaText }}>
                    {st?.passed && <Award className="w-4 h-4" />} {label}
                  </a>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
