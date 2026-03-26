import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_MODEL } from '@/lib/ai';
import { adminClient, getCreatorLimits } from '@/lib/subscription';

const GEN_MAX_REQUESTS = 10;
const GEN_WINDOW_MS   = 60_000;


export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const { data: { user }, error: authError } = await adminClient().auth.getUser(jwt);
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;

  // Block free plan from AI generation
  const limits = await getCreatorLimits(jwt);
  if (limits.aiGenerations === 0) {
    return NextResponse.json(
      { error: 'AI generation is not available on the free plan. Upgrade to Pro.' },
      { status: 403 }
    );
  }

  // Atomic DB-backed rate limit — survives serverless cold starts and concurrent requests.
  // Uses a single upsert RPC so check + increment happen in one PostgreSQL statement.
  const { data: allowed, error: rlError } = await adminClient().rpc('check_ai_rate_limit', {
    p_user_id:   userId,
    p_max:       GEN_MAX_REQUESTS,
    p_window_ms: GEN_WINDOW_MS,
  });
  if (rlError) {
    console.error('[generate] rate limit check failed:', rlError.message);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const { prompt } = await req.json();

  const trimmedPrompt = prompt?.trim() ?? '';
  if (!trimmedPrompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }
  if (trimmedPrompt.length > 500) {
    return NextResponse.json({ error: 'Prompt must be 500 characters or fewer' }, { status: 400 });
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
          title: { type: Type.STRING, description: "Form or Course title" },
          description: { type: Type.STRING, description: "Form or Course description" },
          isCourse: { type: Type.BOOLEAN, description: "True if the user requested a course" },
          eventDetails: {
            type: Type.OBJECT,
            description: "If the form is for an event (live or online), provide these details. Omit if not an event.",
            properties: {
              isEvent: { type: Type.BOOLEAN, description: "True if this form is for an event" },
              date: { type: Type.STRING, description: "Date of the event (e.g., 'October 15, 2026')" },
              time: { type: Type.STRING, description: "Time of the event (e.g., '10:00 AM')" },
              location: { type: Type.STRING, description: "Physical location or online link" },
              timezone: { type: Type.STRING, description: "Timezone of the event (e.g., 'PST', 'UTC')" }
            },
            required: ["isEvent"]
          },
          fields: {
            type: Type.ARRAY,
            description: "Fields for a regular form. Provide this if isCourse is false.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Unique random string ID" },
                name: { type: Type.STRING, description: "camelCase identifier" },
                label: { type: Type.STRING, description: "Human readable label" },
                type: { type: Type.STRING, description: "Must be one of: text, email, textarea, number, select" },
                placeholder: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Only provide if type is select" }
              },
              required: ["id", "name", "label", "type"]
            }
          },
          questions: {
            type: Type.ARRAY,
            description: "Questions for a quiz. Provide this if isCourse is true.",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "Unique random string ID" },
                question: { type: Type.STRING, description: "The quiz question text" },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of possible answers (usually 4)" },
                correctAnswer: { type: Type.STRING, description: "The correct answer (must match one of the options exactly)" },
                explanation: { type: Type.STRING, description: "Optional explanation of why the answer is correct" }
              },
              required: ["id", "question", "options", "correctAnswer"]
            }
          }
        },
        required: ["title", "description"]
      }
    }
  });

  // Strip markdown code fences in case the model wraps output despite responseMimeType
  const raw = response.text!.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return NextResponse.json(JSON.parse(raw));
  } catch (error: any) {
    console.error('Gemini error:', error);
    return NextResponse.json({ error: error?.message ?? 'Generation failed' }, { status: 500 });
  }
}
