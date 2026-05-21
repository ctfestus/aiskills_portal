'use client';

import { useEffect, useRef, useState } from 'react';
import { sanitizeRichText } from '@/lib/sanitize';
import Link from 'next/link';
import { AnimatePresence } from 'motion/react';
import {
  Search, X, Database, Download, Table2, Wand2,
  Copy, Check, Loader2, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useTenant } from '@/components/TenantProvider';

// --- Design tokens (mirrored from student page) ---
const LIGHT_C = {
  page:       '#F2F5FA',
  nav:        'rgba(255,255,255,0.98)',
  navBorder:  'rgba(0,0,0,0.07)',
  card:       'white',
  cardBorder: 'rgba(0,0,0,0.07)',
  cardShadow: '0 2px 12px rgba(0,0,0,0.08)',
  green:      '#0e09dd',
  lime:       '#e0e0f5',
  cta:        '#0e09dd',
  ctaText:    'white',
  text:       '#111',
  muted:      '#555',
  faint:      '#888',
  divider:    'rgba(0,0,0,0.07)',
  pill:       '#F4F4F4',
  input:      '#F7F7F7',
  skeleton:   '#EBEBEB',
};
const DARK_C = {
  page:       '#17181E',
  nav:        '#1E1F26',
  navBorder:  'rgba(255,255,255,0.07)',
  card:       '#1E1F26',
  cardBorder: 'rgba(255,255,255,0.07)',
  cardShadow: '0 4px 20px rgba(0,0,0,0.45)',
  green:      '#3E93FF',
  lime:       'rgba(62,147,255,0.15)',
  cta:        '#3E93FF',
  ctaText:    'white',
  text:       '#f8fafc',
  muted:      '#A8B5C2',
  faint:      '#6b7a89',
  divider:    'rgba(255,255,255,0.07)',
  pill:       '#2a2b34',
  input:      '#2a2b34',
  skeleton:   '#2a2b34',
};
function useC() { const { theme } = useTheme(); return theme === 'dark' ? DARK_C : LIGHT_C; }

