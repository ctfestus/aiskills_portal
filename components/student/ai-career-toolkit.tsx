'use client';

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { LIGHT_C, DARK_C } from '@/lib/theme';
import {
  BriefcaseBusiness, Download, FileUser, Globe, GraduationCap, HelpCircle, MousePointerClick,
  Package, Plus, Puzzle, RefreshCw, Search, SlidersHorizontal, Terminal, Upload, X,
} from 'lucide-react';
import { downloadPortfolioPack } from '@/lib/student-portfolio-download';

// LinkedIn's brand mark (filled). lucide's stroked glyph reads thin next to a
// recognizable logo, so we use the canonical mark already used elsewhere in the app.
function LinkedInGlyph({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} style={style}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

type ToolkitDownload = {
  title: string;
  body: string;
  command: string;
  endpoint: string;
  filename: string;
  buttonLabel: string;
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>;
};

type HelpStep = {
  title: string;
  body: string;
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>;
};

const DOWNLOADS: ToolkitDownload[] = [
  {
    title: 'Portfolio Builder',
    body: 'Turn completed courses, virtual experiences, and reviewed assignments into a recruiter-ready project case study.',
    command: '/portfolio-builder',
    endpoint: '/api/portfolio',
    filename: 'portfolio-builder.zip',
    buttonLabel: 'Download skill',
    Icon: BriefcaseBusiness,
  },
  {
    title: 'AI Transcript',
    body: 'Package your full learning record into a Claude skill that renders a complete, professionally formatted transcript you can view, print, or export to PDF.',
    command: '/ai-transcript',
    endpoint: '/api/transcript',
    filename: 'ai-transcript.zip',
    buttonLabel: 'Download transcript',
    Icon: GraduationCap,
  },
  {
    title: 'LinkedIn Builder',
    body: 'Turn your courses, virtual experiences, assignments, learning paths, certificates, and badges into ready-to-paste LinkedIn entries with one-click add links for each credential.',
    command: '/linkedin-builder',
    endpoint: '/api/linkedin',
    filename: 'linkedin-builder.zip',
    buttonLabel: 'Download skill',
    Icon: LinkedInGlyph,
  },
  {
    title: 'Job Search and Apply Kit',
    body: 'Find live jobs that match your verified skills across LinkedIn, Indeed, Google Jobs and more, then generate a tailored resume and cover letter for each role from your completed work.',
    command: '/job-search',
    endpoint: '/api/job-search',
    filename: 'job-search-kit.zip',
    buttonLabel: 'Download skill',
    Icon: Search,
  },
  {
    title: 'Resume Builder',
    body: 'Turn your completed courses, virtual experiences, assignments, and certificates into a polished, ATS-friendly resume you can tailor to a target role and export to PDF.',
    command: '/resume-builder',
    endpoint: '/api/resume',
    filename: 'resume-builder.zip',
    buttonLabel: 'Download skill',
    Icon: FileUser,
  },
];

const HELP_STEPS: HelpStep[] = [
  {
    title: 'Open Claude.ai',
    body: 'Go to Claude.ai after downloading your skill zip from this page.',
    Icon: Globe,
  },
  {
    title: 'Click Customize',
    body: 'Use the left pane and open Customize.',
    Icon: SlidersHorizontal,
  },
  {
    title: 'Open Skills',
    body: 'Inside Customize, choose Skills.',
    Icon: Puzzle,
  },
  {
    title: 'Add a skill',
    body: 'Click the plus icon to add a new skill.',
    Icon: Plus,
  },
  {
    title: 'Create Skill',
    body: 'Choose Create skill, then pick Upload a skill.',
    Icon: Package,
  },
  {
    title: 'Upload the zip',
    body: 'Select the zip file you downloaded and upload it to Claude.',
    Icon: Upload,
  },
];

// Scoped, theme-driven styles. Colours come from CSS variables set on the root
// from the active palette, so the same rules adapt to light and dark.
const TOOLKIT_STYLES = `
.act { display: flex; flex-direction: column; gap: 1.5rem; }

.act-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; }
.act-eyebrow { display: inline-flex; align-items: center; gap: .55rem; font-size: .7rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--act-faint); }
.act-eyebrow::before { content: ""; inline-size: 1.6rem; block-size: 2px; background: var(--act-accent); border-radius: 2px; }
.act-h1 { font-size: clamp(1.5rem, 1.1rem + 1.8vw, 2.1rem); font-weight: 800; line-height: 1.1; letter-spacing: -.025em; color: var(--act-text); margin: .55rem 0 .5rem; text-wrap: balance; }
.act-lede { font-size: .95rem; line-height: 1.6; color: var(--act-muted); max-inline-size: 40rem; margin: 0; text-wrap: pretty; }
.act-help { display: inline-flex; align-items: center; gap: .45rem; font-size: .8125rem; font-weight: 600; color: var(--act-text); background: var(--act-pill); padding: .55rem .85rem; border-radius: .7rem; border: none; cursor: pointer; white-space: nowrap; transition: background-color .2s ease; }
.act-help:hover { background: color-mix(in oklab, var(--act-pill) 80%, var(--act-accent)); }
.act-help:focus-visible { outline: 2px solid var(--act-accent); outline-offset: 2px; }

.act-error { border-radius: .75rem; padding: .75rem 1rem; font-size: .875rem; font-weight: 500; background: var(--act-error-bg); color: var(--act-error-text); border: 1px solid var(--act-error-border); }

.act-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(19rem, 100%), 1fr)); gap: 1rem; }

.act-card { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: .85rem; text-align: left; padding: 1.3rem 1.3rem 1.1rem; border-radius: 1rem; background: var(--act-card); color: var(--act-text); border: none; font: inherit; inline-size: 100%; cursor: pointer; translate: 0 0; transition: translate .25s ease, box-shadow .25s ease, background-color .25s ease; }
.act-card::before { content: ""; position: absolute; inset-block-start: 0; inset-inline: 0; block-size: 2px; background: var(--act-accent); scale: 0 1; transform-origin: left; transition: scale .28s ease; }
.act-card:hover, .act-card:focus-visible { translate: 0 -4px; box-shadow: var(--act-hover-shadow); background: color-mix(in oklab, var(--act-card) 96%, var(--act-accent)); }
.act-card:hover::before, .act-card:focus-visible::before { scale: 1 1; }
.act-card:focus-visible { outline: 2px solid var(--act-accent); outline-offset: 2px; }
.act-card:disabled { cursor: default; }
.act-card[data-busy="false"]:disabled { opacity: .5; }

.act-icon { inline-size: 2.7rem; block-size: 2.7rem; border-radius: .8rem; display: grid; place-items: center; flex: none; background: color-mix(in oklab, var(--act-accent) 13%, transparent); color: var(--act-accent); }
.act-title { font-size: 1.0625rem; font-weight: 650; line-height: 1.25; letter-spacing: -.01em; color: var(--act-text); text-wrap: balance; }
.act-desc { font-size: .8125rem; line-height: 1.55; color: var(--act-muted); margin: .3rem 0 0; text-wrap: pretty; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.act-foot { margin-block-start: auto; display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding-block-start: .85rem; border-block-start: 1px solid var(--act-divider); }
.act-cmd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .72rem; padding: .28rem .5rem; border-radius: .5rem; background: var(--act-pill); color: var(--act-muted); }
.act-go { display: inline-flex; align-items: center; gap: .4rem; font-size: .8125rem; font-weight: 600; color: var(--act-accent); white-space: nowrap; }
.act-go svg { translate: 0 0; transition: translate .2s ease; }
.act-card:hover .act-go svg { translate: 0 2px; }

.act-scrim { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(15, 18, 20, .5); backdrop-filter: blur(8px) saturate(1.1); animation: act-fade .2s ease both; }
.act-modal { position: relative; inline-size: 100%; max-inline-size: 40rem; max-block-size: calc(100dvh - 2rem); overflow: hidden auto; border-radius: 1.25rem; background: var(--act-card); box-shadow: var(--act-modal-shadow); animation: act-pop .3s cubic-bezier(.2, .8, .2, 1) both; }
.act-modal::before { content: ""; position: absolute; inset-block-start: 0; inset-inline: 0; block-size: 3px; background: var(--act-accent); }
.act-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1.3rem 1.4rem; border-block-end: 1px solid var(--act-divider); }
.act-modal-kicker { font-size: .62rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--act-faint); }
.act-modal-title { margin: .35rem 0 .25rem; font-size: 1.05rem; font-weight: 750; line-height: 1.2; color: var(--act-text); display: flex; align-items: center; gap: .5rem; }
.act-modal-title svg { color: var(--act-accent); }
.act-modal-sub { margin: 0; font-size: .78rem; color: var(--act-muted); }
.act-x { inline-size: 2rem; block-size: 2rem; border-radius: .6rem; display: grid; place-items: center; flex: none; cursor: pointer; background: var(--act-pill); border: none; color: var(--act-muted); transition: background-color .2s ease, color .2s ease; }
.act-x:hover { background: color-mix(in oklab, var(--act-pill) 80%, var(--act-accent)); color: var(--act-text); }
.act-x:focus-visible { outline: 2px solid var(--act-accent); outline-offset: 2px; }
.act-modal-body { padding: 1.3rem 1.4rem 1.4rem; }
.act-steps { display: grid; grid-template-columns: repeat(2, 1fr); gap: .7rem; }
.act-step { display: flex; gap: .8rem; align-items: flex-start; padding: .95rem; border-radius: .85rem; background: var(--act-pill); translate: 0 0; transition: background-color .2s ease, translate .2s ease; }
.act-step:hover { background: color-mix(in oklab, var(--act-pill) 88%, var(--act-accent)); translate: 0 -2px; }
.act-step-ic { inline-size: 2.3rem; block-size: 2.3rem; border-radius: .65rem; display: grid; place-items: center; flex: none; background: color-mix(in oklab, var(--act-accent) 14%, transparent); color: var(--act-accent); }
.act-step-ic svg { width: 18px; height: 18px; }
.act-step-n { font-size: .6rem; font-weight: 700; letter-spacing: .09em; color: var(--act-faint); }
.act-step-t { margin: .15rem 0 .2rem; font-size: .83rem; font-weight: 700; color: var(--act-text); }
.act-step-b { margin: 0; font-size: .73rem; line-height: 1.5; color: var(--act-muted); }
.act-note { display: flex; gap: .6rem; align-items: flex-start; margin-block-start: .9rem; border-radius: .85rem; padding: .85rem 1rem; font-size: .74rem; line-height: 1.55; color: var(--act-text); background: color-mix(in oklab, var(--act-accent) 10%, transparent); }
.act-note svg { width: 1rem; height: 1rem; flex: none; margin-block-start: .1rem; color: var(--act-accent); }
.act-note code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; color: var(--act-accent); }

@keyframes act-fade { from { opacity: 0; } }
@keyframes act-pop { from { opacity: 0; translate: 0 10px; scale: .98; } }

@media (max-width: 560px) { .act-steps { grid-template-columns: 1fr; } .act-scrim { align-items: flex-end; } }

@media (prefers-reduced-motion: reduce) {
  .act-card, .act-card::before, .act-go svg, .act-help, .act-step, .act-x { transition: none; }
  .act-card:hover, .act-card:focus-visible, .act-step:hover { translate: 0 0; }
  .act-scrim, .act-modal { animation: none; }
}
`;

async function downloadPackage(item: ToolkitDownload) {
  if (item.endpoint === '/api/portfolio') {
    await downloadPortfolioPack();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const res = await fetch(item.endpoint, { headers });
  if (!res.ok) throw new Error('Download failed');

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = item.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function AiCareerToolkitSection({ C }: { C: typeof LIGHT_C }) {
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  async function handleDownload(item: ToolkitDownload) {
    setActiveDownload(item.filename);
    setError(null);
    try {
      await downloadPackage(item);
    } catch (err) {
      console.error('[AI Career Toolkit]', err);
      setError('Could not prepare that skill package. Please try again.');
    } finally {
      setActiveDownload(null);
    }
  }

  useEffect(() => {
    if (!showHelp) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowHelp(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showHelp]);

  const isDark = C.page === DARK_C.page;
  const themeVars = {
    '--act-accent':       C.cta,
    '--act-card':         C.card,
    '--page':             C.page,
    '--act-text':         C.text,
    '--act-muted':        C.muted,
    '--act-faint':        C.faint,
    '--act-divider':      C.divider,
    '--act-pill':         C.pill,
    '--act-hover-shadow': C.hoverShadow,
    '--act-modal-shadow': isDark ? '0 24px 60px rgba(0,0,0,0.5)' : '0 24px 80px rgba(0,0,0,0.35)',
    '--act-error-bg':     C.errorBg,
    '--act-error-text':   C.errorText,
    '--act-error-border': C.errorBorder,
  } as CSSProperties;

  return (
    <div className="act" style={themeVars}>
      <style>{TOOLKIT_STYLES}</style>

      <header className="act-header">
        <div>
          <span className="act-eyebrow">Career toolkit</span>
          <h2 className="act-h1">Turn your learning into career assets</h2>
          <p className="act-lede">
            Each tool packages your verified activity into a Claude skill. Download it, add it to Claude,
            then run the command to generate the asset.
          </p>
        </div>
        <button type="button" className="act-help" onClick={() => setShowHelp(true)}>
          <HelpCircle className="w-4 h-4" />
          How to use these
        </button>
      </header>

      {error && <div className="act-error" role="alert">{error}</div>}

      <div className="act-grid">
        {DOWNLOADS.map((item) => {
          const busy = activeDownload === item.filename;
          const Icon = item.Icon;
          return (
            <button
              key={item.filename}
              type="button"
              className="act-card"
              data-busy={busy ? 'true' : 'false'}
              disabled={!!activeDownload}
              onClick={() => handleDownload(item)}
              aria-label={`${item.title}: download skill`}
            >
              <span className="act-icon"><Icon className="w-5 h-5" /></span>
              <div>
                <div className="act-title">{item.title}</div>
                <p className="act-desc">{item.body}</p>
              </div>
              <div className="act-foot">
                <span className="act-cmd">{item.command}</span>
                <span className="act-go">
                  {busy
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Preparing</>
                    : <>Download <Download className="w-3.5 h-3.5" /></>}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {showHelp && (
        <div className="act-scrim" onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div className="act-modal" role="dialog" aria-modal="true" aria-label="How to use these skills">
            <div className="act-modal-head">
              <div>
                <span className="act-modal-kicker">Getting started</span>
                <h3 className="act-modal-title">
                  <MousePointerClick className="w-4 h-4" />
                  Upload your skill to Claude.ai
                </h3>
                <p className="act-modal-sub">Follow these clicks after downloading your zip file.</p>
              </div>
              <button type="button" className="act-x" aria-label="Close" onClick={() => setShowHelp(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="act-modal-body">
              <div className="act-steps">
                {HELP_STEPS.map((step, i) => {
                  const Icon = step.Icon;
                  return (
                    <div key={step.title} className="act-step">
                      <span className="act-step-ic"><Icon /></span>
                      <div className="min-w-0">
                        <span className="act-step-n">STEP {i + 1}</span>
                        <p className="act-step-t">{step.title}</p>
                        <p className="act-step-b">{step.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="act-note">
                <Terminal className="w-4 h-4" />
                <span>After upload, start a new Claude chat and run <code>/portfolio-builder</code>, <code>/ai-transcript</code>, <code>/linkedin-builder</code>, <code>/job-search</code>, or <code>/resume-builder</code>.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
