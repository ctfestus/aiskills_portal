import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function authenticate(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user }, error } = await adminClient().auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return { userId: user.id };
}

async function extractExcelText(buffer: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sections: string[] = [];
  for (const ws of wb.worksheets) {
    const lines: string[] = [`Sheet: ${ws.name}`];
    ws.eachRow(row => {
      row.eachCell({ includeEmpty: false }, cell => {
        if (cell.formula) lines.push(`  ${cell.address}: =${cell.formula}`);
        else if (cell.value != null && cell.value !== '') lines.push(`  ${cell.address}: ${cell.value}`);
      });
    });
    if (lines.length > 1) sections.push(lines.join('\n'));
  }
  return sections.join('\n\n');
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    criteria: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['criteria'],
};

// POST /api/extract-rubric
// Body: multipart/form-data with `file` and `label` (reference_solution | benchmark | cost_document)
// Returns: { criteria: string[] }
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file') as File | null;
  const label = (form.get('label') as string | null) ?? 'reference_solution';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });

  const buffer = await file.arrayBuffer();
  const mime = file.type || 'application/octet-stream';

  const docDescription = 'a completed reference solution file';

  const ai = new GoogleGenAI({ apiKey });

  let parts: any[];

  const isExcel = mime.includes('spreadsheet') || mime.includes('excel') ||
    file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
  const isText = mime.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.txt');

  if (isExcel) {
    const text = await extractExcelText(buffer);
    parts = [
      {
        text: `You are an expert assessment designer. The instructor has uploaded ${docDescription} (an Excel/spreadsheet file). Analyse the content below and extract clear, specific, measurable rubric criteria that an AI reviewer can use to grade student submissions. Extract as many criteria as the file warrants -- one criterion per distinct requirement, skill, or standard present in the file. Return each as a concise action-oriented statement.\n\nFile content:\n${text}`,
      },
    ];
  } else if (isText) {
    const text = new TextDecoder().decode(buffer);
    parts = [
      {
        text: `You are an expert assessment designer. The instructor has uploaded ${docDescription}. Analyse the content below and extract clear, specific, measurable rubric criteria that an AI reviewer can use to grade student submissions. Extract as many criteria as the file warrants -- one criterion per distinct requirement, skill, or standard present in the file. Return each as a concise action-oriented statement.\n\nFile content:\n${text}`,
      },
    ];
  } else {
    // PDF, images, Word -- send as inline base64 data
    const base64 = Buffer.from(buffer).toString('base64');
    const isImage = mime.startsWith('image/');
    const imageInstruction = isImage
      ? `This is a completed dashboard screenshot. Extract rubric criteria based on what you observe visually: chart type choices, KPI placement and formatting, layout and hierarchy, colour usage, labelling clarity, axis correctness, insight callouts, and overall readability. Each criterion should be something a student dashboard can be objectively graded against.`
      : `Analyse the file and extract clear, specific, measurable rubric criteria that an AI reviewer can use to grade student submissions.`;
    parts = [
      {
        text: `You are an expert assessment designer. The instructor has uploaded ${docDescription}. ${imageInstruction} Extract as many criteria as the file warrants -- one criterion per distinct requirement, skill, or standard present. Return each as a concise action-oriented statement.`,
      },
      {
        inlineData: { mimeType: mime, data: base64 },
      },
    ];
  }

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.3,
      },
    });

    const raw = result.text ?? '{}';
    const parsed = JSON.parse(raw);
    const criteria: string[] = (parsed.criteria ?? []).map((c: string) => c.trim()).filter(Boolean);

    return NextResponse.json({ criteria });
  } catch (err: any) {
    console.error('[extract-rubric]', err);
    return NextResponse.json({ error: 'Failed to extract rubric from file' }, { status: 500 });
  }
}
