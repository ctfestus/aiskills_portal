'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Search, X, Database, Download, Table2,
  Copy, Check, Loader2, Play, RefreshCw, ChevronDown, ChevronRight,
  ArrowLeft, ArrowLeftToLine, ArrowRightFromLine, Clock, Star,
} from 'lucide-react';
import { acceptCompletion, autocompletion, CompletionContext, completionStatus, type Completion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { keywordCompletionSource, schemaCompletionSource, sql, StandardSQL, type SQLNamespace } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { tags as highlightTags } from '@lezer/highlight';
import { sanitizeRichText } from '@/lib/sanitize';
import { safeEmbedUrl } from '@/lib/safe-embed-url';
import {
  executeQuery,
  initSQLRuntimeFromRows,
  STUDENT_RESULT_LIMIT,
  type SQLResult,
  type SQLRuntime,
} from '@/lib/sql-engine';

export type DatasetFile = { name: string; url: string };
export type AnalystTaskType = 'sql' | 'analytics';
export type AnalystTask = {
  id?: string;
  prompt: string;
  description?: string;
  type?: AnalystTaskType;
};
export type AnalystSection = {
  id?: string;
  title: string;
  brief?: string;
  videoUrl?: string;
  difficulty?: string;
  duration?: string;
  tasks: AnalystTask[];
};
export type PreviewEntry = {
  name: string;
  type: 'csv' | 'pdf' | 'xlsx';
  content: string;
  blobUrl?: string;
  xlsxBuf?: ArrayBuffer;
  sheetName?: string;
};

export interface DCDataset {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  tags: string[];
  category: string | null;
  sample_questions: string[];
  sample_question_types?: ('sql' | 'analytics')[] | null;
  analyst_sections?: AnalystSection[] | null;
  file_url: string | null;
  file_name: string | null;
  files?: DatasetFile[] | null;
  row_count: number | null;
  source: string | null;
  source_url: string | null;
  scenario: string | null;
  disclaimer: string | null;
  table_type: 'single' | 'multiple' | null;
  sql_workbench_enabled?: boolean | null;
}

export type DataPlaygroundColors = {
  card: string;
  cardBorder: string;
  green: string;
  lime: string;
  cta: string;
  ctaText: string;
  text: string;
  muted: string;
  faint: string;
  divider: string;
  pill: string;
  input: string;
  skeleton: string;
};

type HeaderLoader = HeadersInit | (() => HeadersInit | Promise<HeadersInit | null | undefined> | null | undefined);
type SQLRuntimeTable = SQLRuntime['tables'][number];

type DataPlaygroundGridProps = {
  C: DataPlaygroundColors;
  isDark: boolean;
  fetchHeaders?: HeaderLoader;
  intro?: ReactNode;
  loadingCardCount?: number;
  searchMaxWidth?: string | number;
  searchInputShadow?: boolean;
  showDetailCta?: boolean;
  emptyNoDatasetsMessage?: string;
  emptyNoMatchMessage?: string;
};

const font = 'var(--font-sans, Inter, sans-serif)';
const MAX_WORKBENCH_BYTES = 15 * 1024 * 1024;
const MAX_WORKBENCH_TABLES = 12;
const MAX_WORKBENCH_ROWS_PER_TABLE = 75_000;

function tagsFor(d: DCDataset) {
  return Array.isArray(d.tags) ? d.tags : [];
}

function questionsFor(d: DCDataset) {
  return Array.isArray(d.sample_questions) ? d.sample_questions : [];
}

function questionTypesFor(d: DCDataset) {
  const questions = questionsFor(d);
  return questions.map((_, i) => d.sample_question_types?.[i] === 'sql' ? 'sql' : 'analytics');
}

function typedQuestionsFor(d: DCDataset) {
  const types = questionTypesFor(d);
  return questionsFor(d).map((text, i) => ({ text, type: types[i] }));
}

function cleanTaskType(type: unknown): AnalystTaskType {
  return type === 'sql' ? 'sql' : 'analytics';
}

function sectionKey(section: Pick<AnalystSection, 'id' | 'title'>, index: number) {
  return section.id || `${index}-${section.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `section-${index + 1}`;
}

function analystSectionsFor(d: DCDataset): AnalystSection[] {
  const sections = Array.isArray(d.analyst_sections) ? d.analyst_sections : [];
  const normalized = sections
    .map((section, index) => {
      const tasks = (Array.isArray(section.tasks) ? section.tasks : [])
        .map((task, taskIndex) => ({
          id: task.id || `task-${index + 1}-${taskIndex + 1}`,
          prompt: String(task.prompt ?? '').trim(),
          description: String(task.description ?? '').trim(),
          type: cleanTaskType(task.type),
        }))
        .filter(task => task.prompt);
      const rawTitle = String(section.title ?? '').trim();
      const brief = String(section.brief ?? '').trim();
      const videoUrl = String(section.videoUrl ?? '').trim();
      const difficulty = String(section.difficulty ?? '').trim();
      const duration = String(section.duration ?? '').trim();
      // Keep a phase if it has tasks OR is a briefing-only phase (real title, brief, or embed).
      const hasContent = tasks.length > 0 || !!rawTitle || !!brief.replace(/<[^>]*>/g, '').trim() || !!videoUrl;
      return {
        section: { id: sectionKey(section, index), title: rawTitle || `Analysis Phase ${index + 1}`, brief, videoUrl, difficulty, duration, tasks },
        hasContent,
      };
    })
    .filter(entry => entry.hasContent)
    .map(entry => entry.section);

  if (normalized.length > 0) return normalized;

  const legacy = typedQuestionsFor(d);
  const sqlTasks = legacy.filter(q => q.type === 'sql' && q.text.trim());
  const analyticsTasks = legacy.filter(q => q.type === 'analytics' && q.text.trim());
  return [
    sqlTasks.length ? {
      id: 'legacy-sql-practice',
      title: 'SQL Practice',
      brief: 'Answer these directly in the SQL Workbench.',
      tasks: sqlTasks.map((q, i) => ({ id: `legacy-sql-${i + 1}`, prompt: q.text, type: 'sql' as const })),
    } : null,
    analyticsTasks.length ? {
      id: 'legacy-analytics',
      title: 'Analytics Questions',
      brief: 'Use the dataset to reason through these broader business questions.',
      tasks: analyticsTasks.map((q, i) => ({ id: `legacy-analytics-${i + 1}`, prompt: q.text, type: 'analytics' as const })),
    } : null,
  ].filter(Boolean) as AnalystSection[];
}

function analystSectionsByTaskType(d: DCDataset, type: AnalystTaskType): AnalystSection[] {
  return analystSectionsFor(d)
    .map(section => ({ ...section, tasks: section.tasks.filter(task => cleanTaskType(task.type) === type) }))
    .filter(section => section.tasks.length > 0);
}

function questionsByType(d: DCDataset, type: 'sql' | 'analytics') {
  return analystSectionsByTaskType(d, type).flatMap(section => section.tasks.map(task => task.prompt));
}

function deriveDifficulty(taskCount: number): 'Beginner' | 'Intermediate' | 'Advanced' {
  if (taskCount <= 2) return 'Beginner';
  if (taskCount <= 4) return 'Intermediate';
  return 'Advanced';
}

function deriveTimeEstimate(taskCount: number): string {
  if (taskCount <= 2) return '15-30 mins';
  if (taskCount <= 4) return '30-60 mins';
  return '45-90 mins';
}

const DIFF_LEVEL: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3 };

function DifficultyDots({ level, color, faint }: { level: number; color: string; faint: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= level ? color : faint }} />
      ))}
    </span>
  );
}

function Sk({ C, w = '100%', h = 16, r = 8 }: { C: DataPlaygroundColors; w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: C.skeleton, flexShrink: 0 }} className="animate-pulse" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function quoteIdent(name: string) {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const s = String(value);
    return s === '[object Object]' ? JSON.stringify(value) : s;
  }
  return String(value);
}

function exportToCsv(result: SQLResult, filename: string) {
  const escape = (v: unknown) => {
    const s = formatCell(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = result.columns.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
  const body = result.rows.map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildSQLSchema(tables: SQLRuntimeTable[]): SQLNamespace {
  return Object.fromEntries(
    tables.map(table => [
      table.tableName,
      table.columns.map(column => ({
        label: column.name,
        type: 'property',
        detail: column.type,
      })),
    ])
  ) as SQLNamespace;
}

function applyIdentifierCompletion(view: EditorView, completion: Completion, from: number, to: number) {
  view.dispatch({
    changes: { from, to, insert: quoteIdent(completion.label) },
    selection: { anchor: from + quoteIdent(completion.label).length },
  });
}

function buildDatasetCompletionSource(tables: SQLRuntimeTable[]) {
  const tableOptions: Completion[] = tables.map(table => ({
    label: table.tableName,
    type: 'class',
    detail: `${table.rowCount.toLocaleString()} rows`,
    apply: applyIdentifierCompletion,
  }));
  const columnOptions: Completion[] = tables.flatMap(table =>
    table.columns.map(column => ({
      label: column.name,
      type: 'property',
      detail: `${table.tableName}.${column.type}`,
      apply: applyIdentifierCompletion,
    }))
  );

  return (context: CompletionContext) => {
    const word = context.matchBefore(/[\w$"]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return {
      from: word.from,
      options: [...tableOptions, ...columnOptions],
      validFor: /^[\w$"]*$/,
    };
  };
}

const lightSQLEditorTheme = EditorView.theme({
  '&': {
    color: '#111827',
    height: '100%',
    fontSize: '13.5px',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace',
    lineHeight: '1.6',
    padding: '2px 0',
    minHeight: '100%',
  },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace',
    overflow: 'auto',
  },
  '.cm-line': {
    padding: '0 2px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: '#94a3b8',
    borderRight: 'none',
  },
  '.cm-activeLineGutter, .cm-activeLine': {
    backgroundColor: 'rgba(8,145,178,0.08)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(8,145,178,0.24)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-tooltip': {
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    overflow: 'hidden',
  },
});

const lightSQLHighlightStyle = HighlightStyle.define([
  { tag: highlightTags.keyword, color: '#0e09dd', fontWeight: '700' },
  { tag: highlightTags.operatorKeyword, color: '#0e09dd', fontWeight: '700' },
  { tag: highlightTags.definitionKeyword, color: '#7c3aed', fontWeight: '700' },
  { tag: highlightTags.atom, color: '#0f766e' },
  { tag: highlightTags.bool, color: '#b45309' },
  { tag: highlightTags.number, color: '#b45309' },
  { tag: highlightTags.string, color: '#047857' },
  { tag: highlightTags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: highlightTags.variableName, color: '#334155' },
  { tag: highlightTags.propertyName, color: '#0369a1' },
  { tag: highlightTags.name, color: '#334155' },
  { tag: highlightTags.operator, color: '#475569' },
  { tag: highlightTags.punctuation, color: '#64748b' },
  { tag: highlightTags.paren, color: '#64748b' },
  { tag: highlightTags.squareBracket, color: '#64748b' },
]);

const darkSQLEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13.5px',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace',
    lineHeight: '1.6',
    padding: '2px 0',
    minHeight: '100%',
  },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono","Fira Code",ui-monospace,monospace',
    overflow: 'auto',
  },
  '.cm-line': {
    padding: '0 2px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: 'none',
  },
  '.cm-activeLineGutter, .cm-activeLine': {
    backgroundColor: 'rgba(62,147,255,0.08)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
});

function SQLCodeEditor({
  value,
  tables,
  C,
  isDark,
  onChange,
  onRun,
}: {
  value: string;
  tables: SQLRuntimeTable[];
  C: DataPlaygroundColors;
  isDark: boolean;
  onChange: (value: string) => void;
  onRun: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const latestValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);

  useEffect(() => { latestValueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onRunRef.current = onRun; }, [onRun]);

  const schema = useMemo(() => buildSQLSchema(tables), [tables]);
  const datasetCompletionSource = useMemo(() => buildDatasetCompletionSource(tables), [tables]);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    const extensions = [
      lineNumbers(),
      history(),
      sql({ dialect: StandardSQL, schema, upperCaseKeywords: true }),
      autocompletion({
        override: [
          keywordCompletionSource(StandardSQL, true),
          schemaCompletionSource({ dialect: StandardSQL, schema }),
          datasetCompletionSource,
        ],
        activateOnTyping: true,
        maxRenderedOptions: 80,
      }),
      keymap.of([
        { key: 'Ctrl-Enter', run: () => { onRunRef.current(); return true; } },
        { key: 'Mod-Enter', run: () => { onRunRef.current(); return true; } },
        { key: 'Tab', run: view => completionStatus(view.state) === 'active' ? acceptCompletion(view) : false },
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.lineWrapping,
      EditorView.updateListener.of(update => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      }),
      EditorView.theme({
        '&': {
          backgroundColor: 'transparent',
        },
        '.cm-editor': {
          backgroundColor: 'transparent',
        },
        '.cm-scroller': {
          backgroundColor: 'transparent',
        },
        '.cm-tooltip': {
          backgroundColor: C.card,
          color: C.text,
          border: 'none',
          boxShadow: '0 18px 48px rgba(0,0,0,0.18)',
          fontFamily: font,
        },
        '.cm-tooltip-autocomplete ul li[aria-selected]': {
          backgroundColor: C.cta,
          color: C.ctaText,
        },
        '.cm-completionDetail': {
          color: C.faint,
        },
      }),
      isDark ? [oneDark, darkSQLEditorTheme] : [lightSQLEditorTheme, syntaxHighlighting(lightSQLHighlightStyle)],
    ];
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({ doc: latestValueRef.current, extensions }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [C.card, C.cardBorder, C.cta, C.ctaText, C.faint, C.text, datasetCompletionSource, isDark, schema]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return <div ref={hostRef} style={{ flex: 1, minHeight: 0, width: '100%', padding: '10px 0' }} />;
}

function stripKnownExtension(name: string) {
  return name.replace(/\.(csv|tsv|txt|xlsx|xls|zip)$/i, '');
}

function normalizeSQLTableKey(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'table_data';
}

function humanizeTableLabel(name: string) {
  return stripKnownExtension(name)
    .replace(/^.*[\\/]/, '')
    .replace(/[:]+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function compactTableLabel(tableName: string) {
  return humanizeTableLabel(tableName).slice(0, 48) || tableName;
}

function tableNameFromEntry(name: string, index: number, usedNames: Set<string>) {
  const sourceName = name.includes(':') ? name.split(':').pop() ?? name : name;
  const base = humanizeTableLabel(sourceName) || `Table ${index + 1}`;
  const shortBase = base.length > 36 ? base.slice(0, 36).trim() : base;
  let candidate = shortBase || `Table ${index + 1}`;
  let suffix = 2;
  while (usedNames.has(normalizeSQLTableKey(candidate).toLowerCase())) {
    candidate = `${shortBase || 'Table'} ${suffix}`;
    suffix += 1;
  }
  usedNames.add(normalizeSQLTableKey(candidate).toLowerCase());
  return candidate;
}

function fileHasExtension(file: DatasetFile, extensions: string[]) {
  const urlPath = file.url.split(/[?#]/)[0] ?? file.url;
  return [file.name, urlPath].some(candidate => {
    const lower = candidate.toLowerCase();
    return extensions.some(ext => lower.endsWith(ext));
  });
}

function isWorkbenchSupportedFile(file: DatasetFile) {
  return fileHasExtension(file, ['.csv', '.tsv', '.txt', '.xlsx', '.xls', '.zip']);
}

export function getDatasetFiles(d: DCDataset): DatasetFile[] {
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

export function buildAIPrompt(d: DCDataset): string {
  const files = getDatasetFiles(d);
  const primaryUrl = files[0]?.url ?? d.file_url;
  const sections = analystSectionsFor(d);
  const taskBrief = sections.length > 0
    ? sections.map(section => {
        const tasks = section.tasks.map(task => `- [${task.type === 'sql' ? 'SQL' : 'Analytics'}] ${task.prompt}`).join('\n');
        return `${section.title}${section.brief ? `\nBrief: ${section.brief}` : ''}\n${tasks}`;
      }).join('\n\n')
    : '(no analyst tasks provided)';
  const isBox = /box\.com/i.test(primaryUrl ?? '');
  const isGitHub = /raw\.githubusercontent\.com|github\.com/i.test(primaryUrl ?? '');
  const fileLines = files.length > 1
    ? `Dataset files:\n${files.map(file => `- ${file.name}: ${file.url}`).join('\n')}`
    : `Dataset file URL: ${primaryUrl ?? 'not provided'}`;
  const urlNote = isBox
    ? `${fileLines}

Note: This is a Box shared link which cannot be fetched directly (Box direct links require a paid plan). Please ask the user to provide the file via Google Drive (share publicly, use /uc?export=download&id=FILE_ID) or Dropbox (change ?dl=0 to ?dl=1), or paste the file contents directly into this chat.`
    : isGitHub
      ? `${fileLines}

This is a GitHub raw file URL. Please fetch it directly and analyse the contents. The file may be a CSV, Excel spreadsheet, or a ZIP archive containing multiple CSV tables.`
      : `${fileLines}

Please fetch the file from the URL above and use it directly. The file may be a CSV, Excel spreadsheet, or a ZIP archive containing multiple CSV tables. Analyse the actual data to understand the schema and content.`;

  return `I have a dataset called "${d.title}".

${d.description ? 'Description: ' + d.description + '\n' : ''}
${urlNote}

Analyst task brief:
${taskBrief}

Based on the actual data, please generate:
1) A SQL CREATE TABLE statement that matches the real columns and data types, with 10 representative INSERT rows.
2) A Python pandas script to load, clean, and explore this dataset.
3) Suggested SQL queries and pandas code to answer the analyst tasks above.`;
}

export function buildColabCode(datasetFiles: DatasetFile[]) {
  const url = datasetFiles[0]?.url;
  if (!url) return null;
  const safeUrl = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const lower = url.toLowerCase();
  if (lower.endsWith('.zip')) {
    return `import pandas as pd
