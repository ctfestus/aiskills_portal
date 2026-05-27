import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

// All model names come from env -- no hardcoding
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

function geminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  return new GoogleGenAI({ apiKey });
}

function openaiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

const safeJSON = (text: string) =>
  JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());

function isRetryableGeminiError(err: unknown) {
  const error = err as { message?: string; cause?: { code?: string; errno?: number; message?: string } };
  const message = String(error?.message ?? '').toLowerCase();
  const causeMessage = String(error?.cause?.message ?? '').toLowerCase();
  const code = String(error?.cause?.code ?? '');
  return (
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    causeMessage.includes('econnreset') ||
    code === 'ECONNRESET'
  );
}

async function generateGeminiJSON(
  prompt: string,
  geminiSchema?: any,
  opts: { temperature?: number; geminiRetries?: number } = {},
) {
  const retries = Math.max(0, opts.geminiRetries ?? 1);
  const config: any = { responseMimeType: 'application/json' };
  if (geminiSchema) config.responseSchema = geminiSchema;
  if (opts.temperature !== undefined) config.temperature = opts.temperature;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await geminiClient().models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config,
      });
      return safeJSON(result.text ?? '{}');
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !isRetryableGeminiError(err)) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError;
}

// ---- 1. Text JSON (primary: Gemini, fallback: OpenAI) ----
export async function generateJSON(
  prompt: string,
  geminiSchema?: any,
  opts: { temperature?: number; geminiRetries?: number } = {},
): Promise<any> {
  try {
    return await generateGeminiJSON(prompt, geminiSchema, opts);
  } catch (err) {
    const client = openaiClient();
    if (!client) {
      console.warn('[AI] Gemini failed and no OpenAI fallback is configured:', (err as Error).message);
      throw err;
    }
    console.warn('[AI] Gemini failed, falling back to OpenAI:', (err as Error).message);
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    });
    return safeJSON(res.choices[0]?.message?.content ?? '{}');
  }
}

// ---- 2. Vision + Text JSON (primary: Gemini, fallback: OpenAI) ----
export async function generateVisionJSON(
  prompt: string,
  image: { data: string; mimeType: string },
  geminiSchema?: any,
  opts: { temperature?: number } = {},
): Promise<any> {
  try {
    const config: any = { responseMimeType: 'application/json' };
    if (geminiSchema) config.responseSchema = geminiSchema;
    if (opts.temperature !== undefined) config.temperature = opts.temperature;

    const result = await geminiClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }],
      config,
    });
    return safeJSON(result.text ?? '{}');
  } catch (err) {
    console.warn('[AI] Gemini vision failed, falling back to OpenAI:', (err as Error).message);
    const client = openaiClient();
    if (!client) throw err;
    if (!image.mimeType.startsWith('image/')) {
      throw new Error(`OpenAI vision fallback does not support ${image.mimeType}. Binary document types require Gemini.`);
    }
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
        ],
      }],
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    });
    return safeJSON(res.choices[0]?.message?.content ?? '{}');
  }
}

// ---- 3. Text Streaming JSON (primary: Gemini, fallback: OpenAI) ----
export async function generateStream(
  prompt: string,
  geminiSchema?: any,
): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  try {
    const config: any = { responseMimeType: 'application/json' };
    if (geminiSchema) config.responseSchema = geminiSchema;

    const geminiStream = await geminiClient().models.generateContentStream({
      model: GEMINI_MODEL,
      contents: prompt,
      config,
    });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of geminiStream) {
            const text = chunk.text;
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch {
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'Generation failed. Please try again.' })));
        } finally {
          controller.close();
        }
      },
    });
  } catch (err) {
    console.warn('[AI] Gemini stream failed, falling back to OpenAI:', (err as Error).message);
    const client = openaiClient();
    if (!client) {
      const message = (err as Error).message;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: message })));
          controller.close();
        },
      });
    }
    const stream = await client.chat.completions.create({
      model: OPENAI_MODEL,
      stream: true,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch {
          controller.enqueue(encoder.encode(JSON.stringify({ error: 'Generation failed. Please try again.' })));
        } finally {
          controller.close();
        }
      },
    });
  }
}
