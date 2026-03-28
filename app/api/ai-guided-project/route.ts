import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_MODEL } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenAI({ apiKey });
};

const clamp = (val: unknown, max: number): string => String(val ?? '').slice(0, max);

const INDUSTRY_CONTEXT: Record<string, string> = {
  fintech:    'payments, digital lending, fraud detection, customer churn, mobile money, transaction analytics',
  marketing:  'campaign attribution, funnel analysis, customer segmentation, A/B testing, brand performance, social media ROI',
  hr:         'employee attrition, workforce planning, recruitment analytics, DEI reporting, performance management, people analytics',
  finance:    'budget variance analysis, FP&A dashboards, cash flow forecasting, P&L reporting, financial modelling, cost optimisation',
  edtech:     'learner engagement, course completion rates, cohort analysis, assessment performance, dropout prediction, learning outcomes',
  healthcare: 'patient outcomes, hospital operations, clinical trial data, appointment no-shows, resource utilisation, health equity',
  ecommerce:  'sales performance, basket analysis, customer lifetime value, inventory optimisation, returns analysis, conversion funnels',
  consulting: 'client performance benchmarking, market sizing, operational efficiency, KPI dashboards, strategic recommendations',
};

const INDUSTRY_TOOLS: Record<string, string[]> = {
  fintech:    ['SQL', 'Python', 'Power BI', 'Excel'],
  marketing:  ['Google Analytics', 'Python', 'Tableau', 'Excel'],
  hr:         ['Excel', 'Python', 'Power BI', 'SQL'],
  finance:    ['Excel', 'SQL', 'Power BI', 'Python'],
  edtech:     ['SQL', 'Python', 'Tableau', 'Excel'],
  healthcare: ['SQL', 'Python', 'Power BI', 'Excel'],
  ecommerce:  ['SQL', 'Python', 'Tableau', 'Google Analytics'],
  consulting: ['Excel', 'PowerPoint', 'Power BI', 'SQL'],
};

// Requirement schema reused in both generate and improve
const requirementSchema = {
  type: Type.OBJECT,
  properties: {
    id:            { type: Type.STRING },
    label:         { type: Type.STRING },   // The question
    description:   { type: Type.STRING },   // Which column(s)/filter to use
    type:          { type: Type.STRING },   // 'mcq'
    options:       { type: Type.ARRAY, items: { type: Type.STRING } }, // exactly 4 options
    correctAnswer: { type: Type.STRING },   // must match one option exactly
  },
  required: ['id', 'label', 'description', 'type', 'options', 'correctAnswer'],
};

const lessonSchema = {
  type: Type.OBJECT,
  properties: {
    id:           { type: Type.STRING },
    title:        { type: Type.STRING },
    body:         { type: Type.STRING }, // Rich HTML
    videoUrl:     { type: Type.STRING },
    requirements: { type: Type.ARRAY, items: requirementSchema },
  },
  required: ['id', 'title', 'body', 'requirements'],
};

