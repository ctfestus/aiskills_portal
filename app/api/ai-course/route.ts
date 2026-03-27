import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { GEMINI_MODEL } from '@/lib/ai';

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('API key not configured');
  return new GoogleGenAI({ apiKey });
};

const parse = (text: string) => {
  const raw = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(raw);
};

const getYouTubeApiKey = () => process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '';

const buildYouTubeUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

const PREFERRED_CHANNELS = [
  'Google',
  'Microsoft',
  'TEDx Talks',
  'TED',
  'Alex The Analyst',
  'Maven Analytics',
  'freeCodeCamp.org',
  'Khan Academy',
  'CrashCourse',
  'Fireship',
  'Programming with Mosh',
  'Traversy Media',
  'Google Developers',
  'Microsoft Developer',
  'DeepLearningAI',
  'StatQuest with Josh Starmer',
];

const OFFICIAL_CHANNEL_KEYWORDS = [
  'google',
  'microsoft',
  'ted',
  'tedx',
  'google developers',
  'microsoft developer',
];

const CLICKBAIT_PATTERNS = [
  'shocking',
  'insane',
  'crazy',
  'unbelievable',
  'secret',
  'secrets',
  'must watch',
  'won't believe',
  'you wont believe',
  'guaranteed',
  'click here',
  'thumbnail',
];

const TUTORIAL_PATTERNS = [
  'tutorial',
  'course',
  'explained',
  'lesson',
  'guide',
  'walkthrough',
  'training',
  'bootcamp',
  'for beginners',
  'step by step',
  'learn',
];

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const containsAny = (text: string, patterns: string[]) =>
  patterns.some(pattern => text.includes(pattern));

