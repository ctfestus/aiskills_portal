'use client';

import { useState } from 'react';
import { useTenant } from '@/components/TenantProvider';
import { Award, CheckCircle2, XCircle, Linkedin, Link2, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import type { CertReportData } from '@/lib/cert-report';

function hexToRgba(hex: string, a: number): string {
  const h = String(hex || '').replace('#', '');
  if (h.length === 6) { const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  return `rgba(37,99,235,${a})`;
}

export default function CertReportClient({ data }: { data: CertReportData }) {
  const { brandColor, appName, orgName, logoUrl } = useTenant();
  const accent = brandColor || '#2563eb';
  const org = orgName || appName || 'our platform';
  const issued = new Date(data.issuedAt);

  const suggestedText = `I'm pleased to share that I have completed the ${data.certTitle}${data.skills.length ? `, covering ${data.skills.map(s => s.name).join(', ')}` : ''}.`;

  // URLs depend on window.location, so build them at click time (no SSR/window access at render).
  const reportUrl = () => `${window.location.origin}/cert-report/${data.certId}`;
  const certUrl = () => `${window.location.origin}/certificate/${data.certId}`;
  const openNew = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');
  const shareToLinkedIn = () => openNew(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(reportUrl())}`);
  const addToLinkedIn = () => openNew(
    `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(data.certTitle)}` +
    `&organizationName=${encodeURIComponent(org)}&issueYear=${issued.getFullYear()}&issueMonth=${issued.getMonth() + 1}` +
    `&certUrl=${encodeURIComponent(certUrl())}&certId=${encodeURIComponent(data.certId)}`,
  );

  const [copied, setCopied] = useState<'link' | 'text' | null>(null);
  const copy = (val: string, which: 'link' | 'text') => {
    navigator.clipboard?.writeText(val).then(() => { setCopied(which); setTimeout(() => setCopied(null), 1800); }).catch(() => {});
  };

  const C = { page: '#f3f5f9', card: '#ffffff', text: '#0f1729', muted: '#64748b', track: '#eef1f6', border: '#e8ecf2' };

  // Overall score ring.
  const R = 66, STROKE = 13, CIRC = 2 * Math.PI * R;
  const dash = Math.max(0, Math.min(100, data.score)) / 100 * CIRC;

  const cardStyle = { background: C.card, borderRadius: 22, padding: 28, boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.06)' };
  const sectionLabel = { fontSize: 12, fontWeight: 800 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: accent, marginBottom: 12 };
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 as const, padding: '11px 18px', borderRadius: 12, cursor: 'pointer', border: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: C.page, color: C.text, fontFamily: "'Google Sans Text','Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 64px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ height: 26, objectFit: 'contain' }} /> : <span style={{ fontWeight: 800 }}>{org}</span>}
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Assessment report</span>
        </div>

        {/* Hero: result + score ring */}
        <div style={{ ...cardStyle, marginBottom: 18 }}>
          <div style={sectionLabel}>Certification report</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, margin: '0 0 6px' }}>{data.certTitle}</h1>
          <p style={{ fontSize: 14.5, color: C.muted, margin: '0 0 24px' }}>{data.studentName} &middot; Completed {data.issueDate}</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={R} fill="none" stroke={C.track} strokeWidth={STROKE} />
                <circle cx="80" cy="80" r={R} fill="none" stroke={accent} strokeWidth={STROKE} strokeLinecap="round"
                  strokeDasharray={`${dash} ${CIRC}`} transform="rotate(-90 80 80)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{data.score}%</span>
                <span style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Overall</span>
              </div>
            </div>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, fontSize: 13.5, fontWeight: 700, marginBottom: 12, background: data.passed ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.12)', color: data.passed ? '#16a34a' : '#ef4444' }}>
                {data.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {data.passed ? 'Passed' : 'Not passed'}
              </div>
              <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.6, margin: 0 }}>
                Scored <strong style={{ color: C.text }}>{data.correctQuestions} of {data.totalQuestions}</strong> questions correct. Pass mark is {data.passmark}%.
              </p>
              {data.badgeImageUrl && <img src={data.badgeImageUrl} alt="" style={{ height: 56, marginTop: 16, objectFit: 'contain' }} />}
            </div>
          </div>
        </div>

        {/* Per-skill-area performance */}
        {data.skills.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 18 }}>
            <div style={sectionLabel}>Skills</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px' }}>Performance by skill area</h2>
            <div style={{ display: 'grid', gap: 18 }}>
              {data.skills.map(s => (
                <div key={s.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600 }}>{s.name}</span>
                    <span style={{ fontSize: 13, color: C.muted }}><strong style={{ color: C.text }}>{s.pct}%</strong> &middot; {s.correct}/{s.total}</span>
                  </div>
                  <div style={{ height: 9, borderRadius: 999, background: C.track, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.pct}%`, minWidth: s.pct > 0 ? 9 : 0, background: accent, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share + verification */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Share</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px' }}>Showcase your achievement</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button onClick={addToLinkedIn} style={{ ...btn, background: '#0a66c2', color: '#fff' }}>
              <Linkedin className="w-4 h-4" /> Add to LinkedIn profile
            </button>
            <button onClick={shareToLinkedIn} style={{ ...btn, background: hexToRgba(accent, 0.1), color: accent }}>
              <Linkedin className="w-4 h-4" /> Share a post
            </button>
            <button onClick={() => copy(reportUrl(), 'link')} style={{ ...btn, background: '#f1f4f9', color: C.text }}>
              {copied === 'link' ? <><Check className="w-4 h-4" /> Copied</> : <><Link2 className="w-4 h-4" /> Copy link</>}
            </button>
            <button onClick={() => openNew(certUrl())} style={{ ...btn, background: '#f1f4f9', color: C.text }}>
              <Award className="w-4 h-4" /> View certificate <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Suggested post text */}
          <div style={{ marginTop: 18, background: '#f7f9fc', border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>Suggested post</span>
              <button onClick={() => copy(suggestedText, 'text')} style={{ ...btn, padding: '6px 12px', fontSize: 12.5, background: hexToRgba(accent, 0.1), color: accent }}>
                {copied === 'text' ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Link2 className="w-3.5 h-3.5" /> Copy text</>}
              </button>
            </div>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.6, margin: 0 }}>{suggestedText}</p>
          </div>

          {/* Verification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 12.5, color: C.muted }}>
            <ShieldCheck className="w-4 h-4" style={{ color: accent }} />
            Verified credential &middot; ID <span style={{ fontFamily: 'ui-monospace, monospace', color: C.text }}>{data.certId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