import zipfile
import requests
import io

url = "${safeUrl}"
response = requests.get(url)

dataframes = {}
with zipfile.ZipFile(io.BytesIO(response.content)) as z:
    csv_files = [f for f in z.namelist() if f.lower().endswith('.csv')]
    for csv_file in csv_files:
        with z.open(csv_file) as f:
            name = csv_file.split('/')[-1].replace('.csv', '').replace(' ', '_')
            dataframes[name] = pd.read_csv(f)

# Make each table available as a direct variable
for name, df in dataframes.items():
    globals()[name] = df

# Display each table
for name, df in dataframes.items():
    print(f"\\n{'='*60}")
    print(f"Table: {name}  |  {len(df):,} rows  x  {len(df.columns)} columns")
    print('='*60)
    display(df.head(10))

print("\\nAvailable tables:", list(dataframes.keys()))
print("Access any table directly, e.g.:")
for name in list(dataframes.keys())[:3]:
    print(f"  {name}.head()")`;
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return `import pandas as pd

url = "${safeUrl}"
sheets = pd.read_excel(url, sheet_name=None)

# Make each sheet available as a direct variable
for name, df in sheets.items():
    globals()[name.replace(' ', '_')] = df

# Display each sheet
for name, df in sheets.items():
    print(f"\\n{'='*60}")
    print(f"Sheet: {name}  |  {len(df):,} rows  x  {len(df.columns)} columns")
    print('='*60)
    display(df.head(10))