async function findLessonVideo(query: string): Promise<string | null> {
  const apiKey = getYouTubeApiKey();
  if (!apiKey || !query.trim()) return null;

  const searchParams = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '12',
    order: 'rating',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    relevanceLanguage: 'en',
  });

  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`, {
    cache: 'no-store',
  });

  if (!searchRes.ok) {
    const text = await searchRes.text().catch(() => '');
    throw new Error(text || 'YouTube search failed');
  }

  const searchJson = await searchRes.json();
  const videoIds = (searchJson.items || [])
    .map((item: any) => item?.id?.videoId)
    .filter(Boolean)
    .slice(0, 8);

  if (!videoIds.length) return null;

  const detailsParams = new URLSearchParams({
    key: apiKey,
    part: 'snippet,statistics,contentDetails,status',
    id: videoIds.join(','),
  });

  const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`, {
    cache: 'no-store',
  });

  if (!detailsRes.ok) {
    const text = await detailsRes.text().catch(() => '');
    throw new Error(text || 'YouTube video lookup failed');
  }

  const detailsJson = await detailsRes.json();
  const scored = (detailsJson.items || [])
    .filter((item: any) => item?.status?.embeddable !== false)
    .map((item: any) => {
      const stats = item.statistics || {};
      const snippet = item.snippet || {};
      const viewCount = toNumber(stats.viewCount);
      const likeCount = toNumber(stats.likeCount);
      const commentCount = toNumber(stats.commentCount);
      const engagement = viewCount > 0 ? (likeCount * 5 + commentCount * 2) / viewCount : 0;
      const channelTitle = String(snippet.channelTitle || '').toLowerCase();
      const title = String(snippet.title || '').toLowerCase();
      const description = String(snippet.description || '').toLowerCase();
      const combinedText = `${title} ${description}`;
      const preferredBoost = PREFERRED_CHANNELS.reduce((score, channel) => {
        const name = channel.toLowerCase();
        if (channelTitle === name) return score + 200;
        if (channelTitle.includes(name)) return score + 120;
        return score;
      }, 0);
      const officialBoost = containsAny(channelTitle, OFFICIAL_CHANNEL_KEYWORDS) ? 80 : 0;
      const tutorialBoost = containsAny(combinedText, TUTORIAL_PATTERNS) ? 45 : 0;
      const clickbaitPenalty = containsAny(combinedText, CLICKBAIT_PATTERNS) ? 80 : 0;
      const shortPenalty = viewCount < 5_000 ? 18 : 0;
      const topCreatorBoost =
        viewCount >= 1_000_000 ? 35 :
        viewCount >= 250_000 ? 18 :
        viewCount >= 100_000 ? 10 : 0;
      const score =
        preferredBoost +
        officialBoost +
        tutorialBoost +
        topCreatorBoost +
        engagement * 1000 +
        Math.log10(viewCount + 1) * 10 -
        clickbaitPenalty -
        shortPenalty;
      return { id: item.id as string, score };
    })
    .sort((a: any, b: any) => b.score - a.score);

  return scored[0]?.id ? buildYouTubeUrl(scored[0].id) : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // Input length guards -- limit injection surface on user-controlled strings
  const clamp = (val: unknown, max: number): string => String(val ?? '').slice(0, max);

  try {
    const ai = getAI();

    // -- Generate a batch of questions from a topic ---
    if (action === 'generate_questions') {
      const topic = clamp(body.topic, 200);
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);
      const type = clamp(body.type, 30) || 'multiple_choice';
      const customPrompt = clamp(body.customPrompt, 800);
      const customInstruction = customPrompt ? ` Additional instructions: ${customPrompt}` : '';
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Generate ${count} course quiz questions about: "${topic}". Question type: ${type}. For multiple_choice, provide 4 options and mark the correct one. For fill_blank, use ___ in the question text. For arrange, provide items in the correct order.${customInstruction}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: 'unique short random id like q_abc123' },
                    type: { type: Type.STRING, description: 'multiple_choice, fill_blank, or arrange' },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'For MC: 4 options. For arrange: items in correct order. For fill_blank: empty array.' },
                    correctAnswer: { type: Type.STRING, description: 'For MC: exact text of correct option. For fill_blank: the answer word(s). For arrange: options joined with |||' },
                    explanation: { type: Type.STRING, description: 'Brief explanation of why the answer is correct' },
                    hint: { type: Type.STRING, description: 'A subtle hint that nudges toward the answer without giving it away' },
                  },
                  required: ['id', 'question', 'options', 'correctAnswer'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });
      return NextResponse.json(parse(res.text!));
    }

    // -- Generate distractors (wrong answer options) ---
    if (action === 'generate_distractors') {
      const question = clamp(body.question, 500);
      const correctAnswer = clamp(body.correctAnswer, 300);
      const count = Math.min(Math.max(Number(body.count) || 3, 1), 6);
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `For this quiz question: "${question}" with correct answer: "${correctAnswer}", generate ${count} plausible but incorrect answer options (distractors). They should be convincing enough to challenge students but clearly wrong to someone who knows the material. Return only the distractor strings, no explanations.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              distractors: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['distractors'],
          },
        },
      });
      return NextResponse.json(parse(res.text!));
    }

    // -- Generate lesson content ---
    if (action === 'generate_lesson') {
      const question = clamp(body.question, 500);
      const correctAnswer = clamp(body.correctAnswer, 300);
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Write a mini, interactive lesson that teaches the concept behind this quiz question: "${question}" (correct answer: "${correctAnswer}").

The lesson must feel lightweight and easy to scan, not bulky.

Requirements:
- Keep it to roughly 80-140 words.
- Use rich HTML with only these tags when useful: <p>, <strong>, <ul>, <li>, <h4>, <blockquote>.
- Format it into short sections with spacing and visual rhythm.
- Start with a quick hook or guiding question.
- Include 2-4 concise bullet points or steps.
- End with one short takeaway or "Try this" prompt.
- Use <strong> to highlight key ideas.
- Do not use divider lines or <hr>; create separation with short sections and spacing instead.
- Avoid long paragraphs, fluff, or textbook-style writing.

Also provide:
- a short lesson title (3-6 words)
- a short YouTube search query for a high-quality educational video that would help explain the same concept.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Short lesson title, 3-6 words' },
              body: { type: Type.STRING, description: 'Compact lesson content as HTML using p, strong, ul/li, h4, and blockquote when helpful; no hr dividers' },
              videoSearchQuery: { type: Type.STRING, description: 'Short YouTube search query for an educational explainer video' },
            },
            required: ['title', 'body', 'videoSearchQuery'],
          },
        },
      });
      const lesson = parse(res.text!);
      const query = lesson.videoSearchQuery || lesson.title || `${question} ${correctAnswer}`;
      const videoUrl = await findLessonVideo(query).catch(err => {
        console.warn('YouTube lookup failed:', err);
        return null;
      });
      return NextResponse.json({
        title: lesson.title,
        body: lesson.body,
        videoUrl,
      });
    }

    // -- Generate a hint ---
    if (action === 'generate_hint') {
      const question = clamp(body.question, 500);
      const correctAnswer = clamp(body.correctAnswer, 300);
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Write a single-sentence hint for this quiz question: "${question}" (correct answer: "${correctAnswer}"). The hint should nudge students toward the answer without revealing it directly. Keep it to one sentence, max 20 words.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hint: { type: Type.STRING },
            },
            required: ['hint'],
          },
        },
      });
      return NextResponse.json(parse(res.text!));
    }

    // -- Generate explanation ---
    if (action === 'generate_explanation') {
      const question = clamp(body.question, 500);
      const correctAnswer = clamp(body.correctAnswer, 300);
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Write a brief explanation (1-2 sentences, max 40 words) for why "${correctAnswer}" is the correct answer to this quiz question: "${question}". Be clear and educational.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: { type: Type.STRING },
            },
            required: ['explanation'],
          },
        },
      });
      return NextResponse.json(parse(res.text!));
    }

    // -- Generate learning outcomes ---
    if (action === 'generate_outcomes') {
      const questions: any[] = Array.isArray(body.questions) ? body.questions.slice(0, 30) : [];
      const summary = questions.map((q: any, i: number) => `${i + 1}. ${clamp(q.question, 300)}`).join('\n');
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Based on these ${questions.length} quiz questions:\n${summary}\n\nGenerate 3-5 concise learning outcomes (what students will know/be able to do after completing this course). Start each with an action verb (e.g. "Understand", "Apply", "Identify"). Keep each under 15 words.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              outcomes: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['outcomes'],
          },
        },
      });
      return NextResponse.json(parse(res.text!));
    }

    if (action === 'generate_course_description') {
      const title       = clamp(body.title, 200);
      const description = clamp(body.description, 1000);
      const style       = clamp(body.style, 50) || 'professional';
      const length      = clamp(body.length, 20) || 'medium';
      const prompt      = clamp(body.prompt, 500);
      const questions: any[]     = Array.isArray(body.questions)     ? body.questions.slice(0, 30)     : [];
      const learnOutcomes: any[] = Array.isArray(body.learnOutcomes) ? body.learnOutcomes.slice(0, 10) : [];

      const questionSummary = (questions as any[])
        .slice(0, 8)
        .map((q: any, i: number) => `${i + 1}. ${q.question}`)
        .join('\n');

      const outcomeSummary = (learnOutcomes as string[])
        .slice(0, 6)
        .map((outcome: string, i: number) => `${i + 1}. ${outcome}`)
        .join('\n');

      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Write a polished, creator-friendly course description for this course.

Course title: "${title}"

Requested style: "${style}"
Requested length: "${length}"

Learning outcomes:
${outcomeSummary || 'None provided'}

Questions covered:
${questionSummary || 'None provided'}

Existing description for context:
${description || 'None provided'}

Creator instructions:
${prompt || 'None provided'}

Requirements:
- Return HTML only.
- Match this tone/style: ${style}.
- Match this length preference: ${length === 'short' ? 'about 60-90 words' : length === 'long' ? 'about 140-220 words' : 'about 90-140 words'}.
- Make it feel like a mini interactive course, not a bulky academic program.
- Use only these tags when helpful: <p>, <strong>, <ul>, <li>.
- Start with a strong opening sentence.
- Clearly communicate what learners will gain.
- Keep paragraphs short and easy to scan.
- Do not use headings, dividers, or markdown.
- End with a short motivating close.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
            },
            required: ['description'],
          },
        },
      });

      return NextResponse.json(parse(res.text!));
    }

    if (action === 'generate_event_setup') {
      const brief               = clamp(body.brief, 1000);
      const existingTitle       = clamp(body.existingTitle, 200);
      const existingDescription = clamp(body.existingDescription, 1000);
      const eventDetails        = body.eventDetails && typeof body.eventDetails === 'object' ? body.eventDetails : {};

      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `You are helping a creator set up an event registration experience.

Creator brief:
${brief}

Existing title:
${existingTitle || 'None provided'}

Existing description:
${existingDescription || 'None provided'}

Existing event details:
${JSON.stringify(eventDetails || {}, null, 2)}

Generate a polished event setup for a modern creator platform.

Requirements:
- Return practical, ready-to-use event configuration.
- Make the title catchy but clear.
- Write a concise event description in HTML using only <p>, <strong>, <ul>, <li> when helpful.
- Determine whether the event is "virtual" or "in-person".
- If virtual, provide a meetingLink as an empty string.
- If in-person, provide a location and leave meetingLink empty.
- Suggest useful registration fields for this event. Prioritize quality over quantity.
- Include a short confirmation notice title and body for after registration.
- Use realistic placeholders when exact details are unknown.
- Timezone should be a short string like "UTC", "WAT", "PST", "GMT+1".
- Capacity can be omitted if not clearly implied.

Field rules:
- Allowed field types: text, email, textarea, number, select, phone, company, social.
- Include label, name, type, placeholder when relevant, required, and options only for select.
- For social fields, also include socialPlatforms as an array if useful.
- Do not include duplicate first name, last name, email, or phone fields if not necessary.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              eventDetails: {
                type: Type.OBJECT,
                properties: {
                  isEvent: { type: Type.BOOLEAN },
                  date: { type: Type.STRING },
                  time: { type: Type.STRING },
                  timezone: { type: Type.STRING },
                  capacity: { type: Type.NUMBER },
                  eventType: { type: Type.STRING },
                  meetingLink: { type: Type.STRING },
                  location: { type: Type.STRING },
                },
                required: ['isEvent', 'eventType'],
              },
              fields: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    label: { type: Type.STRING },
                    type: { type: Type.STRING },
                    placeholder: { type: Type.STRING },
                    required: { type: Type.BOOLEAN },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    socialPlatforms: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['id', 'name', 'label', 'type'],
                },
              },
              postSubmission: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  noticeTitle: { type: Type.STRING },
                  noticeBody: { type: Type.STRING },
                },
                required: ['type', 'noticeTitle', 'noticeBody'],
              },
            },
            required: ['title', 'description', 'eventDetails', 'fields', 'postSubmission'],
          },
        },
      });

      return NextResponse.json(parse(res.text!));
    }

    if (action === 'generate_broadcast_email') {
      const formTitle   = clamp(body.formTitle, 200);
      const description = clamp(body.description, 1000);
      const audience    = clamp(body.audience, 100) || 'registrants';
      const tone        = clamp(body.tone, 50)      || 'friendly';
      const purpose     = clamp(body.purpose, 100)  || 'event update';
      const prompt      = clamp(body.prompt, 500);
      const eventDetails = body.eventDetails && typeof body.eventDetails === 'object' ? body.eventDetails : {};

      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `You are writing a broadcast email for a creator platform.

Page title: ${formTitle}
Audience: ${audience}
Purpose: ${purpose}
Tone: ${tone}

Page description:
${description || 'None provided'}

Event details (if any):
${JSON.stringify(eventDetails || {}, null, 2)}

Extra creator instructions:
${prompt || 'None provided'}

Write a polished broadcast email.

Requirements:
- Return a subject and body.
- The subject should be concise and clickable, but not spammy.
- The body should be plain text content suitable for email.
- Keep the body to 2-5 short paragraphs.
- Be clear, warm, and action-oriented.
- Do not include HTML.
- Do not include placeholder brackets like [Name].
- Do not include a sign-off from AI Skills Africa; write as the creator/host.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              body: { type: Type.STRING },
            },
            required: ['subject', 'body'],
          },
        },
      });

      return NextResponse.json(parse(res.text!));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('AI course error:', err);
    return NextResponse.json({ error: err?.message ?? 'AI request failed' }, { status: 500 });
  }
}
