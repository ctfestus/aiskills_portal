'use client';

import { useState } from 'react';
import { useTenant } from '@/components/TenantProvider';
import { ShieldCheck, Calendar, Linkedin, Link2, Check, Award, ExternalLink } from 'lucide-react';
import type { CertReportData, SkillResult } from '@/lib/cert-report';

function hexToRgba(hex: string, a: number): string {
  const h = String(hex || '').replace('#', '');
  if (h.length === 6) { const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  return `rgba(62,147,255,${a})`;
}
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export default function CertReportClient({ data }: { data: CertReportData }) {
  const { brandColor, appName, orgName, logoUrl } = useTenant();
  const accent = brandColor || '#3E93FF';
  const org = orgName || appName || 'our platform';
  const issued = new Date(data.issuedAt);
  const firstName = data.studentName.split(' ')[0] || data.studentName;

  const suggestedText = `I'm pleased to share that I have completed the ${data.certTitle}${data.skills.length ? `, covering ${data.skills.map(s => s.name).join(', ')}` : ''}.`;
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

  // Dark palette (mirrors the reference report).
  const C = { page: '#15161d', card: '#1e1f27', cardAlt: '#23242f', text: '#e8eaf0', muted: '#9097a5', faint: '#6b7280', track: '#2a2c37', border: 'rgba(255,255,255,0.08)' };

  // Stylized score-distribution curve. The bars follow a fixed bell shape; the marker sits at the
  // student's percentile (or score, when there are too few test-takers to compute a percentile).
  const N = 46, mid = N * 0.58, sigma = N * 0.2;
  const bars = Array.from({ length: N }, (_, i) => Math.exp(-((i - mid) ** 2) / (2 * sigma * sigma)));
  const markerPct = data.percentile != null ? data.percentile : data.score;

  const STRONG = 70;
  const strengths = data.skills.filter(s => s.pct >= STRONG);
  const gaps = data.skills.filter(s => s.pct < STRONG);

  const card = { background: C.card, borderRadius: 18, padding: 24, border: `1px solid ${C.border}` };
  const eyebrow = { fontSize: 12, fontWeight: 800 as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.muted, marginBottom: 12 };
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 as const, padding: '11px 18px', borderRadius: 12, cursor: 'pointer', border: 'none' };

  const SkillRow = (s: SkillResult) => (
    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
      <span style={{ flex: '0 0 150px', fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: C.track, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${s.pct}%`, minWidth: s.pct > 0 ? 8 : 0, background: accent, borderRadius: 999 }} />
      </div>
      <span style={{ flex: '0 0 auto', fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{s.correct}/{s.total}</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.page, color: C.text, fontFamily: "'Google Sans Text','Inter',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 22px 72px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          {logoUrl ? <img src={logoUrl} alt="" style={{ height: 26, objectFit: 'contain' }} /> : <span style={{ fontWeight: 800 }}>{org}</span>}
        </div>

        {/* Hero: statement (left) + profile (right) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start', marginBottom: 36 }}>
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <div style={eyebrow}>Assessment report</div>
            <h1 style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', margin: '0 0 16px' }}>{data.certTitle}</h1>
            <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.6, margin: '0 0 18px', maxWidth: 560 }}>
              {firstName} scored <span style={{ color: C.text, fontWeight: 700 }}>{data.score}%</span>.
              {data.percentile != null && <> They performed better than {data.percentile}% of others who took this certification.</>}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13.5, color: C.muted, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ShieldCheck className="w-4 h-4" style={{ color: '#3E93FF' }} /> Credentials verified</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Calendar className="w-4 h-4" /> {data.issueDate}</span>
            </div>
          </div>

          {/* Profile card */}
          <div style={{ flex: '0 1 300px', minWidth: 0 }}>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 26 }}>
              {data.studentAvatarUrl
                ? <img src={data.studentAvatarUrl} alt="" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 96, height: 96, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800 }}>{firstName.charAt(0).toUpperCase()}</div>}
            </div>
            <div style={{ padding: '16px 4px 0' }}>
              <div style={{ ...eyebrow, marginBottom: 6 }}>Certified</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{data.studentName}</div>
              <div style={{ fontSize: 13.5, color: C.muted, marginTop: 2 }}>{data.certTitle}</div>
            </div>
          </div>
        </div>

        {/* Score distribution */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ position: 'relative', height: 150, marginLeft: 8 }}>
            {/* marker line + score label */}
            <div style={{ position: 'absolute', top: 0, bottom: 22, left: `${markerPct}%`, width: 0, borderLeft: `2px dashed ${C.muted}`, zIndex: 2 }}>
              <span style={{ position: 'absolute', top: -10, left: -18, background: '#fff', color: '#111', fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>{data.score}</span>
            </div>
            {/* bars */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
              {bars.map((h, i) => {
                const barPct = ((i + 0.5) / N) * 100;
                return <div key={i} style={{ flex: 1, height: `${Math.max(6, h * 116)}px`, borderRadius: 4, background: barPct <= markerPct ? accent : C.track }} />;
              })}
            </div>
            {/* percentile caption under the marker */}
            <div style={{ position: 'absolute', bottom: 0, left: `${markerPct}%`, transform: 'translateX(-6px)', fontSize: 12.5, color: C.muted, whiteSpace: 'nowrap' }}>
              {data.percentile != null ? `${ordinal(data.percentile)} percentile` : 'Your score'}
            </div>
          </div>
        </div>

        {/* Knowledge summary */}
        {data.skills.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Knowledge summary</h2>
            <p style={{ fontSize: 15, color: C.muted, margin: '0 0 24px' }}>Performance by skill area, showing strengths and areas to improve.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 18px' }}>Strengths</h3>
                {strengths.length ? strengths.map(SkillRow)
                  : <p style={{ fontSize: 14, color: C.faint, textAlign: 'center', padding: '24px 0' }}>No observable strengths for this report.</p>}
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 18px' }}>Areas to improve</h3>
                {gaps.length ? gaps.map(SkillRow)
                  : <p style={{ fontSize: 14, color: C.faint, textAlign: 'center', padding: '24px 0' }}>No skill gaps for this report.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Share + verification */}
        <div style={card}>
          <div style={eyebrow}>Share</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px' }}>Showcase your achievement</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button onClick={addToLinkedIn} style={{ ...btn, background: '#0a66c2', color: '#fff' }}><Linkedin className="w-4 h-4" /> Add to LinkedIn profile</button>
            <button onClick={shareToLinkedIn} style={{ ...btn, background: hexToRgba(accent, 0.16), color: accent }}><Linkedin className="w-4 h-4" /> Share a post</button>
            <button onClick={() => copy(reportUrl(), 'link')} style={{ ...btn, background: C.cardAlt, color: C.text }}>
              {copied === 'link' ? <><Check className="w-4 h-4" /> Copied</> : <><Link2 className="w-4 h-4" /> Copy link</>}
            </button>
            <button onClick={() => openNew(certUrl())} style={{ ...btn, background: C.cardAlt, color: C.text }}><Award className="w-4 h-4" /> View certificate <ExternalLink className="w-3.5 h-3.5" /></button>
          </div>
          <div style={{ marginTop: 18, background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>Suggested post</span>
              <button onClick={() => copy(suggestedText, 'text')} style={{ ...btn, padding: '6px 12px', fontSize: 12.5, background: hexToRgba(accent, 0.16), color: accent }}>
                {copied === 'text' ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Link2 className="w-3.5 h-3.5" /> Copy text</>}
              </button>
            </div>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.6, margin: 0 }}>{suggestedText}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 12.5, color: C.muted }}>
            <ShieldCheck className="w-4 h-4" style={{ color: '#3E93FF' }} />
            Verified credential &middot; ID <span style={{ fontFamily: 'ui-monospace, monospace', color: C.text }}>{data.certId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
