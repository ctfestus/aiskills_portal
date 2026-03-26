import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_MODEL } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const trimmedPrompt = prompt?.trim() ?? '';
  if (!trimmedPrompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
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