function Sk({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  const C = useC();
  return <div style={{ width: w, height: h, borderRadius: r, background: C.skeleton, flexShrink: 0 }} className="animate-pulse" />;
}

// --- Types ---
type DatasetFile = { name: string; url: string };
type PreviewEntry = { name: string; type: 'csv' | 'pdf' | 'xlsx'; content: string; blobUrl?: string; xlsxBuf?: ArrayBuffer; sheetName?: string };

interface DCDataset {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  tags: string[];
  category: string | null;
  sample_questions: string[];
  file_url: string | null;
  file_name: string | null;
  files?: DatasetFile[] | null;
  row_count: number | null;
  source: string | null;
  source_url: string | null;
  scenario: string | null;
  disclaimer: string | null;
  table_type: 'single' | 'multiple' | null;
}

// --- AI Prompt builder ---
function buildAIPrompt(d: DCDataset): string {
  const files = getDatasetFiles(d);
  const lines: string[] = [
    `I have a dataset called "${d.title}".`,
    '',
    d.description ? `Description: ${d.description}` : '',
    '',
    files.length === 1 ? `Data URL: ${files[0].url}` : '',
    files.length > 1 ? `Data files:\n${files.map(file => `- ${file.name}: ${file.url}`).join('\n')}` : '',
  ];
  if (d.sample_questions.length > 0) {
    lines.push('', 'Sample questions to explore:');
    d.sample_questions.forEach(q => lines.push(`- ${q}`));
  }
  lines.push('', 'Please generate:', '1) A SQL CREATE TABLE statement with 10 sample INSERT rows.', '2) A Python pandas script to load and explore this data.', '3) Suggested SQL queries to answer the sample questions above.');
  return lines.filter(l => l !== undefined).join('\n');
}

function getDatasetFiles(d: DCDataset): DatasetFile[] {
  const seen = new Set<string>();
  const files: DatasetFile[] = [];
  const add = (name: string | null | undefined, url: string | null | undefined) => {
    const cleanUrl = url?.trim();
    if (!cleanUrl || seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    files.push({ name: name?.trim() || cleanUrl.split('/').pop() || 'Dataset file', url: cleanUrl });
  };
  add(d.file_name, d.file_url);
  (d.files ?? []).forEach(file => add(file.name, file.url));
  return files;
}

// --- Dataset detail pane ---
function DatasetDetailPane({ dataset, C, onClose }: { dataset: DCDataset; C: typeof LIGHT_C; onClose: () => void }) {
  const [copied, setCopied]           = useState(false);
  const [colabCopied, setColabCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview]         = useState<string[][] | null>(null);
  const [headers, setHeaders]         = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pdfUrl, setPdfUrl]           = useState<string | null>(null);
  const [zipTables, setZipTables]     = useState<PreviewEntry[]>([]);
  const [activeTable, setActiveTable] = useState('');
  const blobUrlsRef = useRef<string[]>([]);
  useEffect(() => () => { blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u)); }, []);
  const datasetFiles = getDatasetFiles(dataset);
  const prompt = buildAIPrompt(dataset);
  const font = 'var(--font-sans, Inter, sans-serif)';

  async function openPreview() {
    setShowPreview(true);
    if (preview !== null || zipTables.length > 0 || pdfUrl) return;
    setLoadingPreview(true);
    try {
      const entries = (await Promise.all(datasetFiles.map(file => loadPreviewEntries(file, datasetFiles.length > 1)))).flat();
      setZipTables(entries);
      const firstPreviewable = entries.find(e => e.type === 'csv' || e.type === 'xlsx') ?? entries[0];
      setActiveTable(firstPreviewable?.name ?? '');
      if (firstPreviewable?.type === 'csv') parseCSVContent(firstPreviewable.content);
      if (firstPreviewable?.type === 'xlsx' && firstPreviewable.xlsxBuf) parseXLSXBuffer(firstPreviewable.xlsxBuf, firstPreviewable.sheetName);
      if (!firstPreviewable) setPreview([]);
    } catch { setPreview([]); }
    setLoadingPreview(false);
  }

  async function loadPreviewEntries(file: DatasetFile, includeFilePrefix: boolean): Promise<PreviewEntry[]> {
    const lower = file.url.toLowerCase();
    const proxyUrl = `/api/data-center/proxy?url=${encodeURIComponent(file.url)}`;
    const displayName = (name: string) => includeFilePrefix ? `${file.name}: ${name}` : name;
    if (lower.endsWith('.zip')) {
      const JSZip = (await import('jszip')).default;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Proxy error ${res.status}${err.error ? `: ${err.error}` : ''}`);
      }
      const buf = await res.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      return Promise.all(
        Object.keys(zip.files)
          .filter(n => !zip.files[n].dir && (n.toLowerCase().endsWith('.csv') || n.toLowerCase().endsWith('.pdf') || n.toLowerCase().endsWith('.xlsx') || n.toLowerCase().endsWith('.xls')))
          .map(async n => {
            const base = n.replace(/^.*\//, '');
            if (n.toLowerCase().endsWith('.pdf')) {
              const bytes = await zip.files[n].async('arraybuffer');
              const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
              blobUrlsRef.current.push(url);
              return { name: displayName(base), type: 'pdf' as const, content: '', blobUrl: url };
            }
            if (n.toLowerCase().endsWith('.xlsx') || n.toLowerCase().endsWith('.xls')) {
              const bytes = await zip.files[n].async('arraybuffer');
              return expandXLSXEntries(bytes, displayName(base), true);
            }
            return { name: displayName(base), type: 'csv' as const, content: await zip.files[n].async('string') };
          })
      ).then(items => items.flat());
    }

    const res = await fetch(proxyUrl);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Proxy error ${res.status}${err.error ? `: ${err.error}` : ''}`);
    }
    if (lower.endsWith('.pdf')) {
      const bytes = await res.arrayBuffer();
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      blobUrlsRef.current.push(url);
      return [{ name: file.name, type: 'pdf', content: '', blobUrl: url }];
    }
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      return expandXLSXEntries(await res.arrayBuffer(), file.name, includeFilePrefix);
    }
    return [{ name: file.name, type: 'csv', content: await res.text() }];
  }

  async function expandXLSXEntries(buf: ArrayBuffer, fileName: string, includeFilePrefix: boolean): Promise<PreviewEntry[]> {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array', bookSheets: true });
    const sheets = wb.SheetNames.length ? wb.SheetNames : ['Sheet 1'];
    return sheets.map(sheetName => ({
      name: sheets.length > 1 ? (includeFilePrefix ? `${fileName}: ${sheetName}` : sheetName) : fileName,
      type: 'xlsx' as const,
      content: '',
      xlsxBuf: buf,
      sheetName,
    }));
  }

  function parseCSVContent(csv: string) {
    import('papaparse').then(({ default: Papa }) => {
      const result = Papa.parse(csv, { header: true, preview: 10 });
      setHeaders((result.meta as any).fields ?? []);
      setPreview(result.data.map((row: any) => ((result.meta as any).fields ?? []).map((f: string) => String(row[f] ?? ''))));
    });
  }

  function parseXLSXBuffer(buf: ArrayBuffer, sheetName?: string) {
    import('xlsx').then(XLSX => {
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][];
      if (rows.length === 0) { setHeaders([]); setPreview([]); return; }
      const hdrs = rows[0].map(String);
      setHeaders(hdrs);
      setPreview(rows.slice(1, 11).map(r => hdrs.map((_, i) => String(r[i] ?? ''))));
    });
  }

  function switchTable(name: string) {
    const table = zipTables.find(t => t.name === name);
    if (!table) return;
    setActiveTable(name);
    if (table.type === 'pdf') return;
    setHeaders([]);
    setPreview(null);
    if (table.type === 'xlsx' && table.xlsxBuf) { parseXLSXBuffer(table.xlsxBuf, table.sheetName); return; }
    parseCSVContent(table.content);
  }

  const colabCode = (() => {
    const url = datasetFiles[0]?.url;
    if (!url) return null;
    const lower = url.toLowerCase();
    if (lower.endsWith('.zip')) {
      return `import pandas as pd\nimport zipfile\nimport requests\nimport io\n\nurl = "${url}"\nresponse = requests.get(url)\n\ndataframes = {}\nwith zipfile.ZipFile(io.BytesIO(response.content)) as z:\n    csv_files = [f for f in z.namelist() if f.lower().endswith('.csv')]\n    for csv_file in csv_files:\n        with z.open(csv_file) as f:\n            name = csv_file.split('/')[-1].replace('.csv', '').replace(' ', '_')\n            dataframes[name] = pd.read_csv(f)\n\nfor name, df in dataframes.items():\n    globals()[name] = df\n\nfor name, df in dataframes.items():\n    print(f"\\n{'='*60}")\n    print(f"Table: {name}  |  {len(df):,} rows  x  {len(df.columns)} columns")\n    print('='*60)\n    display(df.head(10))\n\nprint("\\nAvailable tables:", list(dataframes.keys()))`;
    }
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      return `import pandas as pd\n\nurl = "${url}"\nsheets = pd.read_excel(url, sheet_name=None)\n\nfor name, df in sheets.items():\n    globals()[name.replace(' ', '_')] = df\n\nfor name, df in sheets.items():\n    print(f"\\n{'='*60}")\n    print(f"Sheet: {name}  |  {len(df):,} rows  x  {len(df.columns)} columns")\n    print('='*60)\n    display(df.head(10))\n\nprint("\\nAvailable sheets:", list(sheets.keys()))`;
    }
    return `import pandas as pd\n\nurl = "${url}"\ndf = pd.read_csv(url)\n\nprint(f"{len(df):,} rows  x  {len(df.columns)} columns")\ndisplay(df.head(10))`;
  })();

  function copyPrompt() { navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }
  function copyPython() { if (!colabCode) return; navigator.clipboard.writeText(colabCode).then(() => { setColabCopied(true); setTimeout(() => setColabCopied(false), 2000); }); }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-8" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full flex flex-col" style={{ maxWidth: 980, maxHeight: '94vh', background: C.card, borderRadius: 20, overflow: 'hidden', fontFamily: font, boxShadow: '0 32px 80px rgba(0,0,0,0.28)' }}>

        {/* Cover */}
        <div style={{ padding: '16px 16px 0', flexShrink: 0, background: C.card }}>
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', height: 240, background: C.input }}>
            {dataset.cover_image_url
              ? <img src={dataset.cover_image_url} alt={dataset.cover_image_alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Database size={56} style={{ color: C.faint }} /></div>
            }
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 24px' }}>
              {dataset.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {dataset.tags.map(t => <span key={t} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 700, backdropFilter: 'blur(4px)', letterSpacing: 0.3 }}>{t}</span>)}
                </div>
              )}
              <h2 style={{ fontWeight: 900, fontSize: 22, color: 'white', margin: 0, lineHeight: 1.25, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>{dataset.title}</h2>
            </div>
            <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', backdropFilter: 'blur(4px)' }}>
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '32px 36px 40px' }}>
          {/* Meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {dataset.category && <span style={{ fontSize: 13, fontWeight: 700, color: C.muted, padding: '4px 12px', borderRadius: 20, background: C.pill }}>{dataset.category}</span>}
            {dataset.table_type && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: C.muted, padding: '4px 12px', borderRadius: 20, background: C.pill }}>
                <Database size={13} /> {dataset.table_type === 'single' ? 'Single Table' : 'Multiple Tables'}
              </span>
            )}
            {dataset.source && (
              dataset.source_url
                ? <a href={dataset.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.faint, fontWeight: 600, textDecoration: 'none' }}>Source: {dataset.source}</a>
                : <span style={{ fontSize: 13, color: C.faint, fontWeight: 600 }}>Source: {dataset.source}</span>
            )}
          </div>

          {dataset.description && <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.42, marginBottom: 24, marginTop: 0 }}>{dataset.description}</p>}

          {/* Scenario / Background */}
          {dataset.scenario && dataset.scenario.replace(/<[^>]*>/g, '').trim() && (
            <div style={{ marginBottom: 24, padding: '18px 22px', borderRadius: 16, background: C.input }}>
              <p style={{ fontWeight: 800, fontSize: 13, color: C.muted, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.6 }}>Scenario / Background</p>
              <div className="rich-content" style={{ fontSize: 15, color: C.text, lineHeight: 1.42 }}
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(dataset.scenario) }} />
            </div>
          )}

          {/* Sample questions */}
          {dataset.sample_questions.length > 0 && (
            <div style={{ marginBottom: 24, background: C.input, borderRadius: 16, padding: '14px 16px' }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 14, marginTop: 0 }}>Sample Questions to Explore</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dataset.sample_questions.map((q, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: C.pill, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.muted, marginTop: 1 }}>{i + 1}</span>
                    <span style={{ fontSize: 15, color: C.muted, lineHeight: 1.42 }}>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview button */}
          {datasetFiles.length > 0 && (
            <button onClick={openPreview} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 12, border: 'none', background: C.input, color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font, marginBottom: 24 }}>
              <Table2 size={14} /> Preview Dataset
            </button>
          )}

          {/* Disclaimer */}
          {dataset.disclaimer && (
            <div style={{ marginBottom: 24, padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>!</span>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.55 }}>{dataset.disclaimer}</p>
            </div>
          )}

          {/* AI tools */}
          <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 24 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 12, marginTop: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Wand2 size={16} style={{ color: C.muted, flexShrink: 0 }} /> Generate and Analyse with AI
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              <a href={`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 12, background: C.input, border: 'none', color: C.text, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: font }}>
                <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/openai-chatgpt-logo-icon-free-png.webp" alt="ChatGPT" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} /> ChatGPT
              </a>
              <a href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 12, background: C.input, border: 'none', color: C.text, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: font }}>
                <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/claude-color.png" alt="Claude" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} /> Claude
              </a>
              {colabCode && (
                <button onClick={copyPython}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 8px', borderRadius: 12, background: C.input, border: 'none', color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                  {colabCopied ? <><Check size={14} /> Copied!</> : <><img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/Python.png" alt="Python" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} /> Python</>}
                </button>
              )}
              <button onClick={copyPrompt}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, border: 'none', background: C.input, color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy Prompt'}
              </button>
            </div>

            {datasetFiles.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <a href={datasetFiles[0].url} download={datasetFiles[0].name ?? true} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 12, border: 'none', background: C.input, color: C.text, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: font }}>
                  <Download size={14} /> Download{datasetFiles.length > 1 ? ' Primary File' : ''}
                </a>
              </div>
            )}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 24, padding: '18px 20px', borderRadius: 16, background: `${C.cta}12`, textAlign: 'center' }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: C.text, margin: '0 0 4px' }}>Want to go deeper?</p>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 14px', lineHeight: 1.5 }}>Join our bootcamp to access structured courses, cohorts, and expert-guided projects.</p>
            <a href="https://festman.io" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 28px', borderRadius: 10, background: C.cta, color: C.ctaText, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Learn More</a>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          <div style={{ background: C.card, borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', fontFamily: font }}>
            <div style={{ padding: '14px 16px 0', borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: zipTables.length > 1 ? 12 : 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Table2 size={18} style={{ color: C.cta }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text }}>{dataset.title}</p>
                    <p style={{ margin: 0, fontSize: 14, color: C.faint }}>{zipTables.length > 1 ? `${zipTables.length} files available` : (zipTables.find(t => t.name === activeTable)?.type === 'pdf' ? 'PDF preview' : 'First 10 rows preview')}</p>
                  </div>
                </div>
                <button onClick={() => setShowPreview(false)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: C.input, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
                  <X size={16} />
                </button>
              </div>
              {zipTables.length > 1 && (
                <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0 }} className="hide-scrollbar">
                  {zipTables.map(t => (
                    <button key={t.name} onClick={() => switchTable(t.name)}
                      style={{ padding: '7px 14px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s', background: activeTable === t.name ? C.card : 'transparent', color: activeTable === t.name ? C.text : C.faint, borderBottom: activeTable === t.name ? `2px solid ${C.cta}` : '2px solid transparent' }}>
                      {t.name.replace(/\.(csv|pdf|xlsx|xls)$/i, '')}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '12px 16px' }}>
              {loadingPreview && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: C.faint }}><Loader2 size={28} className="animate-spin" style={{ marginRight: 10 }} /> Loading...</div>}
              {/* Direct PDF */}
              {!loadingPreview && pdfUrl && (
                <iframe src={pdfUrl} style={{ width: '100%', height: 560, border: 'none', borderRadius: 8, display: 'block' }} title="PDF Preview" />
              )}
              {/* ZIP PDF tab */}
              {!loadingPreview && !pdfUrl && (() => { const e = zipTables.find(t => t.name === activeTable); return e?.type === 'pdf' ? e.blobUrl : null; })() && (
                <iframe src={zipTables.find(t => t.name === activeTable)?.blobUrl} style={{ width: '100%', height: 560, border: 'none', borderRadius: 8, display: 'block' }} title="PDF Preview" />
              )}
              {/* CSV / XLSX table */}
              {!loadingPreview && !pdfUrl && !['pdf'].includes(zipTables.find(t => t.name === activeTable)?.type ?? '') && preview && preview.length > 0 && (
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead><tr style={{ background: C.input }}>{headers.map((h, j) => <th key={`${j}-${h}`} style={{ padding: '10px 16px', textAlign: 'left', color: C.muted, fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.cardBorder}`, fontFamily: font }}>{h || `Column ${j + 1}`}</th>)}</tr></thead>
                  <tbody>{preview.map((row, i) => <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>{row.map((cell, j) => <td key={j} style={{ padding: '9px 16px', color: C.text, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: font }}>{cell}</td>)}</tr>)}</tbody>
                </table>
              )}
              {!loadingPreview && !pdfUrl && !['pdf'].includes(zipTables.find(t => t.name === activeTable)?.type ?? '') && (!preview || preview.length === 0) && (
                <p style={{ fontSize: 14, color: C.faint, textAlign: 'center', padding: 40 }}>Preview not available for this file.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main page ---
export default function DataPlaygroundPage() {
  const C = useC();
  const { theme, toggle: toggleTheme } = useTheme();
  const { logoUrl } = useTenant();
  const isDark = theme === 'dark';
  const font = 'var(--font-sans, Inter, sans-serif)';

  const [datasets, setDatasets]       = useState<DCDataset[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<DCDataset | null>(null);
  const [search, setSearch]           = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/data-center')
      .then(r => r.json())
      .then(j => { setDatasets(j.datasets ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = Array.from(new Set(datasets.map(d => d.category).filter(Boolean))) as string[];
  const filtered = datasets.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.title.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q));
    const matchCat = !activeCategory || d.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div style={{ minHeight: '100vh', background: C.page, fontFamily: font }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: C.nav, borderBottom: `1px solid ${C.navBorder}`, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ height: 32, objectFit: 'contain' }} />
              : <span style={{ fontWeight: 900, fontSize: 18, color: C.text }}>Data Playground</span>
            }
          </Link>
          <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: C.input, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 32px' }}>
        <h1 style={{ fontWeight: 900, fontSize: 36, color: C.text, margin: '0 0 12px', lineHeight: 1.2 }}>Data Playground</h1>
        <p style={{ fontSize: 17, color: C.muted, margin: '0 0 36px', lineHeight: 1.65, maxWidth: 640 }}>
          Explore real-world datasets and sharpen your skills in data analysis, visualization, and storytelling. Each dataset comes with business questions designed to challenge how you think with data.
        </p>

        {/* Search + filters */}
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative', maxWidth: 560 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.faint, pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search datasets..."
              style={{ width: '100%', padding: '12px 14px 12px 44px', borderRadius: 12, border: 'none', background: C.card, color: C.text, fontSize: 15, fontFamily: font, outline: 'none', boxSizing: 'border-box', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            />
          </div>
          {categories.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={() => setActiveCategory(null)} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: !activeCategory ? C.cta : C.card, color: !activeCategory ? C.ctaText : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>All</button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: activeCategory === cat ? C.cta : C.card, color: activeCategory === cat ? C.ctaText : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: C.card, border: isDark ? 'none' : `1px solid ${C.cardBorder}` }}>
                <Sk h={160} r={0} />
                <div style={{ padding: 16 }}><Sk h={14} w="60%" /><div style={{ marginTop: 8 }}><Sk h={12} /></div></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Database size={40} style={{ color: C.faint, display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, fontSize: 16, color: C.text, marginBottom: 4 }}>{datasets.length === 0 ? 'No datasets available yet' : 'No datasets match your search'}</p>
            <p style={{ fontSize: 13, color: C.faint }}>Try a different search term or category.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
            {filtered.map(d => (
              <div key={d.id} style={{ background: C.card, border: isDark ? 'none' : `1px solid ${C.cardBorder}`, borderRadius: 18, overflow: 'hidden', fontFamily: font, minHeight: 420, display: 'flex', flexDirection: 'column' }}>
                {/* Cover */}
                {d.cover_image_url ? (
                  <div style={{ padding: '14px 14px 0', overflow: 'hidden' }}>
                    <img src={d.cover_image_url} alt={d.cover_image_alt ?? ''} style={{ width: '100%', aspectRatio: '16/7', objectFit: 'cover', display: 'block', borderRadius: 12 }} />
                  </div>
                ) : (
                  <div style={{ padding: '14px 14px 0' }}>
                    <div style={{ width: '100%', aspectRatio: '16/7', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                      <Database size={36} style={{ color: C.green }} />
                    </div>
                  </div>
                )}

                {/* Body */}
                <div style={{ padding: '16px 18px 0', flex: 1 }}>
                  {d.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                      {d.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: 13, padding: '3px 9px', borderRadius: 20, background: C.pill, color: C.muted, fontWeight: 700 }}>{t}</span>)}
                    </div>
                  )}
                  <p style={{ fontWeight: 700, fontSize: 18, color: C.text, margin: '0 0 5px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.22 }}>{d.title}</p>
                  {d.description && <p style={{ fontSize: 14, color: C.faint, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: 1.32 }}>{d.description}</p>}
                  {d.table_type && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '4px 10px', borderRadius: 20, background: C.pill }}>
                      <Database size={12} style={{ color: C.muted }} />
                      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{d.table_type === 'single' ? 'Single Table' : 'Multiple Tables'}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 18px 18px', display: 'flex', gap: 8, borderTop: `1px solid ${C.divider}`, marginTop: 14 }}>
                  <button onClick={() => setSelected(d)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: C.cta, color: C.ctaText, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    View Details
                  </button>
                  {getDatasetFiles(d).length > 0 && (
                    <a href={getDatasetFiles(d)[0].url} download={getDatasetFiles(d)[0].name ?? true} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, background: C.input, color: C.text, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
                      <Download size={14} /> Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail pane */}
      <AnimatePresence>
        {selected && <DatasetDetailPane dataset={selected} C={C} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
