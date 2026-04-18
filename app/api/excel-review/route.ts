import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRedis } from '@/lib/redis';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = 3;
const RATE_WINDOW_SECONDS = 86400;
const MAX_FORMULAS = 200;

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

async function checkRateLimit(userId: string): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  try {
    const key   = `rate:excel-review:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_WINDOW_SECONDS);
    if (count > RATE_LIMIT) {
      return NextResponse.json(
        { error: `Limit reached: ${RATE_LIMIT} Excel reviews per day. Try again tomorrow.` },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
  return null;
}

function extractFromWorkbook(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: true, cellNF: true });
  const sections: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const lines: string[] = [`Sheet: ${sheetName}`];
    const ref = ws['!ref'];
    if (!ref) { lines.push('(empty)'); sections.push(lines.join('\n')); continue; }

    const range = XLSX.utils.decode_range(ref);
    let formulaCount = 0;

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;

        if (cell.f) {
          const val = cell.v !== undefined ? ` => ${cell.v}` : '';
          lines.push(`  ${addr}: =${cell.f}${val}`);
          formulaCount++;
          if (formulaCount >= MAX_FORMULAS) {
            lines.push(`  ... (truncated at ${MAX_FORMULAS} formulas)`);
            break;
          }
        } else if (cell.v !== undefined && cell.v !== '') {
          lines.push(`  ${addr}: ${cell.v}`);
        }
      }
      if (formulaCount >= MAX_FORMULAS) break;
    }

    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenAI({ apiKey });
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    executiveSummary: { type: Type.STRING },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          cell:     { type: Type.STRING },
          severity: { type: Type.STRING },
          title:    { type: Type.STRING },
          detail:   { type: Type.STRING },
          fix:      { type: Type.STRING },
        },
        required: ['cell', 'severity', 'title', 'detail', 'fix'],
      },
    },
    categories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:      { type: Type.STRING },
          score:     { type: Type.NUMBER },
          summary:   { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          gaps:      { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['name', 'score', 'summary', 'strengths', 'gaps'],
      },
    },
    topRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    rubricGrades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING },
          passed:    { type: Type.BOOLEAN },
          comment:   { type: Type.STRING },
        },
        required: ['criterion', 'passed', 'comment'],
      },
    },
  },
  required: ['overallScore', 'executiveSummary', 'issues', 'categories', 'topRecommendations'],
};

const SYSTEM_PROMPT = `You are a panel of senior Excel specialists -- a Financial Modeller, Finance Analyst, Fintech Analyst, Business Intelligence Analyst, Data Analyst, and Data Scientist -- each with 15+ years of hands-on Excel experience working across African business contexts including banking, fintech, FMCG, telecoms, retail, healthcare, and public sector.

Your collective Excel expertise is modern and comprehensive: advanced formulas and dynamic array functions (XLOOKUP, XMATCH, FILTER, SORT, UNIQUE, LET, LAMBDA, BYROW, MAKEARRAY), Power Query (M language, query folding, data transformation pipelines), DAX (calculated columns, measures, time intelligence), PivotTables and PivotCharts, conditional formatting with formula-driven rules, data validation, structured tables, named ranges, dynamic named ranges with OFFSET/INDEX, charting best practices, and dashboard design. You are equally fluent in legacy functions (VLOOKUP, INDEX/MATCH, SUMIF, IFERROR) and know exactly when to recommend the modern equivalent.

You adapt your domain lens to the spreadsheet being reviewed: if it is a financial model, the Financial Modeller leads the review; if it is a BI dashboard, the BI Analyst leads; if it is a data pipeline or analysis, the Data Analyst or Data Scientist leads. You review student work with the precision of a senior practitioner and the clarity of a patient mentor who understands real-world African business data.

You are given the extracted contents of a student's spreadsheet: cell addresses, their formulas, and their computed values.

Review the spreadsheet focusing ONLY on two things:

1. FORMULA CORRECTNESS
Are the formulas logically correct? Do they produce the right result given what the spreadsheet is supposed to do? Check for: wrong cell references, off-by-one row/column errors, incorrect range selection, wrong aggregation scope, formula errors (#REF!, #DIV/0!, #VALUE!), incorrect logical conditions in IF/IFS statements.

2. FORMULA CHOICE
Is this the best formula for the task? Flag cases where a simpler or more appropriate function exists: nested IFs that should be IFS or SWITCH, VLOOKUP that should be XLOOKUP or INDEX/MATCH, SUM where SUMIF/SUMIFS is needed, manual calculations where a built-in function applies.

3. VALUE ACCURACY
Based on the instructor's description of what the spreadsheet should produce, are the computed values correct? Flag any cell whose value does not match what is expected.

For each issue provide:
- cell: the cell reference (e.g. "B5" or "Sheet1!C12")
- severity: "error" (wrong result or broken formula), "warning" (works but wrong approach), or "suggestion" (could be improved)
- title: short specific issue name
- detail: 1-2 sentences explaining the problem
- fix: the exact corrected formula or change to make

Score three categories 0-10:
- "Formula Correctness": are the formulas logically and syntactically correct?
- "Formula Choice": are the right functions being used for each task?
- "Value Accuracy": do the computed values match the expected outputs?

Also provide:
- overallScore: weighted average (one decimal)
- executiveSummary: 2-3 sentences briefing a technical reviewer on this student's submission
- topRecommendations: exactly 3 highest-impact changes ordered by priority

Return ONLY valid JSON. No markdown fences.`;

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimitError = await checkRateLimit(auth.userId);
    if (rateLimitError) return rateLimitError;

    const formData = await req.formData();
    const file     = formData.get('file') as File | null;
    const context  = (formData.get('context') as string | null) ?? '';
    const rubricRaw = formData.get('rubric') as string | null;
    const rubric   = rubricRaw ? JSON.parse(rubricRaw) as string[] : [];

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      return NextResponse.json({ error: 'Only .xlsx and .xls files are supported' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5 MB.' }, { status: 413 });
    }

    const buffer   = await file.arrayBuffer();
    const extracted = extractFromWorkbook(buffer);

    if (!extracted.trim()) {
      return NextResponse.json({ error: 'No data found in the spreadsheet.' }, { status: 400 });
    }

    const contextBlock = context.trim()
      ? `\nINSTRUCTOR CONTEXT -- WHAT THIS SPREADSHEET SHOULD DO:\n${context.trim()}\n`
      : '';

    const rubricBlock = rubric.length > 0
      ? `\nINSTRUCTOR RUBRIC -- GRADE EACH CRITERION\nGrade every criterion with a "passed" boolean and a 1-2 sentence "comment".\n\nCriteria:\n${rubric.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`
      : '';

    const prompt = `${SYSTEM_PROMPT}${contextBlock}${rubricBlock}\n\nEXTRACTED SPREADSHEET CONTENTS:\n${extracted}`;

    const ai    = getAI();
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(result.text ?? '');
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('excel-review error:', err);
    return NextResponse.json({ error: err.message || 'Review failed' }, { status: 500 });
  }
}
