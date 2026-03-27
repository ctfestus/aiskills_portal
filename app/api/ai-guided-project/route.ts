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
    id:          { type: Type.STRING },
    label:       { type: Type.STRING },
    description: { type: Type.STRING },
    type:        { type: Type.STRING }, // 'task' | 'deliverable' | 'reflection'
  },
  required: ['id', 'label', 'description', 'type'],
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

REQUIREMENTS:
1. Create a fictional but realistic African company. Give it a memorable name, a believable business model, and a real data problem.
2. Write the "background" field as a hiring/onboarding brief -- written in first person from a manager welcoming the student to the team. It should feel like a real email from their new manager. Include: welcome to the team, company overview (1 paragraph), the business problem they need to solve (1 paragraph), and what their mission is (1 paragraph).
3. Include a managerName (full name, e.g. "Amara Diallo") and managerTitle (e.g. "Head of Analytics").
4. Progress through: data understanding  analysis  visualisation  storytelling/presentation.
5. Every lesson body must be rich educational HTML (~300-500 words) using <h4>, <p>, <ul>, <li>, <strong>, <blockquote> tags.
6. Requirements must be specific and actionable (e.g. "Build a pivot table in Excel showing monthly revenue by region" not "Analyse the data"). Always reference the company name and dataset in requirements.
7. Mix requirement types: 'task' (do something), 'deliverable' (produce an output), 'reflection' (write a short analysis).
8. Use descriptive IDs like "mod-1", "les-1-1", "req-1-1-1".
9. DATASET: Generate a realistic CSV dataset the student will use throughout the project.
   - 60-80 rows of realistic data with proper headers
   - Use African names, local currencies (NGN, KES, GHS, ZAR), realistic values for the industry
   - filename should reflect the company (e.g. "narapay_transactions.csv")
   - description: one sentence explaining what the dataset contains

Generate:
- 4-5 modules (each titled to reflect a project phase)
- 2-3 lessons per module
- 2-3 requirements per lesson
- A compelling tagline (one punchy sentence)
- background (HTML -- onboarding email from manager, 3 paragraphs)
- description (HTML, 1 concise paragraph summarising the project)
- managerName and managerTitle
- 5 learning outcomes (action-verb led, specific to the industry and specified tools only)
- role title, fictional company name, estimated duration, tool list (must match specified tools exactly)
- dataset (filename, description, csvContent as a string)
`;

      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
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
              modules:       { type: Type.ARRAY, items: moduleSchema },
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
            required: ['tagline', 'role', 'company', 'managerName', 'managerTitle', 'duration', 'tools', 'description', 'background', 'learnOutcomes', 'modules', 'dataset'],
          },
        },
      });

      const generated = JSON.parse(res.text!);
      return NextResponse.json({
        config: {
          isGuidedProject: true,
          industry,
          difficulty,
          coverImage: '',
          ...generated,
        },
      });
    }

    // -- AI improvement suggestions ---
    if (action === 'improve') {
      const instruction    = clamp(body.instruction, 500);
      const currentConfig  = body.currentConfig as Record<string, any>;
      const targetModuleId = body.moduleId ? clamp(body.moduleId, 50) : null;

      if (!instruction) return NextResponse.json({ error: 'instruction is required' }, { status: 400 });

      // Build a compact summary of the current project for context
      const projectSummary = JSON.stringify({
        title:    currentConfig?.title || '',
        industry: currentConfig?.industry || '',
        modules:  (currentConfig?.modules || []).map((m: any) => ({
          id: m.id, title: m.title,
          lessons: (m.lessons || []).map((l: any) => ({
            id: l.id, title: l.title,
            requirementCount: (l.requirements || []).length,
          })),
        })),
      });

      const scopeNote = targetModuleId
        ? `Focus changes on module with id "${targetModuleId}".`
        : 'You may suggest changes across any part of the project.';

      const improvePrompt = `
You are an expert instructional designer reviewing a guided data project.

Current project structure:
${projectSummary}

Instructor instruction: "${instruction}"

${scopeNote}

Return a list of concrete suggestions. Each suggestion must have:
- type: one of 'add_lesson', 'modify_lesson', 'remove_lesson', 'add_requirement', 'modify_requirement', 'general'
- description: a clear 1-2 sentence explanation of the change
- moduleId: (if applicable) the module id to apply this to
- lessonId: (if applicable) the lesson id to apply this to
- For 'add_lesson': include a 'lesson' object with the full new lesson (id, title, body HTML, requirements array)
- For 'modify_lesson': include a 'lesson' object with updated title and body
- For 'add_requirement': include a 'requirement' object (id, label, description, type)
`;

      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: improvePrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type:        { type: Type.STRING },
                    description: { type: Type.STRING },
                    moduleId:    { type: Type.STRING },
                    lessonId:    { type: Type.STRING },
                    lesson:      lessonSchema,
                    requirement: requirementSchema,
                  },
                  required: ['type', 'description'],
                },
              },
            },
            required: ['suggestions'],
          },
        },
      });

      const result = JSON.parse(res.text!);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (err: any) {
    console.error('[ai-guided-project]', err);
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}
