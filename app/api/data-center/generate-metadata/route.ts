import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateJSON } from '@/lib/ai';
import { Type } from '@google/genai';

export const dynamic = 'force-dynamic';

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

async function fetchDataSample(fileUrl: string): Promise<string> {
  const lower = fileUrl.toLowerCase();
  try {
    const res = await fetch(fileUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return `File URL returned ${res.status}`;

    if (lower.endsWith('.zip')) {
      const JSZip = (await import('jszip')).default;
      const buf = await res.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const csvFiles = Object.keys(zip.files).filter(n => !zip.files[n].dir && n.toLowerCase().endsWith('.csv'));
      const lines: string[] = [`ZIP archive containing ${csvFiles.length} table(s):`];
      for (const name of csvFiles.slice(0, 6)) {
        const content = await zip.files[name].async('string');
        const header = content.split('\n')[0].trim();
        lines.push(`- ${name.replace(/^.*\//, '').replace(/\.csv$/i, '')}: ${header}`);
      }
      return lines.join('\n');
    }

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const lines: string[] = [`Excel workbook with ${wb.SheetNames.length} sheet(s):`];
      for (const name of wb.SheetNames.slice(0, 4)) {
        const ws = wb.Sheets[name];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const header = (rows[0] as string[])?.join(', ') ?? '';
        const sample = rows.slice(1, 4).map(r => (r as string[]).join(', ')).join(' | ');
        lines.push(`Sheet "${name}" columns: ${header}`);
        if (sample) lines.push(`  Sample rows: ${sample}`);
      }
      return lines.join('\n');
    }

    // CSV
    const text = await res.text();
    const rows = text.split('\n').slice(0, 15).join('\n');
    return rows;

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
    category:         { type: Type.STRING },
    tags:             { type: Type.ARRAY, items: { type: Type.STRING } },
    sample_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['title', 'description', 'category', 'tags', 'sample_questions'],
};

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { file_url, file_name } = await req.json();
  if (!file_url) return NextResponse.json({ error: 'file_url is required' }, { status: 400 });

  const dataSample = await fetchDataSample(file_url);

  const prompt = `You are a data analyst helping to document a dataset for a learning platform used by African professionals.

File name: ${file_name ?? file_url.split('/').pop()}
File URL: ${file_url}

Data preview:
${dataSample}

Based on the data above, generate metadata for this dataset:

- title: A clear, descriptive name for the dataset (5-10 words max)
- description: 2-3 sentences describing what the dataset contains, its source context, and what it can be used for. Write for a data analyst audience.
- category: Choose the single most relevant category from this list: ${CATEGORIES.join(', ')}
- tags: 3-5 meaningful keyword tags relevant to the data. Use proper title case (e.g. "Customer Loyalty", "Flight Data", "Africa", "Retail Analytics"). 1-3 words per tag, no punctuation.
- sample_questions: 6 business and problem-focused questions a data analyst could answer by analysing this dataset. Frame them as real business problems or decisions a manager or analyst would ask -- not generic exploration. Do NOT mention any tools. Cover a mix of: KPI measurement, trend analysis, segmentation, performance comparison, and root cause investigation. Examples of the right tone: "Which customer segments have the highest churn rate and what factors drive it?", "How has monthly revenue trended over the past year and which regions are underperforming against targets?", "Which products generate the highest profit margin and how does this vary by category?"

Return only valid JSON.`;

  try {
    const result = await generateJSON(prompt, schema, { temperature: 0.6 });
    // Ensure category is valid
    if (!CATEGORIES.includes(result.category)) result.category = 'Other';
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
