import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_MODEL } from '@/lib/ai';
import { adminClient } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

// -- Rate limiting ---
// 20 AI generations per user per hour. In-memory; resets on deploy.
const rateLimit = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

const MAX_PROMPT_LENGTH = 500;

export async function POST(req: NextRequest) {
  // -- Auth ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const { data: { user }, error: authError } = await adminClient().auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // -- Rate limit ---
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Max 20 generations per hour.' }, { status: 429 });
  }

  // -- Parse & validate body ---
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const trimmedPrompt: string = body?.prompt?.trim() ?? '';
  if (!trimmedPrompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }
  if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or fewer` },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Generate a form or course schema for the following use case: "${trimmedPrompt}". Make sure to include all necessary fields, a catchy title, and a brief description. If the user asks for a course, set isCourse to true and populate the questions array with multiple-choice questions.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Form or Course title' },
            description: { type: Type.STRING, description: 'Form or Course description' },
            isCourse: { type: Type.BOOLEAN, description: 'True if the user requested a course' },
            eventDetails: {
              type: Type.OBJECT,
              description: 'If the form is for an event (live or online), provide these details. Omit if not an event.',
              properties: {
                isEvent: { type: Type.BOOLEAN, description: 'True if this form is for an event' },
                date: { type: Type.STRING, description: "Date of the event (e.g., 'October 15, 2026')" },
                time: { type: Type.STRING, description: "Time of the event (e.g., '10:00 AM')" },
                location: { type: Type.STRING, description: 'Physical location or online link' },
                timezone: { type: Type.STRING, description: "Timezone of the event (e.g., 'PST', 'UTC')" },
              },
              required: ['isEvent'],
            },
            fields: {
              type: Type.ARRAY,
              description: 'Fields for a regular form. Provide this if isCourse is false.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Unique random string ID' },
                  name: { type: Type.STRING, description: 'camelCase identifier' },
                  label: { type: Type.STRING, description: 'Human readable label' },
                  type: { type: Type.STRING, description: 'Must be one of: text, email, textarea, number, select' },
                  placeholder: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Only provide if type is select' },
                },
                required: ['id', 'name', 'label', 'type'],
              },
            },
            questions: {
              type: Type.ARRAY,
              description: 'Questions for a quiz. Provide this if isCourse is true.',
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: 'Unique random string ID' },
                  question: { type: Type.STRING, description: 'The quiz question text' },
                  options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of possible answers (usually 4)' },
                  correctAnswer: { type: Type.STRING, description: 'The correct answer (must match one of the options exactly)' },
                  explanation: { type: Type.STRING, description: 'Optional explanation of why the answer is correct' },
                },
                required: ['id', 'question', 'options', 'correctAnswer'],
              },
            },
          },
          required: ['title', 'description'],
        },
      },
    });

    // Strip markdown code fences in case the model wraps output despite responseMimeType
    const raw = response.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return NextResponse.json(JSON.parse(raw));
  } catch (error: any) {
    console.error('Gemini error:', error);
    return NextResponse.json({ error: error?.message ?? 'Generation failed' }, { status: 500 });
  }
}
