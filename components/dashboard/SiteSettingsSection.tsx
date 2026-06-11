'use client';

// Extracted verbatim from app/dashboard/page.tsx -- no behavior or styling changes.

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ExternalLink, Loader2, Upload, X, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadToCloudinary } from '@/lib/uploadToCloudinary';
import { TEMPLATES as SITE_TEMPLATES } from '@/lib/site-templates';
import { LIGHT_C, DARK_C } from '@/lib/theme';

function loadFont(family: string) {
  if (!family || family === 'Inter') return;
  const id = `gf-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  // Google Sans Text only ships 400/500/700 -- the css2 API 400s if you request
  // a weight a family doesn't have, so use the available subset for it.
  const weights = family === 'Google Sans Text' ? '400;500;700' : '400;500;600;700;800;900';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@${weights}&display=swap`;
  document.head.appendChild(link);
}

const FONT_OPTIONS = [
  'Inter', 'Google Sans Text', 'Plus Jakarta Sans', 'Space Grotesk', 'Outfit',
  'Syne', 'DM Sans', 'Poppins', 'Montserrat', 'Raleway', 'Nunito',
];

// --- Live preview ---
function SitePreview({ config, template, C }: { config: Record<string, string>; template: string; C: typeof LIGHT_C }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const [scale, setScale]           = useState(1);
  const [containerH, setContainerH] = useState(600);
  const [ready, setReady]           = useState(false);

  const INNER_W = 1440;

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setScale(width / INNER_W);
      setContainerH(height);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: 'preview-config', template, config },
      window.location.origin,
    );
  }, [config, template, ready]);

  const iframeH = scale > 0 ? Math.ceil(containerH / scale) : containerH;

  return (
    <div className="w-full rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${C.cardBorder}`, boxShadow: 'none', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
      {/* Clean header */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ background: C.card, borderBottom: `1px solid ${C.divider}` }}>
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[11px] font-semibold" style={{ color: C.text }}>Live preview</span>
        <span className="text-[11px]" style={{ color: C.faint }}>updates as you type</span>
      </div>

      {/* Scaled iframe */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'white' }}>
        <iframe
          ref={iframeRef}
          src="/"
          onLoad={() => setReady(true)}
          style={{
            width: INNER_W,
            height: iframeH,
            border: 'none',
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

// --- Site Settings Section ---
export function SiteSettingsSection({ C }: { C: typeof LIGHT_C }) {
  const isDark = C === DARK_C;
  const [template, setTemplate] = useState('momentum');
  const [config, setConfig]     = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['brand', 'hero']));
  const toggleSec = (id: string) => setOpenSections(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  useEffect(() => {
    fetch('/api/site-settings')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.data) {
          setTemplate(json.data.template ?? 'momentum');
          setConfig(json.data.config ?? {});
          // Pre-load saved fonts
          loadFont(json.data.config?.headingFont);
          loadFont(json.data.config?.bodyFont);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (key: string, value: string) => {
    if (key === 'headingFont' || key === 'bodyFont') loadFont(value);
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ template, config }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setMsg({ ok: true, text: 'Saved. Landing page will update within 60 seconds.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 6000);
    }
  };

  const tf = (key: string, label: string, placeholder: string, hint?: string) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
      <input type="text" value={config[key] ?? ''} onChange={e => set(key, e.target.value)}
        placeholder={placeholder} className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }} />
      {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
    </div>
  );

  const cf = (key: string, label: string, fallback: string, hint?: string) => {
    const val = config[key] || fallback;
    return (
      <div className="space-y-1">
        <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
        <div className="flex items-center gap-2">
          {/* Swatch -- native picker hidden underneath */}
          <label className="flex-shrink-0 cursor-pointer">
            <span className="block w-9 h-9 rounded-lg border-2 relative overflow-hidden"
              style={{ background: val, borderColor: C.cardBorder, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
              <input type="color" value={val} onChange={e => set(key, e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </span>
          </label>
          <input type="text" value={config[key] ?? ''} onChange={e => set(key, e.target.value)}
            placeholder={fallback} className="w-24 px-2 py-2 rounded-lg text-xs outline-none font-mono"
            style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }} />
        </div>
        {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
      </div>
    );
  };

  const taf = (key: string, label: string, placeholder: string, hint?: string, rows = 3) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
      <textarea value={config[key] ?? ''} onChange={e => set(key, e.target.value)}
        placeholder={placeholder} rows={rows} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
        style={{ background: C.pill, border: `1px solid ${C.cardBorder}`, color: C.text }} />
      {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
    </div>
  );

  const imgUpload = (key: string, label: string, hint?: string) => {
    const url = config[key] ?? '';
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(key);
      try {
        const uploaded = await uploadToCloudinary(file, 'site-assets');
        set(key, uploaded);
      } catch {}
      setUploading(null);
      e.target.value = '';
    };
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
        {url && (
          <div className="relative rounded-lg overflow-hidden" style={{ height: 90 }}>
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => set(key, '')}
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
          style={{ background: C.pill, color: C.text }}>
          {uploading === key
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Upload className="w-3.5 h-3.5" />}
          {url ? 'Replace image' : 'Upload image'}
          <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={!!uploading} />
        </label>
        {hint && <p className="text-[11px]" style={{ color: C.faint }}>{hint}</p>}
      </div>
    );
  };

  const fontPicker = (key: string, label: string, fallback: string) => (
    <div className="space-y-2">
      <label className="text-xs font-semibold" style={{ color: C.muted }}>{label}</label>
      <div className="grid grid-cols-2 gap-1.5">
        {FONT_OPTIONS.map(f => {
          loadFont(f);
          const active = (config[key] || fallback) === f;
          return (
            <button key={f} onClick={() => set(key, f)}
              className="px-3 py-2 rounded text-sm text-left transition-all"
              style={{
                fontFamily: `'${f}', sans-serif`,
                background:   active ? C.cta   : C.pill,
                color:        active ? C.ctaText : C.text,

              }}>
              {f}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Visibility toggle -- '1' means hidden
  const Vis = (key: string) => {
    const hidden = config[key] === '1';
    return (
      <div className="flex items-center justify-between pb-3 mb-1 border-b" style={{ borderColor: C.cardBorder }}>
        <span className="text-xs font-semibold" style={{ color: C.muted }}>Show this section</span>
        <button onClick={() => set(key, hidden ? '' : '1')}
          className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
          style={{ background: hidden ? C.cardBorder : (config.primaryColor || '#0e09dd') }}>
          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
            style={{ left: hidden ? 2 : 22 }} />
        </button>
      </div>
    );
  };

  // Accordion section wrapper
  const Sec = (id: string, label: string, preview: React.ReactNode, children: React.ReactNode) => (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: isDark ? 'none' : `1px solid ${C.cardBorder}`, boxShadow: 'none' }}>
      <button onClick={() => toggleSec(id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-opacity hover:opacity-70">
        <span className="flex-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: C.text }}>{label}</span>
        {preview && <span className="flex items-center gap-1">{preview}</span>}
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${openSections.has(id) ? 'rotate-180' : ''}`} style={{ color: C.faint }} />
      </button>
      {openSections.has(id) && (
        <div className="px-4 pb-5 pt-3 space-y-4 border-t" style={{ borderColor: C.cardBorder }}>
          {children}
        </div>
      )}
    </div>
  );
  // Colour swatch dot for section header preview
  const Dot = (k: string, fb: string) => (
    <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: config[k] || fb, border: '1.5px solid rgba(0,0,0,0.12)' }} />
  );
  // Sub-label divider inside a section
  const Sub = (t: string) => (
    <p className="text-[10px] font-bold uppercase tracking-[0.08em] mt-1 pb-1 border-b" style={{ color: C.faint, borderColor: C.cardBorder }}>{t}</p>
  );

  const handleOpenPreview = () => {
    try { localStorage.setItem('_site_preview', JSON.stringify({ template, config })); } catch {}
    window.open('/?_preview=1', '_blank');
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.faint }} />
    </div>
  );

  return (
    <div className="flex gap-4 items-start" style={{ minHeight: 'calc(100vh - 120px)' }}>

      {/* ---- Collapsable settings pane ---- */}
      <div style={{ width: panelOpen ? 400 : 0, overflow: 'hidden', flexShrink: 0, transition: 'width 0.25s ease' }}>
        <div style={{ width: 400 }} className="space-y-4 pb-6 pr-1">

        {/* Template selector -- always visible */}
        <div className="rounded-2xl p-4" style={{ background: C.card, border: isDark ? 'none' : `1px solid ${C.cardBorder}`, boxShadow: 'none' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: C.faint }}>Template</p>
          <div className="flex gap-2 flex-wrap">
            {SITE_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => { setTemplate(t.id); setOpenSections(new Set(['brand','hero'])); }}
                className="px-4 py-2 rounded text-sm font-semibold transition-all"
                style={{ background: template === t.id ? C.cta : C.pill, color: template === t.id ? C.ctaText : C.text }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Brand & Style */}
        {Sec('brand', 'Brand & Style',
          <>{Dot('primaryColor','#0e09dd')}{Dot('accentColor','#ff9933')}</>,
          <>
            <div className="grid grid-cols-2 gap-3">
              {cf('primaryColor', 'Primary colour', '#0e09dd', 'Nav, hero, buttons.')}
              {cf('accentColor',  'Accent colour',  '#ff9933', 'Highlights, icons, links.')}
            </div>
            {Sub('Typography')}
            {fontPicker('headingFont', 'Heading Font', 'Inter')}
            {fontPicker('bodyFont', 'Body Font', 'Inter')}
          </>
        )}

        {/* Navigation -- Elevate only */}
        {template === 'elevate' && Sec('nav', 'Navigation',
          <>{Dot('navBgColor','#ffffff')}{Dot('navTextColor','#111111')}</>,
          <>
            <div className="grid grid-cols-2 gap-3">
              {cf('navBgColor',   'Background', '#ffffff')}
              {cf('navTextColor', 'Text & links', '#111111')}
            </div>
          </>
        )}

        {/* Hero */}
        {Sec('hero', 'Hero',
          <>{Dot('primaryColor','#0e09dd')}</>,
          <>
            {imgUpload('heroImageUrl', 'Background Image', 'Leave blank to use a colour gradient.')}
            {config.heroImageUrl && <>
              {Sub('Image Overlay')}
              <div className="grid grid-cols-2 gap-3 mb-2">
                {cf('heroOverlayColor', 'Overlay colour', '#000000')}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: C.muted }}>Opacity</span>
                <input type="range" min="0" max="100" step="5"
                  value={config.heroOverlayOpacity ?? '58'}
                  onChange={e => set('heroOverlayOpacity', e.target.value)}
                  className="flex-1"
                  style={{ accentColor: config.primaryColor || '#0e09dd' }}
                />
                <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.heroOverlayOpacity ?? '58'}%</span>
              </div>
            </>}
            {tf('heroTitle',        'Headline',        'Build the skills Africa')}
            {tf('heroTitleAccent',  'Headline Accent', 'needs right now.', 'Shown in accent colour.')}
            {taf('heroSubheadline', 'Subheadline',     'Enrol in courses…', undefined, 3)}
            {tf('heroPrimaryCta',   'CTA Button Text', 'Start learning free')}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: C.muted }}>Hero Font Size</label>
                <span className="text-xs font-mono" style={{ color: C.faint }}>{config.heroFontSize || '62'}px</span>
              </div>
              <input type="range" min="36" max="96" step="1"
                value={config.heroFontSize || '62'}
                onChange={e => set('heroFontSize', e.target.value)}
                className="w-full" style={{ accentColor: config.primaryColor || '#0e09dd' }}
              />
              <p className="text-[11px]" style={{ color: C.faint }}>Desktop headline size -- mobile scales proportionally.</p>
            </div>
            {template === 'momentum' && (<>
              {Sub('Stats Bar')}
              <div className="grid grid-cols-2 gap-3">
                {tf('statsEnrolled', 'Enrolled count', '10,000+')}
                {tf('statsRating',   'Rating',         '4.9')}
              </div>
            </>)}
          </>
        )}

        {/* -- MOMENTUM SECTIONS -- */}
        {template === 'momentum' && (<>

        {Sec('offerings', 'Offerings',
          undefined,
          <>
            {Vis('hideOfferings')}
            {tf('offeringsLabel',         'Section label',  'What you get')}
            {tf('offeringsHeading',       'Heading',        'Everything you need to grow')}
            {tf('offeringsHeadingAccent', 'Heading accent', 'your career.', 'Shown in accent colour.')}
            {taf('offeringsSubtext',      'Subtext',        'From beginner courses to advanced projects.', undefined, 2)}
            {['1','2','3','4'].map(n => (
              <div key={n}>
                {Sub(`Card ${n}`)}
                {tf(`offering${n}Title`, 'Title', n==='1'?'Courses':n==='2'?'Live Events':n==='3'?'Guided Projects':'Certificates')}
                {taf(`offering${n}Description`, 'Description', '', undefined, 2)}
                {tf(`offering${n}Badge`, 'Badge', n==='1'?'Courses':n==='2'?'Events':n==='3'?'Projects':'Certificates')}
              </div>
            ))}
          </>
        )}

        {Sec('steps', 'How It Works',
          undefined,
          <>
            {Vis('hideSteps')}
            {tf('stepsLabel',         'Section label',  'Your journey')}
            {tf('stepsHeading',       'Heading',        'From zero to job-ready')}
            {tf('stepsHeadingAccent', 'Heading accent', 'in 3 steps.', 'Shown in accent colour.')}
            {['1','2','3'].map(n => (
              <div key={n}>
                {Sub(`Step ${n}`)}
                {tf(`step${n}Title`, 'Title', n==='1'?'Enrol in a course':n==='2'?'Learn and practise':'Earn and get hired')}
                {taf(`step${n}Body`, 'Body',  '', undefined, 2)}
              </div>
            ))}
          </>
        )}

        {Sec('features', 'Features',
          undefined,
          <>
            {Vis('hideFeatures')}
            {tf('featuresLabel',         'Section label',  'Platform features')}
            {tf('featuresHeading',       'Heading',        'Built for the serious')}
            {tf('featuresHeadingAccent', 'Heading accent', 'learner.', 'Shown in accent colour.')}
            {taf('featuresSubtext', 'Subtext', 'Every feature is designed to help you learn faster…', undefined, 2)}
            {tf('featuresCta', 'CTA button text', 'Start for free')}
            {Sub('Feature Chips')}
            {['1','2','3','4','5','6','7','8'].map(n => tf(`highlight${n}`, `Chip ${n}`, ''))}
          </>
        )}

        {Sec('m-testimonials', 'Testimonials',
          undefined,
          <>
            {Vis('hideTestimonials')}
            {tf('testimonialsLabel',   'Section label', 'What learners say')}
            {tf('testimonialsHeading', 'Heading',       'Real results from real people.')}
            {['1','2','3'].map(n => (
              <div key={n}>
                {Sub(`Testimonial ${n}`)}
                <div className="grid grid-cols-2 gap-2">
                  {tf(`testimonial${n}Name`, 'Name', n==='1'?'Amina Osei':n==='2'?'Chukwuemeka Nwosu':'Fatima Al-Hassan')}
                  {tf(`testimonial${n}Role`, 'Role', n==='1'?'Data Analyst, Accra':n==='2'?'BI Lead, Lagos':'HR Analytics Specialist')}
                </div>
                {taf(`testimonial${n}Text`, 'Quote', '', undefined, 3)}
              </div>
            ))}
          </>
        )}

        {Sec('m-cta', 'CTA Banner',
          <>{Dot('primaryColor','#0e09dd')}</>,
          <>
            {Vis('hideCta')}
            {tf('ctaHeading',       'Heading',        'Join 10,000+ professionals')}
            {tf('ctaHeadingAccent', 'Heading accent', 'building the future.', 'Shown in accent colour.')}
            {taf('ctaSubtext', 'Subtext', 'Start learning today. No credit card required.', undefined, 2)}
            {tf('ctaButton', 'Button text', 'Start learning free')}
          </>
        )}

        {Sec('m-sticky', 'Sticky CTA Bar',
          <>{Dot('primaryColor','#0e09dd')}</>,
          <>
            {Vis('hideStickyBar')}
            {tf('stickyCtaText',   'Bar text',    'Join 10,000+ learners building Africa\'s future.')}
            {tf('stickyCtaButton', 'Button label', 'Start for free')}
          </>
        )}

        {Sec('m-footer', 'Footer',
          <>{Dot('primaryColor','#0e09dd')}</>,
          <>
            {taf('footerTagline', 'Tagline', 'The learning platform built for professionals.', undefined, 2)}
            {Sub('Background Image')}
            {imgUpload('footerBgImageUrl', 'Background image', 'Optional -- replaces the solid colour background.')}
            {config.footerBgImageUrl && <>
              {Sub('Image Overlay')}
              <div className="grid grid-cols-2 gap-3 mb-2">
                {cf('footerOverlayColor', 'Overlay colour', '#000000')}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: C.muted }}>Opacity</span>
                <input type="range" min="0" max="100" step="5"
                  value={config.footerOverlayOpacity ?? '70'}
                  onChange={e => set('footerOverlayOpacity', e.target.value)}
                  className="flex-1"
                  style={{ accentColor: config.primaryColor || '#0e09dd' }}
                />
                <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.footerOverlayOpacity ?? '70'}%</span>
              </div>
            </>}
            {Sub('Custom Links Column')}
            {tf('footerLinksHeading', 'Column heading', 'Learn')}
            <div className="grid grid-cols-2 gap-2">
              {tf('footerLink1Label', 'Link 1 label', 'Courses')}
              {tf('footerLink1Url',   'Link 1 URL',   '/auth')}
              {tf('footerLink2Label', 'Link 2 label', 'Guided Projects')}
              {tf('footerLink2Url',   'Link 2 URL',   '/auth')}
              {tf('footerLink3Label', 'Link 3 label', 'Live Events')}
              {tf('footerLink3Url',   'Link 3 URL',   '/auth')}
              {tf('footerLink4Label', 'Link 4 label', 'Certificates')}
              {tf('footerLink4Url',   'Link 4 URL',   '/auth')}
            </div>
          </>
        )}

        </>)} {/* end Momentum-only */}

        {/* -- ELEVATE SECTIONS -- */}
        {template === 'elevate' && (<>

        {Sec('programmes', 'Programmes',
          <>{Dot('sectionLightBg','#ffffff')}{Dot('textHeadingColor','#111111')}{Dot('cardBadgeBg','#ffffff')}</>,
          <>
            {Sub('Section Label & Heading')}
            {tf('tracksLabel',         'Section label',  'Our programmes')}
            {tf('tracksHeading',       'Heading',        'Build skills that')}
            {tf('tracksHeadingAccent', 'Heading accent', 'open doors.', 'Shown in accent colour.')}
            {Sub('Section Colours')}
            {cf('sectionLightBg', 'Background', '#ffffff')}
            <div className="grid grid-cols-3 gap-2">
              {cf('textHeadingColor', 'Headings',  '#111111')}
              {cf('textBodyColor',    'Body text', '#6b7280')}
              {cf('textMutedColor',   'Muted',     '#9ca3af')}
            </div>
            {Sub('Card Badge')}
            <div className="grid grid-cols-2 gap-3">
              {cf('cardBadgeBg',   'Badge background', '#ffffff')}
              {cf('cardBadgeText', 'Badge text colour', '#1a1a2e')}
            </div>
            {Sub('Card Image Overlay')}
            <div className="grid grid-cols-2 gap-3 mb-2">
              {cf('cardOverlayColor', 'Overlay colour', '#0a0a1a')}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: C.muted }}>Opacity</span>
              <input type="range" min="0" max="100" step="5"
                value={config.cardOverlayOpacity ?? '55'}
                onChange={e => set('cardOverlayOpacity', e.target.value)}
                className="flex-1"
                style={{ accentColor: config.primaryColor || '#0e09dd' }}
              />
              <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.cardOverlayOpacity ?? '55'}%</span>
            </div>
            {Sub('Fallback Cards (shown when no live content)')}
            {['1','2','3'].map(n => (
              <div key={n}>
                {Sub(`Programme ${n}`)}
                {tf(`track${n}Title`, 'Title', n==='1'?'AI & Data':n==='2'?'Creative & Design':'Entrepreneurship')}
                {taf(`track${n}Description`, 'Description', '', undefined, 2)}
                {imgUpload(`track${n}ImageUrl`, 'Cover image')}
                {tf(`track${n}Badge`, 'Badge label', n==='1'?'Most popular':n==='2'?'Growing fast':'High impact')}
              </div>
            ))}
          </>
        )}

        {Sec('stats', 'Impact Stats',
          <>{Dot('sectionDarkBg','#0d0d0d')}{Dot('textOnDarkColor','#ffffff')}</>,
          <>
            {Vis('hideStats')}
            {Sub('Colours')}
            <div className="grid grid-cols-2 gap-3">
              {cf('sectionDarkBg',   'Background',  '#0d0d0d', 'Stats & footer background.')}
              {cf('textOnDarkColor', 'Text colour', '#ffffff',  'All text on dark sections.')}
            </div>
            {Sub('Content')}
            {tf('impactLabel', 'Section label', 'Our impact')}
            {['1','2','3','4'].map(n => (
              <div key={n} className="space-y-2">
                {Sub(`Stat ${n}`)}
                <div className="grid grid-cols-2 gap-2">
                  {tf(`stat${n}Value`, 'Value', n==='1'?'50,000+':n==='2'?'12,000+':n==='3'?'80%':'150+')}
                  {tf(`stat${n}Label`, 'Label', n==='1'?'Graduates':n==='2'?'Entrepreneurs':n==='3'?'Employment rate':'Countries')}
                </div>
                {imgUpload(`stat${n}ImageUrl`, 'Background image', 'Leave blank for a dark card.')}
              </div>
            ))}
            {Sub('Image Overlay')}
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="100" step="5"
                value={config.statImgOverlay ?? '60'}
                onChange={e => set('statImgOverlay', e.target.value)}
                className="flex-1"
                style={{ accentColor: config.primaryColor || '#0e09dd' }}
              />
              <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.statImgOverlay ?? '60'}%</span>
            </div>
          </>
        )}

        {Sec('partners', 'Partners Strip',
          <>{Dot('sectionAltBg','#f8f9fa')}{Dot('textOnAltColor','#111111')}</>,
          <>
            {Vis('hidePartners')}
            {Sub('Colours')}
            <div className="grid grid-cols-2 gap-3">
              {cf('sectionAltBg',   'Background',  '#f8f9fa', 'Partners & testimonials.')}
              {cf('textOnAltColor', 'Text colour', '#111111',  'Text on alternate sections.')}
            </div>
            {Sub('Content')}
            {tf('partnersLabel', 'Strip label', 'Trusted by leading organisations')}
            {['1','2','3','4','5','6'].map(n => (
              <div key={n} className="grid grid-cols-2 gap-2 items-end">
                {tf(`partner${n}Name`, `Partner ${n}`, n==='1'?'Google':n==='2'?'Microsoft':'Partner')}
                {imgUpload(`partner${n}LogoUrl`, 'Logo')}
              </div>
            ))}
          </>
        )}

        {Sec('testimonials', 'Testimonials',
          <>{Dot('sectionAltBg','#f8f9fa')}{Dot('textOnAltColor','#111111')}</>,
          <>
            {Vis('hideTestimonials')}
            {tf('testimonialsLabel',   'Section label', 'Success stories')}
            {tf('testimonialsHeading', 'Heading',       'Real people, real impact.')}
            {imgUpload('testimonialVideoUrl', 'Video thumbnail', 'Shows with a play button overlay.')}
            {['1','2','3'].map(n => (
              <div key={n}>
                {Sub(`Testimonial ${n}`)}
                <div className="grid grid-cols-2 gap-2">
                  {tf(`testimonial${n}Name`, 'Name', n==='1'?'Sarah Kimani':n==='2'?'David Mensah':'Amara Diallo')}
                  {tf(`testimonial${n}Role`, 'Role', n==='1'?'Data Scientist':n==='2'?'UX Designer':'Founder')}
                </div>
                {taf(`testimonial${n}Text`, 'Quote', '', undefined, 3)}
              </div>
            ))}
          </>
        )}

        {Sec('e-cta', 'CTA Banner',
          <>{Dot('primaryColor','#0e09dd')}{Dot('textOnDarkColor','#ffffff')}</>,
          <>
            {Vis('hideCta')}
            {tf('newsletterHeading',  'Heading',        'Ready to transform')}
            {tf('ctaHeadingAccent',   'Heading accent', 'your career?', 'Shown in accent colour.')}
            {taf('newsletterSubtext', 'Subtext',        'Join thousands of professionals…', undefined, 2)}
            {tf('newsletterButton',   'Button text',    'Start your journey')}
          </>
        )}

        {Sec('e-sticky', 'Sticky CTA Bar',
          <>{Dot('accentColor','#e94560')}</>,
          <>
            {Vis('hideStickyBar')}
            {tf('stickyCtaText',   'Bar text',    'Join 50,000+ ambitious professionals.')}
            {tf('stickyCtaButton', 'Button label', 'Explore programmes')}
          </>
        )}

        {Sec('e-footer', 'Footer',
          <>{Dot('sectionDarkBg','#0d0d0d')}{Dot('textOnDarkColor','#ffffff')}</>,
          <>
            {taf('footerTagline', 'Tagline', 'Empowering the next generation of professionals.', undefined, 2)}
            {Sub('Background Image')}
            {imgUpload('footerBgImageUrl', 'Background image', 'Optional -- replaces the solid colour background.')}
            {config.footerBgImageUrl && <>
              {Sub('Image Overlay')}
              <div className="grid grid-cols-2 gap-3 mb-2">
                {cf('footerOverlayColor', 'Overlay colour', '#0a0a1a')}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: C.muted }}>Opacity</span>
                <input type="range" min="0" max="100" step="5"
                  value={config.footerOverlayOpacity ?? '75'}
                  onChange={e => set('footerOverlayOpacity', e.target.value)}
                  className="flex-1"
                  style={{ accentColor: config.accentColor || '#e94560' }}
                />
                <span className="text-xs font-mono w-10 text-right" style={{ color: C.muted }}>{config.footerOverlayOpacity ?? '75'}%</span>
              </div>
            </>}
            {Sub('Custom Links Column')}
            {tf('footerLinksHeading', 'Column heading', 'Programmes')}
            <div className="grid grid-cols-2 gap-2">
              {tf('footerLink1Label', 'Link 1 label', 'AI & Data')}
              {tf('footerLink1Url',   'Link 1 URL',   '/auth')}
              {tf('footerLink2Label', 'Link 2 label', 'Creative & Design')}
              {tf('footerLink2Url',   'Link 2 URL',   '/auth')}
              {tf('footerLink3Label', 'Link 3 label', 'Entrepreneurship')}
              {tf('footerLink3Url',   'Link 3 URL',   '/auth')}
              {tf('footerLink4Label', 'Link 4 label', 'Certificates')}
              {tf('footerLink4Url',   'Link 4 URL',   '/auth')}
            </div>
          </>
        )}

        </>)} {/* end Elevate-only */}

        </div>
      </div>

      {/* ---- Preview pane ---- */}
      <div className="flex-1 min-w-0 sticky top-4 space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setPanelOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: C.pill, color: C.text }}
          >
            {panelOpen
              ? <><ArrowLeft className="w-3.5 h-3.5" /> Hide settings</>
              : <><ArrowRight className="w-3.5 h-3.5" /> Show settings</>
            }
          </button>
          <div className="flex-1" />
          <button
            onClick={handleOpenPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: C.pill, color: C.text }}
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-80"
            style={{ background: C.cta, color: C.ctaText }}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
        {msg && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}
            style={{ background: msg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
            {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            {msg.text}
          </div>
        )}
        <SitePreview config={config} template={template} C={C} />
      </div>

    </div>
  );
}
