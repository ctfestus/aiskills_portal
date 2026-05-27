import { Type } from '@google/genai';
import { generateJSON } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRedis } from '@/lib/redis';

const ALLOWED_ACTIONS = new Set([
  'generate_questions',
  'generate_distractors',
  'generate_lesson',
  'generate_hint',
  'generate_explanation',
  'generate_outcomes',
  'generate_course_description',
  'generate_event_setup',
  'generate_broadcast_email',
  'generate_sql_course_outline',
  'generate_sql_course_full',
]);

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function authenticate(req: NextRequest): Promise<
  { user: any; profile: any } | NextResponse
> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('students').select('role').eq('id', user.id).single();
  if (!profile || !['instructor', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: instructor or admin access required' }, { status: 403 });
  }

  return { user, profile };
}

async function checkRateLimit(userId: string): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) {
    // Fail closed -- AI is a paid feature, don't allow through if limiter is down
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
  try {
    const key   = `rate:ai-course:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600); // 1-hour window
    if (count > 20) {
      return NextResponse.json(
        { error: 'AI generation limit reached. You can make up to 20 requests per hour.' },
        { status: 429 },
      );
    }
  } catch {
    // Redis error -- fail closed
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
  return null;
}

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
  "won't believe",
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

async function checkSqlCourseRateLimit(userId: string, role: string): Promise<NextResponse | null> {
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  const limit = role === 'admin' ? 20 : 5;
  try {
    const key = `rate:ai-sql-course:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    if (count > limit) {
      return NextResponse.json(
        { error: `AI SQL course limit reached. You can generate ${limit} courses per hour.` },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  // 1. Authentication + RBAC -- instructors and admins only
  const authResult = await authenticate(req);
  if (authResult instanceof NextResponse) return authResult;
  const { user, profile: userProfile } = authResult as { user: any; profile: any };

  // 2. Per-user rate limit -- 20 requests per hour
  const rateLimitError = await checkRateLimit(user.id);
  if (rateLimitError) return rateLimitError;

  const body = await req.json();
  const { action } = body;

  // 3. Action allowlist -- reject unknown actions before touching any API
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  // Input length guards -- limit injection surface on user-controlled strings
  const clamp = (val: unknown, max: number): string => String(val ?? '').slice(0, max);

  try {
    // -- Generate a batch of questions from a topic ---
    if (action === 'generate_questions') {
      const topic = clamp(body.topic, 200);
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);
      const type = clamp(body.type, 30) || 'multiple_choice';
      const customPrompt = clamp(body.customPrompt, 800);
      const customInstruction = customPrompt ? ` Additional instructions: ${customPrompt}` : '';
      const result = await generateJSON(
        `Generate ${count} course quiz questions about: "${topic}". Question type: ${type}. For multiple_choice, provide 4 options and mark the correct one. For fill_blank, use ___ in the question text. For arrange, provide items in the correct order.${customInstruction}`,
        {
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
      );
      return NextResponse.json(result);
    }

    // -- Generate distractors (wrong answer options) ---
    if (action === 'generate_distractors') {
      const question = clamp(body.question, 500);
      const correctAnswer = clamp(body.correctAnswer, 300);
      const count = Math.min(Math.max(Number(body.count) || 3, 1), 6);
      const result = await generateJSON(
        `For this quiz question: "${question}" with correct answer: "${correctAnswer}", generate ${count} plausible but incorrect answer options (distractors). They should be convincing enough to challenge students but clearly wrong to someone who knows the material. Return only the distractor strings, no explanations.`,
        {
          type: Type.OBJECT,
          properties: {
            distractors: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['distractors'],
        },
      );
      return NextResponse.json(result);
    }

    // -- Generate lesson content ---
    if (action === 'generate_lesson') {
      const question = clamp(body.question, 500);
      const correctAnswer = clamp(body.correctAnswer, 300);
      const instruction = clamp(body.instruction ?? '', 500);
      const promptText = instruction
        ? `Write a mini, interactive lesson about: "${instruction}".`
        : `Write a mini, interactive lesson that teaches the concept behind this quiz question: "${question}" (correct answer: "${correctAnswer}").`;
      const lesson = await generateJSON(
        `${promptText}

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
        {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Short lesson title, 3-6 words' },
            body: { type: Type.STRING, description: 'Compact lesson content as HTML using p, strong, ul/li, h4, and blockquote when helpful; no hr dividers' },
            videoSearchQuery: { type: Type.STRING, description: 'Short YouTube search query for an educational explainer video' },
          },
          required: ['title', 'body', 'videoSearchQuery'],
        },
      );
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
      const result = await generateJSON(
        `Write a single-sentence hint for this quiz question: "${question}" (correct answer: "${correctAnswer}"). The hint should nudge students toward the answer without revealing it directly. Keep it to one sentence, max 20 words.`,
        { type: Type.OBJECT, properties: { hint: { type: Type.STRING } }, required: ['hint'] },
      );
      return NextResponse.json(result);
    }

    // -- Generate explanation ---
    if (action === 'generate_explanation') {
      const question = clamp(body.question, 500);
      const correctAnswer = clamp(body.correctAnswer, 300);
      const result = await generateJSON(
        `Write a brief explanation (1-2 sentences, max 40 words) for why "${correctAnswer}" is the correct answer to this quiz question: "${question}". Be clear and educational.`,
        { type: Type.OBJECT, properties: { explanation: { type: Type.STRING } }, required: ['explanation'] },
      );
      return NextResponse.json(result);
    }

    // -- Generate learning outcomes ---
    if (action === 'generate_outcomes') {
      const questions: any[] = Array.isArray(body.questions) ? body.questions.slice(0, 30) : [];
      const summary = questions.map((q: any, i: number) => `${i + 1}. ${clamp(q.question, 300)}`).join('\n');
      const result = await generateJSON(
        `Based on these ${questions.length} quiz questions:\n${summary}\n\nGenerate 3-5 concise learning outcomes (what students will know/be able to do after completing this course). Start each with an action verb (e.g. "Understand", "Apply", "Identify"). Keep each under 15 words.`,
        { type: Type.OBJECT, properties: { outcomes: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['outcomes'] },
      );
      return NextResponse.json(result);
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

      const result = await generateJSON(
        `Write a polished, creator-friendly course description for this course.

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
- Return plain text only. No HTML tags, no markdown, no bullet points, no special characters.
- Length: ${length === 'short' ? '2-3 sentences' : length === 'long' ? '4-5 sentences' : '3-4 sentences'}.
- Tone: professional, concise, benefit-driven.
- Lead with the single most compelling outcome the learner will gain.
- Focus on what the learner walks away with, not what the course covers.
- Use clear, direct language. No jargon, no filler phrases like "In this course you will...".
- Do not use lists or line breaks -- write it as flowing prose.
- End with a forward-looking motivating sentence.`,
        { type: Type.OBJECT, properties: { description: { type: Type.STRING } }, required: ['description'] },
      );
      return NextResponse.json(result);
    }

    if (action === 'generate_event_setup') {
      const brief               = clamp(body.brief, 1000);
      const existingTitle       = clamp(body.existingTitle, 200);
      const existingDescription = clamp(body.existingDescription, 1000);
      const eventDetails        = body.eventDetails && typeof body.eventDetails === 'object' ? body.eventDetails : {};

      const result = await generateJSON(
        `You are helping a creator set up an event registration experience.

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
        {
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
      );
      return NextResponse.json(result);
    }

    if (action === 'generate_broadcast_email') {
      const formTitle   = clamp(body.formTitle, 200);
      const description = clamp(body.description, 1000);
      const audience    = clamp(body.audience, 100) || 'registrants';
      const tone        = clamp(body.tone, 50)      || 'friendly';
      const purpose     = clamp(body.purpose, 100)  || 'event update';
      const prompt      = clamp(body.prompt, 500);
      const eventDetails = body.eventDetails && typeof body.eventDetails === 'object' ? body.eventDetails : {};

      const result = await generateJSON(
        `You are writing a broadcast email for a creator platform.

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
- Do not include a sign-off from any specific platform; write as the creator/host.`,
        { type: Type.OBJECT, properties: { subject: { type: Type.STRING }, body: { type: Type.STRING } }, required: ['subject', 'body'] },
      );
      return NextResponse.json(result);
    }

    // -- Generate SQL course outline (step 1 of 2) ---
    if (action === 'generate_sql_course_outline') {
      const rateLimitErr = await checkSqlCourseRateLimit(user.id, userProfile?.role ?? 'instructor');
      if (rateLimitErr) return rateLimitErr;

      const title      = clamp(body.title, 200);
      const industry   = clamp(body.industry, 100);
      const role       = clamp(body.role, 100);
      const level      = clamp(body.level, 30);
      const promptText = clamp(body.promptText, 800);
      const moduleIndex: number | null = typeof body.moduleIndex === 'number' ? body.moduleIndex : null;
      const existingOutline = body.existingOutline ?? null;

      const lessonItemSchema = {
        type: Type.OBJECT,
        properties: {
          id:              { type: Type.STRING },
          title:           { type: Type.STRING },
          skillFocus:      { type: Type.STRING },
          questionType:    { type: Type.STRING },
          questionSummary: { type: Type.STRING },
        },
        required: ['id', 'title', 'skillFocus', 'questionType', 'questionSummary'],
      };

      if (moduleIndex !== null && existingOutline) {
        const currentModule = existingOutline.modules?.[moduleIndex];
        const otherModules = existingOutline.modules
          ?.filter((_: any, i: number) => i !== moduleIndex)
          .map((m: any) => m.title).join(', ') ?? '';

        const prompt = `You are regenerating a single module for an existing SQL course.

Course context:
- Title: ${title || existingOutline.courseTitle}
- Industry: ${industry}
- Target Role: ${role}
- Skill Level: ${level}
- Other modules already in the course: ${otherModules}

Current module to replace:
${JSON.stringify(currentModule, null, 2)}

Generate a fresh replacement module that:
- Covers SQL skills not covered by the other modules
- Has 4-6 lessons each covering exactly ONE atomic SQL sub-topic
- Do not bundle multiple concepts into one lesson
- Lesson titles must clearly name the specific sub-topic (e.g. "Filtering with BETWEEN" not "WHERE Clauses")
- Use varied question types matching the course level (sql, mcq, debug, completion)
- No em dashes, no curly quotes, no ellipsis characters, no asterisks`;

        const schema = {
          type: Type.OBJECT,
          properties: {
            module: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING }, title: { type: Type.STRING },
                description: { type: Type.STRING },
                lessons: { type: Type.ARRAY, items: lessonItemSchema },
              },
              required: ['id', 'title', 'description', 'lessons'],
            },
          },
          required: ['module'],
        };
        const result = await generateJSON(prompt, schema, { temperature: 0.7 });
        return NextResponse.json(result);
      }

      const structurePrompt = `You are a World-Class Data Science Instructor designing a job-ready SQL course.

Course parameters:
- Title: ${title}
- Industry: ${industry}
- Target Role: ${role}
- Skill Level: ${level}
- Focus: ${promptText || 'General SQL skills for the role'}
${promptText ? `
STRICT TOPIC CONSTRAINT: The course MUST cover ONLY the topics listed in the Focus above. Do not add modules or lessons for any topic not mentioned there. Every module title and every lesson must map directly to one of those topics.
` : ''}
Create a complete SQL course outline following these rules:

1. Business scenario: 2-3 sentences describing a high-performance data team and their mission.

2. Course description: 2-3 sentences summarizing what students will learn.

3. Learning outcomes: 4-6 concise outcomes starting with action verbs.

4. Shared dataset plan:
   - 2-4 relational tables reflecting realistic data for the industry
   - For each table, provide tableName, description, rowCount, and columns
   - Each column must include name, type, and description
   - Use only INTEGER, TEXT, REAL, DATE. No BIGINT, SERIAL, BOOLEAN, ARRAY
   - Tables must support exercises from basic SELECT to joins and aggregation

5. Course structure: 6-10 modules, each with 4-6 lessons
   - Every lesson covers exactly ONE atomic SQL concept - never bundle two concepts into one lesson
   - Bad example: "SELECT and filtering" -- Good: "Selecting a Single Column" then "Filtering Rows with WHERE"
   - A SELECT module should have separate lessons for: single column, multiple columns, SELECT *, LIMIT, aliases with AS, DISTINCT
   - A WHERE module should have separate lessons for: equality, comparison operators, AND/OR, IN/NOT IN, BETWEEN, LIKE
   - Every module must be this granular
   - Question type distribution across ALL modules: mostly sql, completion, and debug
   - MCQ is rare: at most 1 lesson per module may be mcq, and only in the first 2-3 modules
   - Advanced modules (last 2-3): sql and debug only, no mcq, no completion
   - Lesson titles must clearly name the specific sub-topic

Strict formatting: No em dashes. No curly quotes. No ellipsis. No asterisks.`;

      const structureSchema = {
        type: Type.OBJECT,
        properties: {
          courseTitle:       { type: Type.STRING },
          courseDescription: { type: Type.STRING },
          businessScenario:  { type: Type.STRING },
          learningOutcomes:  { type: Type.ARRAY, items: { type: Type.STRING } },
          sharedDatasetPlan: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              tables: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tableName: { type: Type.STRING },
                    description: { type: Type.STRING },
                    rowCount: { type: Type.NUMBER },
                    columns: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          type: { type: Type.STRING },
                          description: { type: Type.STRING },
                        },
                        required: ['name', 'type', 'description'],
                      },
                    },
                  },
                  required: ['tableName', 'description', 'rowCount', 'columns'],
                },
              },
            },
            required: ['description', 'tables'],
          },
          modules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING }, title: { type: Type.STRING },
                description: { type: Type.STRING },
                lessons: { type: Type.ARRAY, items: lessonItemSchema },
              },
              required: ['id', 'title', 'description', 'lessons'],
            },
          },
        },
        required: ['courseTitle', 'courseDescription', 'businessScenario', 'learningOutcomes', 'sharedDatasetPlan', 'modules'],
      };

      const structure = await generateJSON(structurePrompt, structureSchema, { temperature: 0.7, geminiRetries: 2 } as any);

      const datasetPrompt = `You are generating the shared dataset for a SQL course outline.

Course context:
- Title: ${structure.courseTitle || title}
- Industry: ${industry}
- Target Role: ${role}
- Skill Level: ${level}
- Business scenario: ${structure.businessScenario ?? ''}

Shared dataset description:
${structure.sharedDatasetPlan?.description ?? ''}

Generate valid DuckDB seed SQL for all planned tables below.

Rules:
- Return 2-4 tables with realistic relational data and internally consistent foreign keys
- Total rows across all tables should be between 50 and 100
- Use only INTEGER, TEXT, REAL, DATE
- Each table's seedSql must include CREATE TABLE and INSERT INTO statements
- Use the exact table names and exact column names from the plan
- Do not invent extra tables or columns
- Keep ids and relationships consistent across the whole dataset
- No markdown fences

Planned tables:
${JSON.stringify(structure.sharedDatasetPlan?.tables ?? [], null, 2)}`;

      const datasetSchema = {
        type: Type.OBJECT,
        properties: {
          sharedDataset: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              tables: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tableName:   { type: Type.STRING },
                    description: { type: Type.STRING },
                    seedSql:     { type: Type.STRING },
                  },
                  required: ['tableName', 'description', 'seedSql'],
                },
              },
            },
            required: ['description', 'tables'],
          },
        },
        required: ['sharedDataset'],
      };

      const dataset = await generateJSON(datasetPrompt, datasetSchema, { temperature: 0.5, geminiRetries: 2 } as any);
      return NextResponse.json({
        ...structure,
        sharedDataset: dataset.sharedDataset,
      });
    }

    // -- Generate full SQL course from approved outline (step 2 of 2) ---
    if (action === 'generate_sql_course_full') {
      const rateLimitErr = await checkSqlCourseRateLimit(user.id, userProfile?.role ?? 'instructor');
      if (rateLimitErr) return rateLimitErr;

      const outline  = body.outline;
      const title    = clamp(body.title || outline?.courseTitle || '', 200);
      const industry = clamp(body.industry, 100);
      const role     = clamp(body.role, 100);
      const level    = clamp(body.level, 30);

      if (!outline?.modules?.length) {
        return NextResponse.json({ error: 'outline.modules is required' }, { status: 400 });
      }

      const tableNames = (outline.sharedDataset?.tables ?? []).map((t: any) => t.tableName).join(', ');

      // Include only CREATE TABLE (strip INSERT statements) -- column names are all Gemini needs,
      // and INSERT rows can be 3000+ tokens which causes ECONNRESET on every module call.
      const createOnly = (seedSql: string): string => {
        const idx = seedSql.toUpperCase().indexOf('INSERT INTO');
        return idx > 0 ? seedSql.slice(0, idx).trim() : seedSql;
      };
      const tableSchemas = (outline.sharedDataset?.tables ?? [])
        .map((t: any) => `-- ${t.tableName}: ${t.description}\n${createOnly(t.seedSql ?? '')}`)
        .join('\n\n');

      const baseCtx = `Course context:
- Title: ${title}
- Industry: ${industry}
- Target Role: ${role}
- Skill Level: ${level}
- Business scenario: ${outline.businessScenario ?? ''}

SHARED DATASET SCHEMA (use ONLY these tables and ONLY these exact column names - never invent column names):
${tableSchemas}

STRICT FORMATTING: No em dashes. No curly quotes - use straight quotes only. No ellipsis. No asterisks.
Return the EXACT lessonId value from the input for every lesson - do not change IDs.`;

      const mcqQuestionSchema = {
        type: Type.OBJECT,
        properties: {
          questionText:  { type: Type.STRING },
          options:       { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.STRING },
          explanation:   { type: Type.STRING },
        },
        required: ['questionText', 'options', 'correctAnswer', 'explanation'],
      };

      const mcqItemSchema = {
        type: Type.OBJECT,
        properties: {
          lessonId:    { type: Type.STRING },
          lessonTitle: { type: Type.STRING },
          lessonBody:  { type: Type.STRING },
          questions:   { type: Type.ARRAY, items: mcqQuestionSchema },
        },
        required: ['lessonId', 'lessonTitle', 'lessonBody', 'questions'],
      };

      const sqlQuestionSchema = {
        type: Type.OBJECT,
        properties: {
          lessonBody:                { type: Type.STRING },
          questionText:              { type: Type.STRING },
          solution:                  { type: Type.STRING },
          initialCode:               { type: Type.STRING },
          hints:                     { type: Type.ARRAY, items: { type: Type.STRING } },
          requirements:              { type: Type.ARRAY, items: { type: Type.STRING } },
          expectedOutputDescription: { type: Type.STRING },
        },
        required: ['lessonBody', 'questionText', 'solution', 'initialCode', 'hints', 'requirements', 'expectedOutputDescription'],
      };

      const sqlItemSchema = {
        type: Type.OBJECT,
        properties: {
          lessonId:    { type: Type.STRING },
          lessonTitle: { type: Type.STRING },
          questions:   { type: Type.ARRAY, items: sqlQuestionSchema },
        },
        required: ['lessonId', 'lessonTitle', 'questions'],
      };

      const lessonBodyRules = `LESSON BODY STRUCTURE - lessonBody must follow this exact order:
1. CONCEPT: Define the SQL keyword, clause, or operator. Explain what it does and why it exists. Use <strong> for the keyword. One focused paragraph.
2. SYNTAX: Show how it works. Use <pre><code> for a short generic SQL syntax pattern or example (not using the course tables). Use <code> inline for SQL keywords like <code>SELECT</code>, <code>WHERE</code>, <code>GROUP BY</code>.
3. KEY POINT (optional): Use <blockquote> to highlight one important rule, gotcha, or best practice about this concept.
4. BUSINESS CONTEXT: Connect to the industry and role. Explain why this skill matters in this specific domain. Reference the company/team from the business scenario.
lessonBody HTML allowed tags: <p> <strong> <ul> <li> <pre> <code> <blockquote>. No headings. 120-200 words total.
Do NOT include the task instruction in lessonBody - that goes in questionText only.`;

      const masterLessonSchema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          body:  { type: Type.STRING },
        },
        required: ['title', 'body'],
      };

      const lessonMap = new Map<string, any>();
      const masterLessonMap = new Map<string, any>(); // mod.id -> { title, body }

      for (const mod of outline.modules) {
        // Generate one master lesson per module before the individual lesson questions
        const lessonTitles = (mod.lessons ?? []).map((l: any) => l.title).join(', ');
        const masterPrompt = `You are writing a module introduction lesson for a SQL course.
${baseCtx}

Module: ${mod.title}
${mod.description ? `Module description: ${mod.description}` : ''}
Lessons covered in this module: ${lessonTitles}

Write a standalone teaching lesson that introduces this entire module.

Requirements:
- Start with a short paragraph explaining what this module covers and why it matters.
- Show a clear, annotated SQL example for each major concept in this module using the shared dataset tables.
- Use <h4> for concept sub-headers (e.g. the name of each SQL keyword or clause).
- Use <pre><code> blocks for all SQL examples - they must use ONLY the exact column names from the SHARED DATASET SCHEMA.
- Use <ul><li> for key rules or tips where helpful.
- Use <blockquote> for one standout rule or gotcha per concept.
- End with a short "What you will practice" paragraph listing the lessons ahead.
- Total length: 250-400 words.
- HTML tags allowed: <p> <strong> <h4> <ul> <li> <pre> <code> <blockquote>.
- No em dashes. No curly quotes. No asterisks.
- Return a short title (the module name) and the full HTML body.`;

        const masterResult = await generateJSON(masterPrompt, masterLessonSchema, { temperature: 0.5, geminiRetries: 2 } as any);
        if (masterResult?.body) masterLessonMap.set(mod.id, masterResult);

        for (const lesson of mod.lessons ?? []) {
          const lessonInput = {
            lessonId: lesson.id,
            moduleTitle: mod.title,
            moduleDescription: mod.description ?? '',
            lessonTitle: lesson.title,
            skillFocus: lesson.skillFocus,
            questionType: lesson.questionType,
            questionSummary: lesson.questionSummary,
          };

          const promptBase = `You are generating exercise content for one lesson of a SQL course.
${baseCtx}

Current module: ${mod.title}
${mod.description ? `Module description: ${mod.description}` : ''}

${lessonBodyRules}

SQL/completion/debug lessons MUST have a "questions" array with EXACTLY 2 questions.
MCQ lessons MUST have a "questions" array with EXACTLY 1 question.
`;

          if (lesson.questionType === 'mcq') {
            const mcqPrompt = `${promptBase}

For this MCQ lesson, produce a "questions" array with exactly 1 item:
- lessonBody: follow LESSON BODY STRUCTURE above.
- questions[0] has:
  - questionText: 1 concise sentence question. No background.
  - options: EXACTLY 4 answer choice strings. Real choices only - no field names.
  - correctAnswer: exact text of the correct option.
  - explanation: 1-2 sentences explaining why the answer is correct.

Lesson input:
${JSON.stringify(lessonInput, null, 2)}`;

            const result = await generateJSON(mcqPrompt, mcqItemSchema, { temperature: 0.6, geminiRetries: 2 } as any);
            lessonMap.set(result.lessonId, result);
            continue;
          }

          const sqlPrompt = `${promptBase}

For this SQL lesson, produce a "questions" array with EXACTLY 2 items. Each question has its own lessonBody.

questions[0]:
- lessonBody: The full teaching lesson. Follow LESSON BODY STRUCTURE above. 120-200 words.
- questionText: Task instruction only. 1-2 sentences starting with a verb. No background or context.
- solution, initialCode, hints, requirements, expectedOutputDescription as described above.

questions[1]:
- lessonBody: A brief scenario (2-3 sentences, 40-70 words). Do NOT repeat the lesson explanation.
  Write a new business situation where the same SQL concept applies. Mention a specific team, report, or business need from the course scenario.
  Use HTML <p> and <strong> only. Example: "<p>The operations team also needs a quick overview of all <strong>supplier</strong> records. They have requested every column from the suppliers table for an internal audit report.</p>"
- questionText: Task instruction only. 1-2 sentences starting with a verb. No background or context.
- solution, initialCode, hints, requirements, expectedOutputDescription as described above.

All SQL must use only these tables and exact column names: ${tableNames}

Lesson input:
${JSON.stringify(lessonInput, null, 2)}`;

          const result = await generateJSON(sqlPrompt, sqlItemSchema, { temperature: 0.6, geminiRetries: 2 } as any);
          lessonMap.set(result.lessonId, result);
        }
      }

      // Escape plain text for safe HTML interpolation
      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

      const buildSqlLessonBody = (lessonBody: string, requirements: string[]): string => {
        if (!requirements?.length) return lessonBody;
        const items = requirements.map(r => `<li>${esc(r)}</li>`).join('');
        return `${lessonBody}<p><strong>Before submitting:</strong></p><ul>${items}</ul>`;
      };

      const tables: any[] = outline.sharedDataset?.tables ?? [];
      const uid = () => Math.random().toString(36).slice(2, 9);
      let isFirstSqlLesson = true;
      const questions: any[] = [];

      for (const mod of outline.modules) {
        // Insert the master lesson as a lessonOnly slide at the top of each module
        const masterLesson = masterLessonMap.get(mod.id);
        if (masterLesson?.body) {
          questions.push({
            id:            uid(),
            lessonOnly:    true,
            question:      '',
            options:       [],
            correctAnswer: '',
            lesson:        { title: masterLesson.title || mod.title, body: masterLesson.body },
          });
        }

        for (const outLesson of mod.lessons ?? []) {
          const gen = lessonMap.get(outLesson.id);
          if (!gen) continue;

          const genQuestions: any[] = gen.questions ?? [];
          const lessonTitle = gen.lessonTitle ?? outLesson.title;
          const lessonBody  = gen.lessonBody ?? '';

          if (outLesson.questionType === 'mcq') {
            // MCQ: lesson intro slide first, then questions with no lesson embedded
            if (lessonBody) {
              questions.push({
                id:            uid(),
                lessonOnly:    true,
                question:      '',
                options:       [],
                correctAnswer: '',
                lesson:        { title: lessonTitle, body: lessonBody },
              });
            }
            for (const q of genQuestions) {
              questions.push({
                id:            uid(),
                type:          'multiple_choice',
                question:      q.questionText ?? '',
                options:       q.options ?? [],
                correctAnswer: q.correctAnswer ?? '',
                explanation:   q.explanation ?? '',
              });
            }
          } else {
            // SQL/debug/completion: each question carries its own lessonBody
            // questions[0] gets the full lesson; questions[1+] get the scenario body
            for (let qi = 0; qi < genQuestions.length; qi++) {
              const q = genQuestions[qi];
              const sqlTables = isFirstSqlLesson ? tables : [];
              if (isFirstSqlLesson) isFirstSqlLesson = false;

              const body = qi === 0
                ? buildSqlLessonBody(q.lessonBody ?? lessonBody, q.requirements ?? [])
                : (q.lessonBody ?? '');

              questions.push({
                id:                  uid(),
                type:                'sql_exercise',
                question:            q.questionText ?? '',
                options:             [],
                correctAnswer:       '',
                sqlTables,
                sqlSolution:         q.solution ?? '',
                sqlStarterCode:      q.initialCode ?? '',
                sqlHints:            q.hints ?? [],
                sqlRequiredPatterns: [],
                lesson:              { title: lessonTitle, body },
              });
            }
          }
        }
      }

      return NextResponse.json({
        title,
        description: outline.courseDescription ?? outline.businessScenario ?? '',
        isCourse:    true,
        learnOutcomes: outline.learningOutcomes ?? [],
        questions,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 }); // unreachable -- allowlist above
  } catch (err: any) {
    console.error('AI course error:', err);
    return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 500 });
  }
}