print("\\nAvailable sheets:", list(sheets.keys()))
print("Access any sheet directly, e.g.:")
for name in list(sheets.keys())[:3]:
    print(f"  {name.replace(' ', '_')}.head()")`;
  }
  return `import pandas as pd

url = "${safeUrl}"
df = pd.read_csv(url)

print(f"{len(df):,} rows  x  {len(df.columns)} columns")
display(df.head(10))`;
}

function DatasetDetailPane({
  dataset,
  C,
  isDark,
  showCta = false,
  onClose,
}: {
  dataset: DCDataset;
  C: DataPlaygroundColors;
  isDark: boolean;
  showCta?: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [zipTables, setZipTables] = useState<PreviewEntry[]>([]);
  const [activeTable, setActiveTable] = useState('');
  const [showWorkbench, setShowWorkbench] = useState(false);
  const [workbenchLoading, setWorkbenchLoading] = useState(false);
  const [workbenchError, setWorkbenchError] = useState('');
  const [workbenchNotice, setWorkbenchNotice] = useState('');
  const [runtime, setRuntime] = useState<SQLRuntime | null>(null);
  const runtimeRef = useRef<SQLRuntime | null>(null);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<SQLResult | null>(null);
  const [queryRunning, setQueryRunning] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [activeOutputTab, setActiveOutputTab] = useState('results');
  const [queryPanePercent, setQueryPanePercent] = useState(40);
  const [workbenchSideWidth, setWorkbenchSideWidth] = useState(230);
  const [tablePreviewResult, setTablePreviewResult] = useState<SQLResult | null>(null);
  const [tablePreviewLoading, setTablePreviewLoading] = useState(false);
  const [tablePreviewError, setTablePreviewError] = useState('');
  const [questionsCollapsed, setQuestionsCollapsed] = useState(false);
  const [guidelinesCollapsed, setGuidelinesCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
  const workbenchMainRef = useRef<HTMLDivElement>(null);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => () => {
    blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    runtimeRef.current?.close().catch(() => {});
  }, []);

  const accent = '#00b95c';
  const datasetFiles = getDatasetFiles(dataset);
  const prompt = buildAIPrompt(dataset);
  const activePreview = zipTables.find(t => t.name === activeTable);
  const activePdfUrl = activePreview?.type === 'pdf' ? activePreview.blobUrl : null;
  const sqlWorkbenchEnabled = dataset.sql_workbench_enabled !== false;
  const canOpenSQLWorkbench = sqlWorkbenchEnabled && datasetFiles.some(isWorkbenchSupportedFile);
  const analystSections = analystSectionsFor(dataset);
  const sqlTaskSections = analystSectionsByTaskType(dataset, 'sql');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const activeSectionId = analystSections.some(section => section.id === selectedSectionId)
    ? selectedSectionId
    : analystSections[0]?.id || '';
  const activeSection = analystSections.find(section => section.id === activeSectionId) ?? analystSections[0] ?? null;
  const totalTasks = analystSections.reduce((sum, section) => sum + section.tasks.length, 0);
  const totalSqlTasks = analystSections.reduce((sum, section) => sum + section.tasks.filter(task => task.type === 'sql').length, 0);

  async function openPreview() {
    setShowPreview(true);
    if (preview !== null || zipTables.length > 0) return;
    setLoadingPreview(true);
    try {
      const entries = (await Promise.all(datasetFiles.map(file => loadPreviewEntries(file, datasetFiles.length > 1)))).flat();
      setZipTables(entries);
      const firstPreviewable = entries.find(e => e.type === 'csv' || e.type === 'xlsx') ?? entries[0];
      setActiveTable(firstPreviewable?.name ?? '');
      if (firstPreviewable?.type === 'csv') parseCSVContent(firstPreviewable.content);
      if (firstPreviewable?.type === 'xlsx' && firstPreviewable.xlsxBuf) parseXLSXBuffer(firstPreviewable.xlsxBuf, firstPreviewable.sheetName);
      if (!firstPreviewable) setPreview([]);
    } catch {
      setPreview([]);
    }
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
      const fields = (result.meta as any).fields ?? [];
      setHeaders(fields);
      setPreview(result.data.map((row: any) => fields.map((f: string) => String(row[f] ?? ''))));
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

  async function fetchWorkbenchBuffer(file: DatasetFile, remainingBytes: number) {
    const proxyUrl = `/api/data-center/proxy?url=${encodeURIComponent(file.url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Could not load ${file.name}${err.error ? `: ${err.error}` : ''}`);
    }
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length && length > remainingBytes) {
      throw new Error(`This dataset is too large for the browser SQL Workbench (${formatBytes(MAX_WORKBENCH_BYTES)} limit).`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > remainingBytes) {
      throw new Error(`This dataset is too large for the browser SQL Workbench (${formatBytes(MAX_WORKBENCH_BYTES)} limit).`);
    }
    return buf;
  }

  async function loadWorkbenchEntries() {
    const entries: PreviewEntry[] = [];
    let totalBytes = 0;

    for (const file of datasetFiles) {
      const isZip = fileHasExtension(file, ['.zip']);
      const isWorkbook = fileHasExtension(file, ['.xlsx', '.xls']);
      if (fileHasExtension(file, ['.pdf'])) continue;
      if (!isWorkbenchSupportedFile(file)) continue;

      const buf = await fetchWorkbenchBuffer(file, MAX_WORKBENCH_BYTES - totalBytes);
      totalBytes += buf.byteLength;

      if (isZip) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buf);
        const names = Object.keys(zip.files)
          .filter(n => !zip.files[n].dir && (n.toLowerCase().endsWith('.csv') || n.toLowerCase().endsWith('.tsv') || n.toLowerCase().endsWith('.xlsx') || n.toLowerCase().endsWith('.xls')))
          .slice(0, MAX_WORKBENCH_TABLES);

        for (const name of names) {
          const base = name.replace(/^.*\//, '');
          if (name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls')) {
            const bytes = await zip.files[name].async('arraybuffer');
            totalBytes += bytes.byteLength;
            if (totalBytes > MAX_WORKBENCH_BYTES) {
              throw new Error(`This ZIP expands beyond the browser SQL Workbench limit (${formatBytes(MAX_WORKBENCH_BYTES)}).`);
            }
            entries.push(...await expandXLSXEntries(bytes, `${file.name}: ${base}`, true));
          } else {
            const content = await zip.files[name].async('string');
            totalBytes += new TextEncoder().encode(content).byteLength;
            if (totalBytes > MAX_WORKBENCH_BYTES) {
              throw new Error(`This ZIP expands beyond the browser SQL Workbench limit (${formatBytes(MAX_WORKBENCH_BYTES)}).`);
            }
            entries.push({ name: `${file.name}: ${base}`, type: 'csv', content });
          }
        }
        continue;
      }

      if (isWorkbook) {
        entries.push(...await expandXLSXEntries(buf, file.name, datasetFiles.length > 1));
      } else {
        entries.push({ name: file.name, type: 'csv', content: new TextDecoder().decode(buf) });
      }
    }

    return entries.slice(0, MAX_WORKBENCH_TABLES);
  }

  async function rowsFromEntry(entry: PreviewEntry): Promise<unknown[][]> {
    if (entry.type === 'csv') {
      const Papa = (await import('papaparse')).default;
      const parsed = Papa.parse<string[]>(entry.content, {
        delimiter: entry.name.toLowerCase().endsWith('.tsv') ? '\t' : '',
        skipEmptyLines: true,
      });
      if (parsed.errors.length) throw new Error(parsed.errors[0]?.message || `Could not parse ${entry.name}.`);
      return parsed.data;
    }

    if (entry.type === 'xlsx' && entry.xlsxBuf) {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(entry.xlsxBuf, { type: 'array' });
      const ws = wb.Sheets[entry.sheetName || wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    }

    return [];
  }

  async function openWorkbench() {
    if (!canOpenSQLWorkbench) return;
    setShowWorkbench(true);
    if (runtimeRef.current) return;
    setWorkbenchLoading(true);
    setWorkbenchError('');
    setWorkbenchNotice('');
    setQueryResult(null);
    setQueryError('');
    try {
      const entries = await loadWorkbenchEntries();
      const tables = [];
      let truncated = false;
      const usedTableNames = new Set<string>();

      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i];
        if (entry.type === 'pdf') continue;
        let rows = await rowsFromEntry(entry);
        rows = rows.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
        if (!rows.length) continue;
        if (rows.length > MAX_WORKBENCH_ROWS_PER_TABLE + 1) {
          rows = rows.slice(0, MAX_WORKBENCH_ROWS_PER_TABLE + 1);
          truncated = true;
        }
        tables.push({ tableName: tableNameFromEntry(entry.name, i, usedTableNames), rows });
      }

      if (!tables.length) {
        throw new Error('SQL Workbench supports CSV/XLSX tables. This dataset does not include a supported table file.');
      }

      const nextRuntime = await initSQLRuntimeFromRows(tables);
      runtimeRef.current = nextRuntime;
      setRuntime(nextRuntime);
      const firstTable = nextRuntime.tables[0]?.tableName ?? '';
      const starter = firstTable ? `SELECT * FROM ${quoteIdent(firstTable)} LIMIT 25;` : 'SELECT * FROM ';
      setQuery(starter);
      if (truncated) {
        setWorkbenchNotice(`Loaded the first ${MAX_WORKBENCH_ROWS_PER_TABLE.toLocaleString()} rows per table to protect browser performance.`);
      }
      if (firstTable) {
        const firstResult = await executeQuery(nextRuntime.conn, starter);
        setQueryResult(firstResult);
      }
    } catch (err) {
      setWorkbenchError((err as Error).message || 'Could not prepare the SQL Workbench.');
    } finally {
      setWorkbenchLoading(false);
    }
  }

  async function runWorkbenchQuery(sqlText = query) {
    if (!runtimeRef.current) return;
    setQueryRunning(true);
    setQueryError('');
    setActiveOutputTab('results');
    try {
      const out = await executeQuery(runtimeRef.current.conn, sqlText);
      setQueryResult(out);
    } catch (err) {
      setQueryResult(null);
      setQueryError((err as Error).message || 'Query failed.');
    } finally {
      setQueryRunning(false);
    }
  }

  async function openTableTab(tableName: string) {
    if (!runtimeRef.current) return;
    setActiveOutputTab(tableName);
    setTablePreviewLoading(true);
    setTablePreviewError('');
    setTablePreviewResult(null);
    try {
      const sqlText = `SELECT * FROM ${quoteIdent(tableName)} LIMIT 25;`;
      const out = await executeQuery(runtimeRef.current.conn, sqlText);
      setTablePreviewResult(out);
    } catch (err) {
      setTablePreviewError((err as Error).message || 'Could not preview table.');
    } finally {
      setTablePreviewLoading(false);
    }
  }

  function startWorkbenchResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const el = workbenchMainRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const onMove = (moveEvent: PointerEvent) => {
      const next = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setQueryPanePercent(Math.max(24, Math.min(72, next)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  function startWorkbenchSideResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = workbenchSideWidth;
    const onMove = (moveEvent: PointerEvent) => {
      setWorkbenchSideWidth(Math.max(170, Math.min(460, startW + (moveEvent.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  function copyPrompt() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: isDark ? '#141414' : '#F2F5FA', fontFamily: font, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Top nav bar */}
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 14px', height: 56, background: C.card, borderBottom: `1px solid ${C.divider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <button onClick={onClose} title="Back to datasets"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 13px 0 10px', borderRadius: 10, border: 'none', background: C.input, color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font, flexShrink: 0 }}>
            <ArrowLeft size={16} /> Datasets
          </button>
          <span className="hidden sm:block" style={{ width: 1, height: 24, background: C.divider, flexShrink: 0 }} />
          <div className="hidden sm:block" style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dataset.title}</p>
            {dataset.category && <p style={{ margin: 0, fontSize: 11.5, color: C.faint, fontWeight: 600 }}>{dataset.category}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {canOpenSQLWorkbench && (
            <button onClick={openWorkbench}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 15px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
              <Database size={14} /> SQL Workbench
            </button>
          )}
        </div>
      </header>

      {/* Body row */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} className="lg:hidden"
            style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.5)' }} />
        )}

        {/* Expand tab: shown only when the sidebar is collapsed */}
        {!sidebarOpen && analystSections.length > 0 && (
          <button onClick={() => setSidebarOpen(true)} title="Show analysis path"
            style={{ position: 'absolute', top: 14, left: 0, zIndex: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 36, borderRadius: '0 8px 8px 0', border: 'none', borderLeft: 'none', background: C.card, color: C.muted, cursor: 'pointer' }}>
            <ArrowRightFromLine size={16} />
          </button>
        )}

        {/* Sidebar: analysis path */}
        <aside
          className={`absolute inset-y-0 left-0 z-40 lg:relative lg:z-auto transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'}`}
          style={{ width: 296, maxWidth: '86vw', flexShrink: 0, background: C.card, borderRight: `1px solid ${C.divider}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* Sidebar header: title + collapse (VE style, no cover image) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '14px 14px 12px', borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {dataset.category && <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: accent }}>{dataset.category}</p>}
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{dataset.title}</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} title="Hide analysis path"
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: C.faint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ArrowLeftToLine size={16} />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Dataset download + description */}
            {datasetFiles.length > 0 && (
              <div>
                <a href={datasetFiles[0].url} download={datasetFiles[0].name ?? true} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', borderRadius: 10, background: `${accent}14`, color: accent, fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: font }}>
                  <Download size={15} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{datasetFiles[0].name || 'Download dataset'}{datasetFiles.length > 1 ? ` +${datasetFiles.length - 1}` : ''}</span>
                </a>
                {dataset.description && <p style={{ margin: '10px 2px 0', fontSize: 12, color: C.faint, lineHeight: 1.5 }}>{dataset.description}</p>}
              </div>
            )}

            {/* Timeline */}
            <nav>
              <p style={{ margin: '0 0 12px', color: C.faint, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Analysis Path</p>
              {analystSections.length > 0 ? analystSections.map((section, index) => {
                const isActive = section.id === activeSectionId;
                const sqlCount = section.tasks.filter(task => task.type === 'sql').length;
                const isFirst = index === 0;
                const diff = section.difficulty || deriveDifficulty(section.tasks.length);
                const estTime = section.duration || deriveTimeEstimate(section.tasks.length);
                return (
                  <button key={section.id || section.title}
                    onClick={() => { setSelectedSectionId(section.id || ''); if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false); }}
                    style={{ width: '100%', display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', gap: 10, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, fontFamily: font }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ width: 30, height: 30, borderRadius: '50%', background: isFirst || isActive ? accent : C.input, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                        {isFirst
                          ? <Star size={14} fill="currentColor" style={{ color: '#fff' }} />
                          : <span style={{ color: isActive ? '#fff' : C.faint }}>{index + 1}</span>}
                      </span>
                      {index < analystSections.length - 1 && <span style={{ flex: 1, minHeight: 30, width: 0, borderLeft: `2px dashed ${C.cardBorder}`, margin: '4px 0' }} />}
                    </span>
                    <span style={{ minWidth: 0, paddingTop: 5, paddingBottom: index < analystSections.length - 1 ? 18 : 0 }}>
                      <span style={{ display: 'block', color: isActive ? accent : C.text, fontSize: 13, fontWeight: isActive ? 700 : 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{section.title}</span>
                      {(section.tasks.length > 0 || section.difficulty || section.duration) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                          <DifficultyDots level={DIFF_LEVEL[diff] ?? 1} color={isActive ? accent : C.muted} faint={C.cardBorder} />
                          <span style={{ fontSize: 11, color: C.faint, fontWeight: 600 }}>{diff}</span>
                          <span style={{ fontSize: 11, color: C.faint }}>&middot;</span>
                          <Clock size={11} style={{ color: C.faint }} />
                          <span style={{ fontSize: 11, color: C.faint }}>{estTime}</span>
                          {sqlCount > 0 && <span style={{ borderRadius: 999, padding: '2px 7px', background: 'rgba(8,145,178,0.12)', color: '#0891b2', fontSize: 10, fontWeight: 700 }}>{sqlCount} SQL</span>}
                        </span>
                      )}
                    </span>
                  </button>
                );
              }) : (
                <p style={{ margin: 0, color: C.faint, fontSize: 13, lineHeight: 1.45 }}>No analyst task brief has been added yet.</p>
              )}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ maxWidth: 940, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Active phase (primary content, like a VE lesson) */}
            {activeSection ? (
              <section style={{ background: C.card, border: 'none', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '22px 24px 18px', borderBottom: activeSection.tasks.length > 0 ? `1px solid ${C.divider}` : 'none' }}>
                  <p style={{ margin: '0 0 7px', color: accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Phase {analystSections.findIndex(section => section.id === activeSection.id) + 1} of {analystSections.length}</p>
                  <h3 style={{ margin: 0, color: C.text, fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>{activeSection.title}</h3>
                  {(activeSection.tasks.length > 0 || activeSection.difficulty || activeSection.duration) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 11 }}>
                      <DifficultyDots level={DIFF_LEVEL[activeSection.difficulty || deriveDifficulty(activeSection.tasks.length)] ?? 1} color={accent} faint={C.cardBorder} />
                      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{activeSection.difficulty || deriveDifficulty(activeSection.tasks.length)}</span>
                      <span style={{ fontSize: 12, color: C.faint }}>&middot;</span>
                      <Clock size={12} style={{ color: C.faint }} />
                      <span style={{ fontSize: 12, color: C.faint }}>{activeSection.duration || deriveTimeEstimate(activeSection.tasks.length)}</span>
                    </div>
                  )}
                  {activeSection.brief && activeSection.brief.replace(/<[^>]*>/g, '').trim() && (
                    <div className="rich-content" style={{ margin: '13px 0 0', color: C.muted, fontSize: 14.5, lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(activeSection.brief) }} />
                  )}
                </div>

                {(() => {
                  const embed = activeSection.videoUrl ? safeEmbedUrl(activeSection.videoUrl) : null;
                  if (!embed) return null;
                  const isCanva = embed.includes('canva.com');
                  return (
                    <div style={{ padding: '18px 24px', borderBottom: activeSection.tasks.length > 0 ? `1px solid ${C.divider}` : 'none' }}>
                      <div style={{ borderRadius: 12, overflow: 'hidden', ...(isCanva ? { height: '88vh' } : { aspectRatio: '16 / 9' }) }}>
                        <iframe src={embed} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                      </div>
                    </div>
                  );
                })()}

                {activeSection.tasks.length > 0 && (
                  <div style={{ padding: '16px 24px 6px' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: C.faint }}>
                      {activeSection.tasks.every(t => t.type === 'sql') ? 'SQL Tasks' : activeSection.tasks.some(t => t.type === 'sql') ? 'Tasks & Questions' : 'Questions'}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {activeSection.tasks.map((task, index) => {
                    const isSQL = task.type === 'sql';
                    return (
                      <div key={task.id || `${activeSection.id}-${index}`} style={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '16px 24px', borderTop: `1px solid ${C.divider}` }}>
                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: isSQL ? 'rgba(8,145,178,0.13)' : `${accent}1f`, color: isSQL ? '#0891b2' : accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{index + 1}</span>
                        <span style={{ minWidth: 0 }}>
                          {isSQL && <span style={{ display: 'inline-block', marginBottom: 4, color: '#0891b2', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>SQL Task</span>}
                          <span style={{ display: 'block', color: C.text, fontSize: 15, fontWeight: 600, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{task.prompt}</span>
                          {task.description && <span style={{ display: 'block', marginTop: 3, color: C.muted, fontSize: 13.5, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{task.description}</span>}
                        </span>
                        {isSQL && canOpenSQLWorkbench && (
                          <button onClick={openWorkbench} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 11px', borderRadius: 9, border: 'none', background: 'rgba(8,145,178,0.12)', color: '#0891b2', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                            <Database size={13} /> Workbench
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section style={{ background: C.card, border: 'none', borderRadius: 16, padding: '22px 24px' }}>
                {dataset.description
                  ? <p style={{ margin: 0, color: C.muted, fontSize: 15, lineHeight: 1.6 }}>{dataset.description}</p>
                  : <p style={{ margin: 0, color: C.faint, textAlign: 'center' }}>No analysis phases have been added yet.</p>}
              </section>
            )}

            {/* Work with AI & tools */}
            <section style={{ background: C.card, border: 'none', borderRadius: 16, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 12px', color: C.faint, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Work with AI &amp; Tools</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                <a href={`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 10px', borderRadius: 10, background: C.input, color: C.text, fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: font }}>
                  <img src="https://jbdfdxqvdaztmlzaxxtk.supabase.co/storage/v1/object/public/Assets/openai-chatgpt-logo-icon-free-png.webp" alt="ChatGPT" style={{ width: 19, height: 19, objectFit: 'contain', flexShrink: 0 }} /> ChatGPT
                </a>
                <button onClick={copyPrompt}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 10px', borderRadius: 10, border: 'none', background: C.input, color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Prompt'}
                </button>
                {datasetFiles.length > 0 && (
                  <button onClick={openPreview}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 10px', borderRadius: 10, border: 'none', background: C.input, color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                    <Table2 size={14} /> Preview Data
                  </button>
                )}
              </div>
            </section>

            {dataset.disclaimer && (
              <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>!</span>
                <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.55 }}>{dataset.disclaimer}</p>
              </div>
            )}

            {showCta && (
              <div style={{ padding: '16px 18px', borderRadius: 14, background: `${accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 3px' }}>Go deeper with guided projects</p>
                  <p style={{ fontSize: 12.5, color: C.muted, margin: 0, lineHeight: 1.45 }}>Access structured courses, cohorts, and expert-led project experiences.</p>
                </div>
                <a href="https://festman.io" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 18px', borderRadius: 10, background: accent, color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Learn More</a>
              </div>
            )}
          </div>
        </main>
      </div>

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
                    <p style={{ margin: 0, fontSize: 14, color: C.faint }}>{zipTables.length > 1 ? `${zipTables.length} files available` : (activePdfUrl ? 'PDF preview' : 'First 10 rows preview')}</p>
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
              {loadingPreview && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: C.faint }}><Loader2 size={28} className="animate-spin" style={{ marginRight: 10 }} /> Loading preview...</div>}
              {!loadingPreview && activePdfUrl && (
                <iframe src={activePdfUrl} style={{ width: '100%', height: 560, border: 'none', borderRadius: 8, display: 'block' }} title="PDF Preview" />
              )}
              {!loadingPreview && !activePdfUrl && preview && preview.length > 0 && (
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                  <thead><tr style={{ background: C.input }}>{headers.map((h, j) => <th key={`${j}-${h}`} style={{ padding: '10px 16px', textAlign: 'left', color: C.muted, fontWeight: 700, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.cardBorder}`, fontFamily: font }}>{h || `Column ${j + 1}`}</th>)}</tr></thead>
                  <tbody>{preview.map((row, i) => <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>{row.map((cell, j) => <td key={j} style={{ padding: '9px 16px', color: C.text, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: font }}>{cell}</td>)}</tr>)}</tbody>
                </table>
              )}
              {!loadingPreview && !activePdfUrl && (!preview || preview.length === 0) && (
                <p style={{ fontSize: 14, color: C.faint, textAlign: 'center', padding: 40 }}>Preview not available for this file.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showWorkbench && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1120, background: 'rgba(0,0,0,0.64)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowWorkbench(false); }}>
          <div style={{ background: C.card, borderRadius: 16, width: 'min(96vw, 1480px)', height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', fontFamily: font }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Database size={18} style={{ color: C.cta, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dataset.title}</p>
                  <p style={{ margin: 0, fontSize: 12, color: C.faint }}>Browser-only SQL Workbench</p>
                </div>
              </div>
              <button onClick={() => setShowWorkbench(false)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: C.input, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>

            {workbenchLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint }}>
                <Loader2 size={28} className="animate-spin" style={{ marginRight: 10 }} /> Preparing tables...
              </div>
            ) : workbenchError ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
                <Database size={34} style={{ color: C.faint }} />
                <p style={{ margin: 0, fontWeight: 800, color: C.text }}>Workbench unavailable</p>
                <p style={{ margin: 0, maxWidth: 520, color: C.muted, fontSize: 14, lineHeight: 1.5 }}>{workbenchError}</p>
                <button onClick={openWorkbench} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: 'none', background: C.cta, color: C.ctaText, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
                <aside style={{ width: workbenchSideWidth, flexShrink: 0, overflowY: 'auto', overflowX: 'hidden', padding: 12, background: C.input, minWidth: 0 }}>
                  <button onClick={() => setQuestionsCollapsed(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: 'none', background: 'transparent', color: C.faint, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, cursor: 'pointer', padding: 0, fontFamily: font }}>
                    <span>SQL Tasks</span>
                    {questionsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {!questionsCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {sqlTaskSections.length > 0 ? sqlTaskSections.map((section, sectionIndex) => (
                        <div key={section.id || section.title} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 8, minWidth: 0 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, background: 'rgba(8,145,178,0.14)', color: '#0891b2', fontSize: 10.5, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sectionIndex + 1}</span>
                            {sectionIndex < sqlTaskSections.length - 1 && <span style={{ flex: 1, minHeight: 12, width: 0, borderLeft: `2px dashed ${C.cardBorder}`, margin: '4px 0' }} />}
                          </div>
                          <div style={{ minWidth: 0, paddingBottom: sectionIndex < sqlTaskSections.length - 1 ? 10 : 0 }}>
                            <p style={{ margin: '1px 0 7px', color: C.text, fontSize: 12, fontWeight: 850, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{section.title}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {section.tasks.map((task, taskIndex) => (
                                <div key={task.id || `${section.title}-${taskIndex}`} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', border: 'none', background: C.card, borderRadius: 9, padding: '8px 9px', minWidth: 0 }}>
                                  <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 999, background: C.pill, color: C.muted, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{taskIndex + 1}</span>
                                  <span style={{ minWidth: 0, color: C.text, fontSize: 12, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{task.prompt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )) : (
                        <p style={{ margin: 0, color: C.faint, fontSize: 12, lineHeight: 1.45 }}>No SQL tasks marked for this dataset.</p>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
                    <button onClick={() => setGuidelinesCollapsed(v => !v)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: 'none', background: 'transparent', color: C.faint, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, cursor: 'pointer', padding: 0, fontFamily: font }}>
                      <span>Guidelines</span>
                      {guidelinesCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {!guidelinesCollapsed && (
                      <div style={{ marginTop: 10, color: C.faint, fontSize: 11.5, lineHeight: 1.55 }}>
                        <p style={{ margin: '0 0 6px' }}>Only SELECT/WITH queries are allowed.</p>
                        <p style={{ margin: 0 }}>Results are capped at {STUDENT_RESULT_LIMIT} rows.</p>
                      </div>
                    )}
                  </div>
                </aside>

                <div onPointerDown={startWorkbenchSideResize} title="Drag to resize the tasks panel"
                  style={{ flexShrink: 0, width: 8, cursor: 'col-resize', borderLeft: `1px solid ${C.divider}`, borderRight: `1px solid ${C.divider}`, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 3, height: 42, borderRadius: 999, background: C.cardBorder }} />
                </div>

                <main ref={workbenchMainRef} style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <section style={{ flex: `0 0 ${queryPanePercent}%`, minHeight: 150, padding: 14, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                      <p style={{ margin: 0, color: C.faint, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>Query</p>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => runWorkbenchQuery()} disabled={queryRunning || !runtime}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: 'none', background: C.cta, color: C.ctaText, fontWeight: 800, fontSize: 13, cursor: queryRunning || !runtime ? 'default' : 'pointer', opacity: queryRunning ? 0.7 : 1, fontFamily: font }}>
                          {queryRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run
                        </button>
                        {queryResult && (
                          <button onClick={() => exportToCsv(queryResult, `${dataset.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'query'}_result.csv`)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: 'none', background: C.input, color: C.text, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: font }}>
                            <Download size={14} /> CSV
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, width: '100%', border: 'none', borderRadius: 12, background: C.input, padding: '0 12px', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <SQLCodeEditor
                        value={query}
                        tables={runtime?.tables ?? []}
                        C={C}
                        isDark={isDark}
                        onChange={setQuery}
                        onRun={() => runWorkbenchQuery()}
                      />
                    </div>
                    {(queryError || workbenchNotice) && (
                      <p style={{ margin: '9px 0 0', color: queryError ? '#ef4444' : C.faint, fontSize: 12, lineHeight: 1.45 }}>
                        {queryError || workbenchNotice}
                      </p>
                    )}
                  </section>

                  <div onPointerDown={startWorkbenchResize} title="Drag to resize query and output"
                    style={{ flex: '0 0 10px', cursor: 'row-resize', borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}`, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 42, height: 3, borderRadius: 999, background: C.cardBorder }} />
                  </div>

                  <section style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
                      <div style={{ display: 'flex', gap: 4, background: C.input, borderRadius: 9, padding: 3, overflowX: 'auto', minWidth: 0 }} className="hide-scrollbar">
                        <button onClick={() => setActiveOutputTab('results')}
                          style={{ flexShrink: 0, border: 'none', borderRadius: 7, padding: '6px 12px', background: activeOutputTab === 'results' ? C.card : 'transparent', color: activeOutputTab === 'results' ? C.text : C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: font }}>
                          Results
                        </button>
                        {(runtime?.tables ?? []).map(table => (
                          <button key={table.tableName} onClick={() => openTableTab(table.tableName)} title={table.tableName}
                            style={{ flexShrink: 0, maxWidth: 180, border: 'none', borderRadius: 7, padding: '6px 12px', background: activeOutputTab === table.tableName ? C.card : 'transparent', color: activeOutputTab === table.tableName ? C.text : C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 800, fontFamily: font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {compactTableLabel(table.tableName)}
                          </button>
                        ))}
                      </div>
                      {activeOutputTab === 'results' && queryResult && (
                        <span style={{ color: C.faint, fontSize: 12, flexShrink: 0 }}>
                          {queryResult.totalRows?.toLocaleString() ?? queryResult.rows.length.toLocaleString()} row{(queryResult.totalRows ?? queryResult.rows.length) === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 14 }}>
                      {activeOutputTab !== 'results' ? (
                        tablePreviewLoading ? (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint }}>
                            <Loader2 size={24} className="animate-spin" style={{ marginRight: 10 }} /> Loading table...
                          </div>
                        ) : tablePreviewError ? (
                          <p style={{ color: '#ef4444', textAlign: 'center', padding: 40, fontSize: 14 }}>{tablePreviewError}</p>
                        ) : tablePreviewResult && tablePreviewResult.rows.length > 0 ? (
                          <div style={{ minWidth: '100%', overflow: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, color: C.faint, fontSize: 12 }}>
                              <span>{compactTableLabel(activeOutputTab)}</span>
                              <span>Showing first {tablePreviewResult.rows.length.toLocaleString()} rows</span>
                            </div>
                            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: C.input }}>
                                  {tablePreviewResult.columns.map((h, j) => (
                                    <th key={`${j}-${h}`} style={{ position: 'sticky', top: 0, padding: '10px 12px', textAlign: 'left', color: C.muted, fontWeight: 800, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.cardBorder}`, fontFamily: font, background: C.input }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tablePreviewResult.rows.map((row, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>
                                    {row.map((cell, j) => (
                                      <td key={j} title={formatCell(cell)} style={{ padding: '9px 12px', color: C.text, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: font }}>{formatCell(cell) || <span style={{ color: C.faint }}>NULL</span>}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p style={{ color: C.faint, textAlign: 'center', padding: 40, fontSize: 14 }}>Select a table to preview it.</p>
                        )
                      ) : queryRunning ? (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint }}>
                            <Loader2 size={24} className="animate-spin" style={{ marginRight: 10 }} /> Running query...
                          </div>
                        ) : queryResult && queryResult.rows.length > 0 ? (
                          <div style={{ minWidth: '100%', overflow: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, color: C.faint, fontSize: 12 }}>
                              <span>{queryResult.totalRows?.toLocaleString() ?? queryResult.rows.length.toLocaleString()} row{(queryResult.totalRows ?? queryResult.rows.length) === 1 ? '' : 's'}</span>
                              {queryResult.capped && <span>Showing first {queryResult.rows.length.toLocaleString()}</span>}
                            </div>
                            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: C.input }}>
                                  {queryResult.columns.map((h, j) => (
                                    <th key={`${j}-${h}`} style={{ position: 'sticky', top: 0, padding: '10px 12px', textAlign: 'left', color: C.muted, fontWeight: 800, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.cardBorder}`, fontFamily: font, background: C.input }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {queryResult.rows.map((row, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>
                                    {row.map((cell, j) => (
                                      <td key={j} title={formatCell(cell)} style={{ padding: '9px 12px', color: C.text, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: font }}>{formatCell(cell) || <span style={{ color: C.faint }}>NULL</span>}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : queryResult ? (
                          <p style={{ color: C.faint, textAlign: 'center', padding: 40, fontSize: 14 }}>Query ran successfully with no rows returned.</p>
                        ) : (
                          <p style={{ color: C.faint, textAlign: 'center', padding: 40, fontSize: 14 }}>Run a query to see results.</p>
                        )}
                    </div>
                  </section>
                </main>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DataPlaygroundGrid({
  C,
  isDark,
  fetchHeaders,
  intro,
  loadingCardCount = 6,
  searchMaxWidth,
  searchInputShadow = false,
  showDetailCta = false,
  emptyNoDatasetsMessage = 'Try a different search term or category.',
  emptyNoMatchMessage = 'Try a different search term or category.',
}: DataPlaygroundGridProps) {
  const [datasets, setDatasets] = useState<DCDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DCDataset | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const headers = typeof fetchHeaders === 'function' ? await fetchHeaders() : fetchHeaders;
        const res = await fetch('/api/data-center', headers ? { headers } : undefined);
        const json = await res.json();
        if (!cancelled) setDatasets(json.datasets ?? []);
      } catch {
        if (!cancelled) setDatasets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [fetchHeaders]);

  const categories = Array.from(new Set(datasets.map(d => d.category).filter(Boolean))) as string[];
  const filtered = datasets.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || d.title.toLowerCase().includes(q)
      || d.description?.toLowerCase().includes(q)
      || tagsFor(d).some(t => t.toLowerCase().includes(q));
    const matchCat = !activeCategory || d.category === activeCategory;
    return matchSearch && matchCat;
  });

  const searchStyle: CSSProperties = {
    width: '100%',
    padding: searchInputShadow ? '12px 14px 12px 44px' : '11px 14px 11px 42px',
    borderRadius: 12,
    border: 'none',
    background: C.card,
    color: C.text,
    fontSize: 15,
    fontFamily: font,
    outline: 'none',
    boxSizing: 'border-box',
    ...(searchInputShadow ? { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } : {}),
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
        {Array.from({ length: loadingCardCount }, (_, i) => (
          <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: C.card, border: 'none' }}>
            <Sk C={C} h={160} r={0} />
            <div style={{ padding: 16 }}>
              <Sk C={C} h={14} w="60%" />
              <div style={{ marginTop: 8 }}><Sk C={C} h={12} /></div>
              {loadingCardCount <= 3 && <div style={{ marginTop: 4 }}><Sk C={C} h={12} w="80%" /></div>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {intro && (
        <p style={{ fontSize: 16.5, color: C.muted, margin: '0 0 20px', lineHeight: 1.6, fontFamily: font }}>
          {intro}
        </p>
      )}

      <div style={{ marginBottom: searchInputShadow ? 32 : 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ position: 'relative', maxWidth: searchMaxWidth }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.faint, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search datasets..."
            style={searchStyle}
          />
        </div>

        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => setActiveCategory(null)}
              style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: !activeCategory ? C.cta : C.card, color: !activeCategory ? C.ctaText : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s' }}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: activeCategory === cat ? C.cta : C.card, color: activeCategory === cat ? C.ctaText : C.muted, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font, transition: 'all 0.15s' }}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: datasets.length === 0 ? '60px 20px' : '48px 20px', color: C.faint, fontFamily: font }}>
          <Database size={40} style={{ color: C.faint, display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 600, fontSize: 16, color: C.text, marginBottom: 4 }}>{datasets.length === 0 ? 'No datasets available yet' : 'No datasets match your search'}</p>
          <p style={{ fontSize: 13, color: C.faint }}>{datasets.length === 0 ? emptyNoDatasetsMessage : emptyNoMatchMessage}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
          {filtered.map(d => {
            const files = getDatasetFiles(d);
            return (
              <div key={d.id} style={{ background: C.card, border: 'none', borderRadius: 18, overflow: 'hidden', textAlign: 'left', fontFamily: font, minHeight: 420, display: 'flex', flexDirection: 'column' }}>
                {d.cover_image_url ? (
                  <div style={{ padding: '14px 14px 0', overflow: 'hidden', borderRadius: 12 }}>
                    <img src={d.cover_image_url} alt={d.cover_image_alt ?? ''} style={{ width: '100%', aspectRatio: '16/7', objectFit: 'cover', display: 'block', borderRadius: 12, transition: 'transform 0.35s ease, filter 0.35s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.filter = 'brightness(1.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'brightness(1)'; }}
                    />
                  </div>
                ) : (
                  <div style={{ padding: '14px 14px 0' }}>
                    <div style={{ width: '100%', aspectRatio: '16/7', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                      <Database size={36} style={{ color: C.green }} />
                    </div>
                  </div>
                )}

                <div style={{ padding: '16px 18px 0', flex: 1 }}>
                  {tagsFor(d).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                      {tagsFor(d).slice(0, 3).map(t => <span key={t} style={{ fontSize: 13, padding: '3px 9px', borderRadius: 20, background: C.pill, color: C.muted, fontWeight: 700, letterSpacing: 0.2 }}>{t}</span>)}
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

                <div style={{ padding: '14px 18px 18px', display: 'flex', gap: 8, borderTop: `1px solid ${C.divider}`, marginTop: 14 }}>
                  <button onClick={() => setSelected(d)}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: C.cta, color: C.ctaText, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    View Details
                  </button>
                  {files.length > 0 && (
                    <a href={files[0].url} download={files[0].name ?? true} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, border: 'none', background: C.input, color: C.text, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
                      <Download size={14} /> Download
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && <DatasetDetailPane dataset={selected} C={C} isDark={isDark} showCta={showDetailCta} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  );
}