const moduleSchema = {
  type: Type.OBJECT,
  properties: {
    id:          { type: Type.STRING },
    title:       { type: Type.STRING },
    description: { type: Type.STRING },
    lessons:     { type: Type.ARRAY, items: lessonSchema },
  },
  required: ['id', 'title', 'description', 'lessons'],
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  try {
    const ai = getAI();

    // -- Generate full project ---
    if (action === 'generate') {
      const industry   = clamp(body.industry, 50) || 'fintech';
      const difficulty = clamp(body.difficulty, 20) || 'intermediate';
      const roleHint   = clamp(body.role, 100);
      const focusTopic = clamp(body.focusTopic, 200);
      const toolsRaw   = clamp(body.tools, 300);
      const context    = INDUSTRY_CONTEXT[industry] || industry;

      // Use instructor-specified tools if provided, otherwise fall back to industry defaults
      const specifiedTools = toolsRaw
        ? toolsRaw.split(',').map((t: string) => t.trim()).filter(Boolean)
        : INDUSTRY_TOOLS[industry] || ['SQL', 'Python', 'Excel'];
      const toolsList = specifiedTools.join(', ');

      const rolePhrase  = roleHint || 'Data Analyst';
      const focusPhrase = focusTopic ? `\nFOCUS AREA: ${focusTopic}` : '';
      const toolsEnforcement = toolsRaw
        ? `\nCRITICAL -- TOOLS CONSTRAINT: You MUST use ONLY these tools: ${toolsList}. Do NOT mention, reference, or suggest any other tool anywhere in the project -- not in lesson bodies, requirements, outcomes, or the tools list. Every task and deliverable must be completable using only: ${toolsList}.`
        : `\nTools to use: ${toolsList}`;

      const prompt = `
You are designing a hands-on virtual work experience project (like Forage) for a ${difficulty}-level ${rolePhrase} in the ${industry} industry.

INDUSTRY CONTEXT: ${context}${focusPhrase}${toolsEnforcement}

== CONTENT RULES ==

COMPANY & BACKGROUND:
- Create a fictional but realistic African company with a memorable name and a real data problem.
- "background" field: EXACTLY 2-3 short sentences. No email format. No "Dear", no "Welcome". State directly: (1) what company they've joined and their role, (2) what the company does and the specific problem it faces (include a real number, e.g. "losing 12% revenue to fraud"), (3) what the student must deliver. Professional, direct, factual. Plain HTML with <p> tags only.
- Include managerName (e.g. "Amara Diallo") and managerTitle (e.g. "Head of Analytics").

LESSON BODIES:
- Each lesson body: 2-3 sentences max (50-80 words). Plain <p> tags only. No lists, no headings.
- Tell the student exactly what data to look at and what specific question to answer. Write like a concise Slack message from a manager.
- Example: "<p>Open the dataset and filter transactions to the last 90 days. Calculate total revenue by region and identify which two regions account for more than 60% of sales. You'll use this to answer the questions below.</p>"

DATASET:
- Generate a realistic CSV dataset (60-80 rows) with proper column headers.
- Use African names, local currencies (NGN, KES, GHS, ZAR), realistic values.
- The data must contain specific, calculable values (real numbers students can verify).
- filename reflects the company (e.g. "narapay_transactions.csv").

REQUIREMENTS (MULTIPLE CHOICE QUESTIONS):
- ALL requirements must be type "mcq".
- Each is a data analysis question students can ONLY answer by examining the dataset.
- label: a specific, direct question referencing a column name or metric from the dataset (e.g. "Which region had the highest total transaction value in March?").
- description: one sentence telling them exactly which column(s) to analyse (e.g. "Filter by month='March', group by region, sum the 'amount' column.").
- options: exactly 4 plausible options. Use real values from the CSV (e.g. ["Lagos -- ₦4.2M", "Abuja -- ₦6.8M", "Kano -- ₦3.1M", "Port Harcourt -- ₦5.5M"]).
- correctAnswer: must match one of the options EXACTLY and be derivable from the CSV data you generate.
- Questions must progress in difficulty: early lessons = simple (filter/sum), later lessons = harder (correlation, % change, outlier detection).
- NEVER ask questions answerable from general knowledge -- always tie to specific columns and values in the dataset.

IDs: use "mod-1", "les-1-1", "req-1-1-1" format.

Generate:
- 3-4 modules (each a project phase: data exploration  analysis  visualisation  insights)
- 2-3 lessons per module
- 3 mcq requirements per lesson (tied to the dataset)
- tagline: one punchy sentence
- background: 2-3 direct sentences (HTML <p>)
- description: 1 sentence summary (HTML <p>)
- managerName, managerTitle
- 5 learning outcomes (action-verb led, tools-specific)
- role, company, duration, tools (must match: ${toolsList})
- dataset (filename, description, csvContent)
`;

      // -- Pass 1: company + dataset ---
      const pass1Prompt = `
You are generating a virtual work experience project for a ${difficulty}-level ${rolePhrase} in the ${industry} industry.
${toolsEnforcement}

Create a fictional but realistic African company and a dataset the student will analyse.

COMPANY:
- name: memorable fictional African company
- role: job title (e.g. "Data Analyst")
- tagline: one punchy sentence about the project
- background: EXACTLY 2-3 sentences (HTML <p> only). State: who they joined and as what, the company's core business + a specific real-sounding problem with a number, and their mission/deliverable. No email format.
- description: 1 sentence (HTML <p>) summarising the project
- managerName: e.g. "Amara Diallo", managerTitle: e.g. "Head of Analytics"
- duration: e.g. "4-6 hours"
- tools: ONLY [${toolsList}]
- learnOutcomes: 5 action-verb outcomes tied to these tools only

DATASET (generate this first, carefully):
- 60-80 rows, realistic data, African names, local currencies (NGN/KES/GHS/ZAR)
- Include columns relevant to ${industry}: dates, categories, amounts, statuses, regions
- Use consistent, realistic values -- real numbers that can be summed, averaged, compared
- filename: reflects company (e.g. "narapay_transactions.csv")
- description: one sentence
- csvContent: the full CSV as a string
`;

      const pass1Res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: pass1Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tagline:       { type: Type.STRING },
              role:          { type: Type.STRING },
              company:       { type: Type.STRING },
              managerName:   { type: Type.STRING },
              managerTitle:  { type: Type.STRING },
              duration:      { type: Type.STRING },
              tools:         { type: Type.ARRAY, items: { type: Type.STRING } },
              description:   { type: Type.STRING },
              background:    { type: Type.STRING },
              learnOutcomes: { type: Type.ARRAY, items: { type: Type.STRING } },
              dataset: {
                type: Type.OBJECT,
                properties: {
                  filename:    { type: Type.STRING },
                  description: { type: Type.STRING },
                  csvContent:  { type: Type.STRING },
                },
                required: ['filename', 'description', 'csvContent'],
              },
            },
            required: ['tagline', 'role', 'company', 'managerName', 'managerTitle', 'duration', 'tools', 'description', 'background', 'learnOutcomes', 'dataset'],
          },
        },
      });

      const pass1 = JSON.parse(pass1Res.text!);
      const csvContent = pass1.dataset?.csvContent || '';

      // -- Pass 2: modules/lessons/MCQ questions (CSV provided) ---
      const pass2Prompt = `
You are generating modules and MCQ questions for a virtual work experience project.

COMPANY: ${pass1.company} | ROLE: ${pass1.role} | INDUSTRY: ${industry} | TOOLS: ${toolsList}

HERE IS THE EXACT DATASET THE STUDENT WILL USE:
\`\`\`csv
${csvContent}
\`\`\`

Generate 3-4 modules progressing through: data exploration  analysis  visualisation  insights.
Each module: 2-3 lessons. Each lesson: exactly 3 MCQ questions.

LESSON BODY RULES:
- 2-3 sentences max (50-80 words). Plain <p> tags only.
- Tell them exactly which columns/rows to look at and what to calculate.
- Example: "<p>Open ${pass1.dataset?.filename || 'the dataset'} and filter to rows where status = 'Completed'. Group by region and sum the amount column. Use this to answer the questions below.</p>"

MCQ QUESTION RULES (CRITICAL):
- EVERY question must be answerable ONLY by analysing the dataset above.
- Before writing options, ACTUALLY CALCULATE the answer from the CSV data provided.
- label: specific question referencing exact column names from the CSV.
- description: one sentence -- which columns to filter/group/sum (e.g. "Filter by region='Lagos', sum the 'amount' column.").
- options: exactly 4 plausible choices. Use real values from the CSV as options. Wrong options should be plausible (e.g. other regions' actual totals, not made-up numbers).
- correctAnswer: must match one of the 4 options EXACTLY. This answer MUST be correct based on the CSV data above.
- DO NOT guess. Calculate from the data.

IDs: "mod-1", "les-1-1", "req-1-1-1".
Requirement type: always "mcq".
`;

      const pass2Res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: pass2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              modules: { type: Type.ARRAY, items: moduleSchema },
            },
            required: ['modules'],
          },
        },
      });

      const pass2 = JSON.parse(pass2Res.text!);
      return NextResponse.json({
        config: {
          isGuidedProject: true,
          industry,
          difficulty,
          coverImage: '',
          ...pass1,
          modules: pass2.modules,
        },
      });
    }

    // -- Generate from instructor-provided dataset ---
    if (action === 'generate-from-data') {
      const industry   = clamp(body.industry, 50) || 'fintech';
      const difficulty = clamp(body.difficulty, 20) || 'intermediate';
      const roleHint   = clamp(body.role, 100);
      const focusTopic = clamp(body.focusTopic, 200);
      const toolsRaw   = clamp(body.tools, 300);
      const csvContent = String(body.csvContent || '').slice(0, 40000); // cap at ~40k chars
      const filename   = clamp(body.filename, 100) || 'dataset.csv';
      const context    = INDUSTRY_CONTEXT[industry] || industry;

      if (!csvContent.trim()) return NextResponse.json({ error: 'csvContent is required' }, { status: 400 });

      const specifiedTools = toolsRaw
        ? toolsRaw.split(',').map((t: string) => t.trim()).filter(Boolean)
        : INDUSTRY_TOOLS[industry] || ['SQL', 'Python', 'Excel'];
      const toolsList = specifiedTools.join(', ');
      const rolePhrase  = roleHint || 'Data Analyst';
      const focusPhrase = focusTopic ? `\nFOCUS AREA: ${focusTopic}` : '';
      const toolsEnforcement = toolsRaw
        ? `\nCRITICAL -- TOOLS CONSTRAINT: You MUST use ONLY these tools: ${toolsList}. Do NOT mention any other tool.`
        : `\nTools to use: ${toolsList}`;

      // Pass 1: company metadata only (no dataset generation -- use the provided one)
      const pass1Prompt = `
You are generating a virtual work experience project for a ${difficulty}-level ${rolePhrase} in the ${industry} industry.
INDUSTRY CONTEXT: ${context}${focusPhrase}${toolsEnforcement}

The instructor has provided a real dataset (see below). Create a fictional but realistic African company whose business problem is reflected in this data.

DATASET PROVIDED:
\`\`\`csv
${csvContent.split('\n').slice(0, 5).join('\n')}
… (${csvContent.trim().split('\n').length} rows total)
\`\`\`

COMPANY:
- name: memorable fictional African company
- role: job title (e.g. "${rolePhrase}")
- tagline: one punchy sentence about the project
- background: EXACTLY 2-3 sentences (HTML <p> only). State: who they joined and as what, the company's core business + a specific real-sounding problem with a number, and their mission/deliverable. No email format.
- description: 1 sentence (HTML <p>) summarising the project
- managerName: e.g. "Amara Diallo", managerTitle: e.g. "Head of Analytics"
- duration: e.g. "4-6 hours"
- tools: ONLY [${toolsList}]
- learnOutcomes: 5 action-verb outcomes tied to these tools only
`;

      const pass1Res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: pass1Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tagline:       { type: Type.STRING },
              role:          { type: Type.STRING },
              company:       { type: Type.STRING },
              managerName:   { type: Type.STRING },
              managerTitle:  { type: Type.STRING },
              duration:      { type: Type.STRING },
              tools:         { type: Type.ARRAY, items: { type: Type.STRING } },
              description:   { type: Type.STRING },
              background:    { type: Type.STRING },
              learnOutcomes: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['tagline', 'role', 'company', 'managerName', 'managerTitle', 'duration', 'tools', 'description', 'background', 'learnOutcomes'],
          },
        },
      });

      const pass1 = JSON.parse(pass1Res.text!);

      // Pass 2: modules/lessons/MCQ -- using the full instructor dataset
      const pass2Prompt = `
You are generating modules and MCQ questions for a virtual work experience project.

COMPANY: ${pass1.company} | ROLE: ${pass1.role} | INDUSTRY: ${industry} | TOOLS: ${toolsList}

HERE IS THE EXACT DATASET THE STUDENT WILL USE:
\`\`\`csv
${csvContent}
\`\`\`

Generate 3-4 modules progressing through: data exploration  analysis  visualisation  insights.
Each module: 2-3 lessons. Each lesson: exactly 3 MCQ questions.

LESSON BODY RULES:
- 2-3 sentences max (50-80 words). Plain <p> tags only.
- Tell them exactly which columns/rows to look at and what to calculate.

MCQ QUESTION RULES (CRITICAL):
- EVERY question must be answerable ONLY by analysing the dataset above.
- Before writing options, ACTUALLY CALCULATE the answer from the CSV data provided.
- label: specific question referencing exact column names from the CSV.
- description: one sentence -- which columns to filter/group/sum.
- options: exactly 4 plausible choices using real values from the CSV.
- correctAnswer: must match one of the 4 options EXACTLY and be correct based on the data.
- DO NOT guess. Calculate from the data.

IDs: "mod-1", "les-1-1", "req-1-1-1".
Requirement type: always "mcq".
`;

      const pass2Res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: pass2Prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              modules: { type: Type.ARRAY, items: moduleSchema },
            },
            required: ['modules'],
          },
        },
      });

      const pass2 = JSON.parse(pass2Res.text!);
      return NextResponse.json({
        config: {
          isGuidedProject: true,
          industry,
          difficulty,
          coverImage: '',
          ...pass1,
          modules: pass2.modules,
          dataset: { filename, description: `Instructor-provided dataset (${csvContent.trim().split('\n').length} rows)`, csvContent },
        },
      });
    }

    // -- AI improve: apply instruction directly to config ---
    if (action === 'improve') {
      const instruction   = clamp(body.instruction, 500);
      const currentConfig = body.currentConfig as Record<string, any>;

      if (!instruction) return NextResponse.json({ error: 'instruction is required' }, { status: 400 });

      // Compact the config -- keep IDs and content but strip large fields for token efficiency
      const compact = {
        company:      currentConfig.company,
        role:         currentConfig.role,
        industry:     currentConfig.industry,
        difficulty:   currentConfig.difficulty,
        tagline:      currentConfig.tagline,
        background:   currentConfig.background,
        description:  currentConfig.description,
        learnOutcomes: currentConfig.learnOutcomes,
        tools:        currentConfig.tools,
        modules: (currentConfig.modules || []).map((m: any) => ({
          id: m.id, title: m.title, description: m.description,
          lessons: (m.lessons || []).map((l: any) => ({
            id: l.id, title: l.title, body: l.body, videoUrl: l.videoUrl,
            requirements: (l.requirements || []).map((r: any) => ({
              id: r.id, label: r.label, description: r.description,
              type: r.type, options: r.options, correctAnswer: r.correctAnswer,
            })),
          })),
        })),
      };

      const applyPrompt = `
You are editing a guided work experience project. Apply the instructor's instruction to the project and return the COMPLETE updated project config.

CURRENT CONFIG:
${JSON.stringify(compact, null, 2)}

INSTRUCTOR INSTRUCTION: "${instruction}"

RULES:
- Only change what the instruction asks. Leave everything else exactly as-is (same IDs, same content).
- If adding a new lesson or requirement, generate a new unique ID (e.g. "les-new-1", "req-new-1").
- Keep all requirement types as "mcq" unless the instruction explicitly says otherwise.
- Keep lesson bodies concise (2-3 sentences, plain <p> tags).
- Return the COMPLETE modules array with ALL existing modules and lessons included.
`;

      const applyRes = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: applyPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tagline:       { type: Type.STRING },
              background:    { type: Type.STRING },
              description:   { type: Type.STRING },
              learnOutcomes: { type: Type.ARRAY, items: { type: Type.STRING } },
              modules:       { type: Type.ARRAY, items: moduleSchema },
            },
            required: ['modules'],
          },
        },
      });

      const applied = JSON.parse(applyRes.text!);
      // Merge: applied fields override, but preserve fields not in response (dataset, coverImage, etc.)
      return NextResponse.json({
        config: {
          ...currentConfig,
          ...applied,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err: any) {
    console.error('[ai-guided-project]', err);
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}
