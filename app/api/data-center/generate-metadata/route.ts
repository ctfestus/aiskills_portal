import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateJSON } from '@/lib/ai';
import { Type } from '@google/genai';
import { validatePublicDatasetUrl } from '@/lib/dataset-url-safety';

export const dynamic = 'force-dynamic';

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_ZIP_ENTRIES    = 50;
const MAX_ZIP_ENTRY_BYTES = 512 * 1024;
const MAX_XLSX_SHEETS    = 10;
const MAX_SAMPLE_CHARS    = 64 * 1024;

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getSessionUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.slice(7);
  if (!token) return null;
  const { data: { user } } = await adminClient().auth.getUser(token);
  if (!user) return null;
  const { data: s } = await adminClient().from('students').select('role').eq('id', user.id).single();
  const role = s?.role ?? 'student';
  if (role !== 'admin' && role !== 'instructor') return null;
  return { id: user.id, role };
}

async function safeFetch(url: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
      throw new Error('File too large (max 50 MB)');
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_DOWNLOAD_BYTES) { reader.cancel(); throw new Error('File too large (max 50 MB)'); }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDataSample(fileUrl: string): Promise<string> {
  const lower = fileUrl.toLowerCase();
  try {
    if (lower.endsWith('.zip')) {
      const JSZip = (await import('jszip')).default;
      const buf = await safeFetch(fileUrl);
      const zip = await JSZip.loadAsync(buf);
      const allEntries = Object.keys(zip.files).filter(n => !zip.files[n].dir);
      if (allEntries.length > MAX_ZIP_ENTRIES) {
        return `ZIP archive has too many entries (${allEntries.length}); refusing to parse.`;
      }
      const csvFiles = allEntries.filter(n => n.toLowerCase().endsWith('.csv'));
      const lines: string[] = [`ZIP archive containing ${csvFiles.length} table(s):`];
      for (const name of csvFiles.slice(0, 6)) {
        const entrySize = (zip.files[name] as any)._data?.uncompressedSize;
        if (typeof entrySize === 'number' && entrySize > MAX_ZIP_ENTRY_BYTES) {
          lines.push(`- ${name.replace(/^.*\//, '')}: skipped because the table is too large to sample safely`);
          continue;
        }
        const content = await zip.files[name].async('string');
        const header = content.slice(0, MAX_SAMPLE_CHARS).split('\n')[0].trim();
        lines.push(`- ${name.replace(/^.*\//, '').replace(/\.csv$/i, '')}: ${header}`);
      }
      return lines.join('\n');
    }

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const buf = await safeFetch(fileUrl);
      const wb = XLSX.read(buf, { type: 'array' });
      const sheets = wb.SheetNames.slice(0, MAX_XLSX_SHEETS);
      const lines: string[] = [`Excel workbook with ${wb.SheetNames.length} sheet(s):`];
      for (const name of sheets) {
        const ws = wb.Sheets[name];
        const ref = ws['!ref'];
        if (!ref) continue;
        const range = XLSX.utils.decode_range(ref);
        range.e.r = Math.min(range.e.r, range.s.r + 3);
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', range });
        const header = (rows[0] as string[])?.join(', ') ?? '';
        const sample = rows.slice(1, 4).map(r => (r as string[]).join(', ')).join(' | ');
        lines.push(`Sheet "${name}" columns: ${header}`);
        if (sample) lines.push(`  Sample rows: ${sample}`);
      }
      return lines.join('\n');
    }

    // CSV
    const buf = await safeFetch(fileUrl);
    const text = new TextDecoder().decode(buf);
    return text.slice(0, MAX_SAMPLE_CHARS).split('\n').slice(0, 15).join('\n');

  } catch (err) {
    return `Could not fetch file: ${(err as Error).message}`;
  }
}

const CATEGORIES = [
  'Finance', 'Human Resources', 'Fintech', 'E-Commerce', 'Marketing',
  'Health Care', 'Hospitality', 'Sport', 'Retail', 'Banking', 'Telecom', 'Other',
];

const schema = {
  type: Type.OBJECT,
  properties: {
    title:            { type: Type.STRING },
    description:      { type: Type.STRING },
    scenario:         { type: Type.STRING },
    category:         { type: Type.STRING },
    tags:             { type: Type.ARRAY, items: { type: Type.STRING } },
    sample_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    sample_question_types: { type: Type.ARRAY, items: { type: Type.STRING } },
    analyst_sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          brief: { type: Type.STRING },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                prompt: { type: Type.STRING },
                type: { type: Type.STRING },
              },
              required: ['prompt', 'type'],
            },
          },
        },
        required: ['title', 'brief', 'tasks'],
      },
    },
  },
  required: ['title', 'description', 'scenario', 'category', 'tags', 'sample_questions', 'sample_question_types', 'analyst_sections'],
};

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, file_name } = await req.json();
  if (!file_url) return NextResponse.json({ error: 'file_url is required' }, { status: 400 });

  const urlCheck = await validatePublicDatasetUrl(file_url);
  if (!urlCheck.ok) return NextResponse.json({ error: urlCheck.error }, { status: 400 });

  const dataSample = await fetchDataSample(file_url);

  const prompt = `You are a data analyst helping to document a dataset for a learning platform used by African professionals.

File name: ${file_name ?? file_url.split('/').pop()}
File URL: ${file_url}

Data preview:
${dataSample}

Based on the data above, generate metadata for this dataset:

- title: A clear, descriptive name for the dataset (5-10 words max)
- description: 2-3 sentences describing what the dataset contains, its source context, and what it can be used for. Write for a data analyst audience.
- scenario: 2-4 short paragraphs of rich-text HTML for the "Scenario / Background" field. Create a realistic workplace or business context around the dataset: who collected it, what decision or problem the analyst is supporting, why the dataset matters, and how learners should think about the analysis. Use only simple HTML tags like <p>, <strong>, <ul>, <li>. Do not include markdown.
- category: Choose the single most relevant category from this list: ${CATEGORIES.join(', ')}
- tags: 3-5 meaningful keyword tags relevant to the data. Use proper title case (e.g. "Customer Loyalty", "Flight Data", "Africa", "Retail Analytics"). 1-3 words per tag, no punctuation.
- analyst_sections: 3-5 dataset-specific analysis phases, similar to guided project milestones. Do NOT use generic fixed titles like "Understand the Dataset" unless the dataset truly calls for it. Each section title should reflect the actual data and scenario, e.g. "Campaign Channel Performance", "Off-Schedule Attendance Risk", "Regional Revenue Leakage", or "Customer Retention Drivers".
  - Each section needs a short brief explaining what the learner is investigating.
  - Each section needs 2-4 tasks.
  - Task type must be "sql" only when the task can be answered directly with a SELECT/WITH query from the available tables. Use "analytics" for interpretation, recommendations, root-cause thinking, communication, visualization planning, or questions requiring context beyond SQL.
  - Include a connected flow from initial baseline checks to deeper diagnosis and final business recommendation.
- sample_questions and sample_question_types: a flat backward-compatible copy of all analyst section tasks, in the same order. sample_question_types must use "sql" or "analytics" for each matching question.

Return only valid JSON.`;

  try {
    const result = await generateJSON(prompt, schema, { temperature: 0.6 });
    if (!CATEGORIES.includes(result.category)) result.category = 'Other';
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
