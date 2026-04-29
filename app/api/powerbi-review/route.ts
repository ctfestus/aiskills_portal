import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRedis } from '@/lib/redis';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = 3;
const RATE_WINDOW_SECONDS = 86400;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function authenticate(req: NextRequest): Promise<{ userId: string; role: string } | NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: student } = await supabase
    .from('students')
    .select('role')
    .eq('id', user.id)
    .single();
  return { userId: user.id, role: student?.role ?? 'student' };
}

async function checkRateLimit(userId: string): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  try {
    const key = `rate:powerbi-review:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, RATE_WINDOW_SECONDS);
    if (count > RATE_LIMIT) {
      return NextResponse.json(
        { error: `Limit reached: ${RATE_LIMIT} Power BI reviews per day. Try again tomorrow.` },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
  return null;
}

// Recursively scan any JSON object for ALL measure references (fields, conditional
// formatting, tooltips, background color rules, drill-through -- anywhere in the config)
function collectMeasureRefs(obj: any, found: Set<string>) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) { for (const item of obj) collectMeasureRefs(item, found); return; }
  if (obj.Measure?.Expression?.SourceRef?.Entity && obj.Measure?.Property) {
    found.add(`${obj.Measure.Expression.SourceRef.Entity}.${obj.Measure.Property}`);
  }
  if (obj.Column?.Expression?.SourceRef?.Entity && obj.Column?.Property) {
    found.add(`${obj.Column.Expression.SourceRef.Entity}.${obj.Column.Property}`);
  }
  if (obj.Aggregation?.Expression?.Column?.Expression?.SourceRef?.Entity && obj.Aggregation?.Expression?.Column?.Property) {
    found.add(`${obj.Aggregation.Expression.Column.Expression.SourceRef.Entity}.${obj.Aggregation.Expression.Column.Property}`);
  }
  if (obj.HierarchyLevel?.Expression?.Hierarchy?.Expression?.SourceRef?.Entity && obj.HierarchyLevel?.Expression?.Hierarchy?.Property) {
    found.add(`${obj.HierarchyLevel.Expression.Hierarchy.Expression.SourceRef.Entity}.${obj.HierarchyLevel.Expression.Hierarchy.Property}`);
  }
  for (const val of Object.values(obj)) collectMeasureRefs(val, found);
}

function normalizeFieldRef(ref: string): string {
  return ref.replace(/^'+|'+$/g, '').trim();
}

function measureNameFromRef(ref: string): string {
  const normalized = normalizeFieldRef(ref);
  const parts = normalized.split('.');
  return parts[parts.length - 1] ?? normalized;
}

function extractLayoutInfo(layout: any): { text: string; evidence: { pages: string[]; visualTypes: string[]; fieldRefs: string[]; measureNames: string[] } } {
  const lines: string[] = ['=== REPORT LAYOUT ==='];
  const pageNames = new Set<string>();
  const visualTypes = new Set<string>();
  const fieldRefs = new Set<string>();
  const measureNames = new Set<string>();
  const pages: any[] = layout.sections ?? [];
  for (const page of pages) {
    const pageName = page.displayName ?? page.name ?? 'Unnamed';
    pageNames.add(pageName);
    lines.push(`\nPage: ${pageName}`);
    const visuals: any[] = page.visualContainers ?? [];
    for (const v of visuals) {
      try {
        const cfg = JSON.parse(v.config ?? '{}');
        const sv = cfg.singleVisual ?? {};
        const type = sv.visualType ?? 'unknown';
        visualTypes.add(type);
        const titleProp = sv.vcObjects?.title?.[0]?.properties?.text?.expr?.Literal?.Value ?? '';
        const title = titleProp ? ` "${titleProp.replace(/^'|'$/g, '')}"` : '';
        lines.push(`  Visual: ${type}${title}`);

        // Collect ALL measure references in this visual: data fields, conditional
        // formatting, tooltips, background color rules, drill-through, etc.
        const allRefs = new Set<string>();
        collectMeasureRefs(cfg, allRefs);

        // Also parse filters JSON for measure refs
        try {
          if (v.filters) collectMeasureRefs(JSON.parse(v.filters), allRefs);
        } catch { /* ignore */ }

        if (allRefs.size > 0) {
          const normalizedRefs = [...allRefs].map(normalizeFieldRef).sort((a, b) => a.localeCompare(b));
          for (const ref of normalizedRefs) {
            fieldRefs.add(ref);
            measureNames.add(measureNameFromRef(ref));
          }
          lines.push(`    Fields used: ${normalizedRefs.join(', ')}`);
          lines.push(`    Measure names: ${normalizedRefs.map(measureNameFromRef).join(', ')}`);
        }

        const filters = v.filters;
        if (filters) {
          try {
            const f = JSON.parse(filters);
            if (Array.isArray(f) && f.length) lines.push(`    Filters: ${f.length} filter(s) applied`);
          } catch { /* ignore */ }
        }
      } catch { /* skip malformed visual */ }
    }
  }

  lines.push('\n=== EXTRACTED EVIDENCE SUMMARY ===');
  lines.push(`Pages found: ${pageNames.size > 0 ? [...pageNames].join(', ') : '[none]'}`);
  lines.push(`Visual types found: ${visualTypes.size > 0 ? [...visualTypes].join(', ') : '[none]'}`);
  lines.push(`Fields used: ${fieldRefs.size > 0 ? [...fieldRefs].join(', ') : '[none]'}`);
  lines.push(`Measure names found: ${measureNames.size > 0 ? [...measureNames].join(', ') : '[none]'}`);

  return {
    text: lines.join('\n'),
    evidence: {
      pages: [...pageNames],
      visualTypes: [...visualTypes],
      fieldRefs: [...fieldRefs],
      measureNames: [...measureNames],
    },
  };
}

const PQ_PER_QUERY_LIMIT = 5000;  // chars per query file
const PQ_TOTAL_LIMIT     = 18000; // total M code chars

function findZipStart(buffer: ArrayBuffer): ArrayBuffer {
  const view = new Uint8Array(buffer);
  const limit = Math.min(view.length - 4, 8192);
  for (let i = 0; i < limit; i++) {
    if (view[i] === 0x50 && view[i + 1] === 0x4B && view[i + 2] === 0x03 && view[i + 3] === 0x04) {
      return buffer.slice(i);
    }
  }
  return buffer;
}

async function extractMashup(mashupBuffer: ArrayBuffer): Promise<string> {
  const header = '=== POWER QUERY (M CODE) ===';
  try {
    const inner = await JSZip.loadAsync(findZipStart(mashupBuffer));
    const allNames = Object.keys(inner.files).filter(n => !inner.files[n].dir);
    const parts: string[] = [header];
    let totalChars = 0;

    for (const name of allNames) {
      if (totalChars >= PQ_TOTAL_LIMIT) {
        parts.push('\n[Additional query files truncated to stay within size limit]');
        break;
      }
      try {
        const text = await inner.files[name].async('text');
        const trimmed = text.trim();
        if (trimmed && (
          name.endsWith('.m') || name.endsWith('.pq') ||
          name.toLowerCase().includes('section') ||
          name.toLowerCase().includes('formula') ||
          trimmed.startsWith('section ') || trimmed.startsWith('let') ||
          trimmed.includes(' = Table.') || trimmed.includes(' = Sql.') ||
          trimmed.includes(' = Excel.') || trimmed.includes(' = Csv.')
        )) {
          const chunk = trimmed.slice(0, PQ_PER_QUERY_LIMIT);
          parts.push(`\n-- Query file: ${name} --\n${chunk}${trimmed.length > PQ_PER_QUERY_LIMIT ? '\n[truncated]' : ''}`);
          totalChars += chunk.length;
        }
      } catch { /* binary file, skip */ }
    }

    // Nothing matched M-code patterns -- fall back to dumping ALL readable text files
    if (parts.length === 1 && allNames.length > 0) {
      for (const name of allNames) {
        if (totalChars >= PQ_TOTAL_LIMIT) {
          parts.push('\n[Additional files truncated]');
          break;
        }
        try {
          const text = await inner.files[name].async('text');
          const trimmed = text.trim();
          // Accept any file with printable content (skip obvious binary blobs)
          const printableRatio = (trimmed.match(/[\x20-\x7E\r\n\t]/g)?.length ?? 0) / Math.max(trimmed.length, 1);
          if (trimmed.length > 10 && printableRatio > 0.85) {
            const chunk = trimmed.slice(0, PQ_PER_QUERY_LIMIT);
            parts.push(`\n-- File: ${name} --\n${chunk}${trimmed.length > PQ_PER_QUERY_LIMIT ? '\n[truncated]' : ''}`);
            totalChars += chunk.length;
          }
        } catch { /* binary, skip */ }
      }
    }

    if (parts.length === 1) {
      const listing = allNames.length > 0
        ? `Files found inside DataMashup: ${allNames.join(', ')}`
        : 'DataMashup archive is empty or unreadable.';
      return `${header}\n[POWER QUERY NOT EXTRACTABLE FROM THIS FILE - ${listing}]\nDo NOT comment on individual step names, column renames, or type changes -- no M code is available to review.`;
    }

    return parts.join('\n');
  } catch {
    return `${header}\n[POWER QUERY NOT EXTRACTABLE - DataMashup could not be parsed]\nDo NOT comment on individual step names, column renames, or type changes -- no M code is available to review.`;
  }
}

const MODEL_PER_FILE_LIMIT = 8000; // chars per DataModel file
const MODEL_TOTAL_LIMIT    = 12000; // total DataModel chars

async function tryExtractModel(zip: JSZip): Promise<string> {
  const parts: string[] = [];
  let totalChars = 0;
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir || totalChars >= MODEL_TOTAL_LIMIT) continue;
    if (!path.startsWith('DataModel')) continue;
    const lp = path.toLowerCase();
    if (lp.endsWith('.json') || lp.endsWith('.bim') || lp.endsWith('.xml') || lp.endsWith('.tmdl')) {
      try {
        const text = await file.async('text');
        if (text.length > 10 && (text.includes('{') || text.includes('<') || text.includes('measure'))) {
          const chunk = text.slice(0, MODEL_PER_FILE_LIMIT);
          parts.push(`=== DATA MODEL (${path}) ===\n${chunk}${text.length > MODEL_PER_FILE_LIMIT ? '\n[truncated]' : ''}`);
          totalChars += chunk.length;
        }
      } catch { /* binary, skip */ }
    }
  }
  if (parts.length === 0) {
    parts.push('=== DATA MODEL ===\n[DATA MODEL METADATA NOT EXTRACTABLE - stored in binary format. Review only what is visible in the Report Layout section above. Do NOT invent table names, relationships, or column names not shown there.]');
  }
  return parts.join('\n\n');
}

// -- PBIX extraction ---

async function extractPbix(buffer: ArrayBuffer): Promise<{ text: string; evidence: { pages: string[]; visualTypes: string[]; fieldRefs: string[]; measureNames: string[] } }> {
  const zip = await JSZip.loadAsync(buffer);
  const sections: string[] = [];
  const evidence = {
    pages: [] as string[],
    visualTypes: [] as string[],
    fieldRefs: [] as string[],
    measureNames: [] as string[],
  };

  // 1. Report Layout
  const layoutFile = zip.file('Report/Layout');
  if (layoutFile) {
    try {
      const buf = await layoutFile.async('arraybuffer');
      let text: string;
      try {
        let decoded = new TextDecoder('utf-16le').decode(buf);
        if (decoded.charCodeAt(0) === 0xFEFF) decoded = decoded.slice(1);
        JSON.parse(decoded); // validate before committing
        text = decoded;
      } catch {
        text = new TextDecoder('utf-8').decode(buf);
      }
      const layout = JSON.parse(text);
      const extractedLayout = extractLayoutInfo(layout);
      sections.push(extractedLayout.text);
      evidence.pages = extractedLayout.evidence.pages;
      evidence.visualTypes = extractedLayout.evidence.visualTypes;
      evidence.fieldRefs = extractedLayout.evidence.fieldRefs;
      evidence.measureNames = extractedLayout.evidence.measureNames;
    } catch { /* skip */ }
  }

  // 2. Data Mashup (Power Query)
  const mashupFile = zip.file('DataMashup');
  if (mashupFile) {
    const buf = await mashupFile.async('arraybuffer');
    sections.push(await extractMashup(buf));
  } else {
    sections.push('=== POWER QUERY (M CODE) ===\n[NO DataMashup FILE FOUND IN .pbix]\nDo NOT comment on Power Query steps, column renames, type changes, or any M code -- there is nothing to review.');
  }

  // 3. Data Model metadata
  const modelText = await tryExtractModel(zip);
  if (modelText) sections.push(modelText);

  // 4. Connections metadata
  const connFile = zip.file('Connections');
  if (connFile) {
    try {
      const text = await connFile.async('text');
      sections.push(`=== CONNECTIONS ===\n${text.slice(0, 2000)}`);
    } catch { /* skip */ }
  }

  return {
    text: sections.join('\n\n---\n\n') || 'Could not extract readable content from this .pbix file.',
    evidence,
  };
}

function matchesMeasureCriterion(criterion: string): string | null {
  const eqIndex = criterion.indexOf('=');
  if (eqIndex === -1) return null;
  const measureName = criterion.slice(0, eqIndex).trim();
  return measureName || null;
}

function finalizeRubricGrades(rubric: string[], rawGrades: any[] | undefined, evidence: { measureNames: string[]; fieldRefs: string[]; pages: string[] }): any[] | undefined {
  if (rubric.length === 0) return rawGrades;

  const normalizedMeasureNames = new Set(evidence.measureNames.map(name => name.toLowerCase()));
  const normalizedFieldRefs = new Set(evidence.fieldRefs.map(ref => ref.toLowerCase()));
  const layoutWasExtracted = evidence.pages.length > 0;
  const extractedMeasures = evidence.measureNames.length > 0 ? evidence.measureNames.join(', ') : '[none]';
  const gradesByCriterion = new Map((rawGrades ?? []).map((grade: any) => [grade?.criterion, grade]));

  return rubric.map((criterion) => {
    const deterministicMeasure = matchesMeasureCriterion(criterion);
    if (!deterministicMeasure) {
      return gradesByCriterion.get(criterion) ?? { criterion, passed: false, comment: 'Could not grade this criterion from the extracted file content.' };
    }

    if (!layoutWasExtracted) {
      return {
        criterion,
        passed: false,
        comment: 'Cannot verify -- report layout not extractable from this file.',
      };
    }

    const normalized = deterministicMeasure.toLowerCase();
    const found = normalizedMeasureNames.has(normalized) || [...normalizedFieldRefs].some(ref => ref.endsWith(`.${normalized}`));
    return found
      ? {
          criterion,
          passed: true,
          comment: `Measure '${deterministicMeasure}' confirmed in this report. DAX formula cannot be verified from binary format.`,
        }
      : {
          criterion,
          passed: false,
          comment: `Measure '${deterministicMeasure}' not found in this report. Measures extracted from this file: ${extractedMeasures}. This measure is either missing or not used in any visual.`,
        };
  });
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    executiveSummary: { type: Type.STRING },
    layers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name:     { type: Type.STRING },
          score:    { type: Type.NUMBER },
          summary:  { type: Type.STRING },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          gaps:      { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['name', 'score', 'summary', 'strengths', 'gaps'],
      },
    },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          layer:    { type: Type.STRING },
          severity: { type: Type.STRING },
          title:    { type: Type.STRING },
          detail:   { type: Type.STRING },
          fix:      { type: Type.STRING },
        },
        required: ['layer', 'severity', 'title', 'detail', 'fix'],
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
  required: ['overallScore', 'executiveSummary', 'layers', 'issues', 'topRecommendations'],
};

const SYSTEM_PROMPT = `=== RULE 1: EXTRACTED CONTENT IS YOUR ONLY SOURCE OF TRUTH ===
The content provided below is everything that could be read from this .pbix file. It is the ONLY basis for your review. You have no other information about this file.

You MUST NOT reference, mention, or critique any step name, column name, table name, measure name, relationship, or visual detail that does not appear word-for-word in the extracted content below.

If a section says "[NOT EXTRACTABLE]" or "[NO ... FILE FOUND]":
- OMIT that layer entirely from layers[] -- do not include it at all
- Raise ZERO issues for that layer
- Do not mention it anywhere in the output
- Recalculate overallScore from ONLY the layers you include, using renormalized weights:
  Full weights: DATA MODEL 30%, DAX 35%, POWER QUERY 20%, VISUALIZATIONS 15%
  Example: if only DAX and VISUALIZATIONS are extractable, overallScore = (DAX*35 + VIZ*15) / 50

=== RULE 2: CERTAINTY THRESHOLD FOR ISSUES ===
Before adding ANY item to issues[], ask yourself: "Can I point to the exact text in the extracted content that proves this problem exists?"

If yes -- include it, quoting the relevant name or code in the detail field.
If no -- omit it entirely. Do not add it as a "suggestion" or "to consider". Leave it out.

This applies to ALL severity levels. A suggestion that is not proven by extracted content is still hallucination.

NEVER raise an issue based on:
- What "typically" happens in Power BI reports
- What "best practice" recommends without seeing the specific violation
- The absence of something you cannot confirm was required (e.g., do not flag "no measures table" unless you can see from the layout that measures are scattered across data tables with no dedicated organiser)
- General advice that would apply to any report regardless of its content

=== RULE 3: TOP RECOMMENDATIONS MUST COME FROM CONFIRMED ISSUES ===
topRecommendations must only restate or prioritise items already in issues[]. Do not add any new points in topRecommendations that were not raised as a confirmed issue. If issues[] is short, topRecommendations can be equally short.

=== RULE 4: SCORING MUST REFLECT WHAT YOU CAN ACTUALLY SEE ===
- Only score layers whose content was actually extracted -- omit the rest entirely from layers[].
- If content was extracted and looks clean with no violations found, score that layer 80-90.
- Only score below 60 when you have confirmed, evidence-backed issues.
- overallScore: renormalized weighted average of ONLY included layers (DATA MODEL 30%, DAX 35%, POWER QUERY 20%, VISUALIZATIONS 15%)
- severity "error": produces wrong results or is broken -- must cite the specific formula or step
- severity "warning": works but violates a specific, observable best practice -- must cite the specific object
- severity "suggestion": correct but could use an advanced pattern -- must cite the specific object

=== RULE 5: RUBRIC GRADING ===

STEP 1 -- BUILD YOUR EVIDENCE LIST FIRST.
Before grading any rubric criterion, read the entire REPORT LAYOUT section and compile:
- Every measure name mentioned under "Fields used:" across all pages and visuals
- Every visual type and page name visible
Call this your EXTRACTED EVIDENCE LIST. This is what is actually in the student's file.

STEP 2 -- GRADE EACH CRITERION using the evidence list:

A. DAX / measure criteria (criterion format: "MeasureName = formula"):
   Extract the measure NAME (part before "="). Then:

   If the REPORT LAYOUT section was successfully extracted (it has pages and visuals):
     - Measure NAME is in your evidence list -> passed: true, comment: "Measure '[name]' confirmed in this report. DAX formula cannot be verified from binary format."
     - Measure NAME is NOT in your evidence list -> passed: false, comment: "Measure '[name]' not found in this report. Measures extracted from this file: [list every measure name you found]. This measure is either missing or not used in any visual."

   If the REPORT LAYOUT section failed to extract (no pages or visuals found):
     -> passed: false, comment: "Cannot verify -- report layout not extractable from this file."

B. Data model / relationship criteria:
   - If layout shows visuals using fields from multiple tables that match the expected schema -> passed: true with evidence.
   - If DataModel section says "[NOT EXTRACTABLE]" and layout gives no schema evidence -> passed: false, comment: "Cannot verify data model structure -- binary format."

C. Power Query criteria:
   - If M code was extracted -> verify and grade based on content.
   - If "[NOT EXTRACTABLE]" -> passed: false, comment: "Cannot verify -- M code not readable from this .pbix."

D. Visualisation criteria:
   - Grade directly from the extracted layout. Be specific about what you see vs. what was expected.

=== EXPERT KNOWLEDGE (apply only when you have evidence from the content) ===

MEASURES TABLE: Any table containing only measures and no data columns is a valid measures organiser, regardless of its name. Common names include _Measures, Key Measures, Calculations, KPIs, Metrics, etc. Do NOT flag a differently-named measures table as wrong or missing.

STAR SCHEMA: Recognise the pattern from cardinality and relationship direction in the layout -- not from table naming. Fact_ and Dim_ prefixes are not required.

DAX: DIVIDE() is correct safe division -- do not suggest /. VAR...RETURN is a best practice -- praise it. Time intelligence requires a marked date table, not one named "Date". SELECTEDVALUE and SWITCH(TRUE(),...) are advanced patterns -- reward them. Only flag a calculated column if the extracted content shows an aggregation that belongs in a measure.

POWER QUERY: Only flag step names (like "Added Custom" or "Changed Type1") if those exact step names appear in the extracted M code. Do not assume default step names exist if you cannot read the M code. Hard-coded file paths or credentials in Source steps visible in the content are errors.

VISUALISATIONS: Grade based on the extracted layout. If a reference screenshot is attached, you MUST compare -- see REFERENCE SCREENSHOT rules below.

=== REFERENCE SCREENSHOT (if image is attached) ===
The attached image is the instructor's completed reference report. You MUST actively compare the student's extracted layout against it.

Comparison checklist -- check each item and flag mismatches as issues:
1. PAGE COUNT: Does the student's report have the same number of pages as the reference?
2. CHART TYPES: Does each page use the same chart types (bar, line, pie, map, card, table, etc.)?
3. KEY MEASURES IN VISUALS: Are the same key measures visible in the student's visuals as in the reference?
4. OVERALL LAYOUT: Does the arrangement of visuals match the reference roughly?

For the VISUALIZATIONS layer score:
- If the student's layout closely matches the reference -> score 75-90
- If there are clear differences (wrong chart types, missing pages, different measures) -> score 40-65 and list the specific differences as issues
- Do NOT score visualizations highly just because the report "has charts" -- it must match the reference

For rubric criteria about visuals:
- If the criterion matches what you can verify against the reference image -> PASS/FAIL with specific evidence
- State exactly what you see in the reference vs. what the student submitted`;



export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const isPrivileged = auth.role === 'admin' || auth.role === 'instructor';
  const rateLimitError = isPrivileged ? null : await checkRateLimit(auth.userId);
  if (rateLimitError) return rateLimitError;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });

  let form: FormData;
  try { form = await req.formData(); } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file') as File | null;
  const contextStr = (form.get('context') as string | null) ?? '';
  const rubricRaw = form.get('rubric') as string | null;
  const rubric: string[] = rubricRaw ? JSON.parse(rubricRaw) : [];
  const referenceImageUrl = (form.get('referenceImageUrl') as string | null) ?? '';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pbix')) {
    return NextResponse.json({ error: 'Only .pbix files are supported.' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
  }

  const buffer = await file.arrayBuffer();
  const extractedPbix = await extractPbix(buffer);
  const rawExtracted = extractedPbix.text;

  // Hard cap: keep total extracted content under 40 000 chars to avoid Gemini timeouts
  const EXTRACTED_LIMIT = 40_000;
  const extracted = rawExtracted.length > EXTRACTED_LIMIT
    ? rawExtracted.slice(0, EXTRACTED_LIMIT) + '\n\n[Content truncated to fit review limits]'
    : rawExtracted;

  const rubricSection = rubric.length > 0
    ? `\n\nINSTRUCTOR RUBRIC - grade every criterion:\n${rubric.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : '';

  const contextSection = contextStr.trim()
    ? `\n\nBUSINESS CONTEXT: ${contextStr.trim()}`
    : '';

  const prompt = `${SYSTEM_PROMPT}${contextSection}${rubricSection}\n\n${extracted}`;

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

  // Build multimodal parts -- prepend reference image if provided
  type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
  const parts: Part[] = [];
  if (referenceImageUrl) {
    try {
      const imgRes = await fetch(referenceImageUrl);
      const imgBuf = await imgRes.arrayBuffer();
      const mimeType = imgRes.headers.get('content-type') ?? 'image/png';
      parts.push({ inlineData: { mimeType, data: Buffer.from(imgBuf).toString('base64') } });
    } catch { /* skip image if fetch fails */ }
  }
  parts.push({ text: prompt });

  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1,
      },
    });
    const parsed = JSON.parse(result.text ?? '{}');
    parsed.rubricGrades = finalizeRubricGrades(rubric, parsed.rubricGrades, extractedPbix.evidence);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('[powerbi-review]', err);
    const cause = (err as any)?.cause;
    const isReset = cause?.code === 'ECONNRESET' || err?.message?.includes('ECONNRESET');
    const isTimeout = cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || err?.message?.includes('timeout');
    if (isReset || isTimeout) {
      return NextResponse.json(
        { error: 'The AI service timed out reviewing this file. Try a smaller or less complex .pbix file.' },
        { status: 504 },
      );
    }
    return NextResponse.json({ error: err.message || 'Review failed' }, { status: 500 });
  }
}
