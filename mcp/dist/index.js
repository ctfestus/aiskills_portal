import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { apiCall, supabaseQuery, supabaseRun } from './api.js';
const serverName = process.env.MCP_NAME ?? 'aisa-mcp';
const server = new McpServer({
    name: serverName,
    version: '1.0.0',
    description: `${serverName} platform tools. IMPORTANT RULES: (1) Never ask the user for IDs -- always resolve names to IDs yourself by calling the relevant list_* tool first. If the user says "the Python course" call list_courses, find it by name, and use its ID. If they say "Lagos cohort" call list_cohorts first. (2) All content is saved as draft -- never published unless the user explicitly asks. (3) All fields in every tool schema are fully supported. Do not tell users a field is unsupported.`,
});
// --- COHORTS ---
server.tool('list_cohorts', 'List all cohorts. Use this to get cohort IDs before creating or assigning content.', {}, async () => {
    const data = await supabaseQuery('cohorts', 'id, name, created_at');
    const formatted = data.map((c) => `• ${c.name} -- ID: ${c.id}`).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No cohorts found.' }] };
});
server.tool('create_cohort', 'Create a new cohort.', {
    name: z.string().describe('Cohort name, e.g. "Lagos Batch 3". If user gives a partial name, use the closest match from list_cohorts.'),
}, async ({ name }) => {
    const data = await supabaseRun(sb => sb.from('cohorts').insert({ name: name.trim() }).select('id').single());
    return { content: [{ type: 'text', text: `Cohort created.\nName: ${name}\nID: ${data.id}` }] };
});
server.tool('list_cohort_students', 'List all students in a cohort with their name, email, and XP.', {
    cohort_id: z.string().describe('Cohort ID -- if you only have a name, call list_cohorts first to resolve it'),
}, async ({ cohort_id }) => {
    const students = await supabaseRun(sb => sb.from('students').select('id, full_name, email, role').eq('cohort_id', cohort_id).eq('role', 'student').order('full_name'));
    if (!students?.length)
        return { content: [{ type: 'text', text: 'No students found in this cohort.' }] };
    const ids = students.map((s) => s.id);
    const xpRows = await supabaseRun(sb => sb.from('student_xp').select('student_id, total_xp').in('student_id', ids));
    const xpMap = {};
    for (const x of xpRows ?? [])
        xpMap[x.student_id] = x.total_xp;
    const formatted = students.map((s, i) => `${i + 1}. ${s.full_name} -- ${s.email} -- ${xpMap[s.id] ?? 0} XP`).join('\n');
    return { content: [{ type: 'text', text: `${students.length} students:\n\n${formatted}` }] };
});
server.tool('get_cohort_stats', 'Get completion and pass rate stats for a cohort across all assigned courses.', {
    cohort_id: z.string().describe('Cohort ID -- if you only have a name, call list_cohorts first to resolve it'),
}, async ({ cohort_id }) => {
    const courses = await supabaseRun(sb => sb.from('courses').select('id, title').contains('cohort_ids', [cohort_id]));
    if (!courses?.length)
        return { content: [{ type: 'text', text: 'No courses assigned to this cohort.' }] };
    const students = await supabaseRun(sb => sb.from('students').select('id').eq('cohort_id', cohort_id).eq('role', 'student'));
    const studentCount = students?.length ?? 0;
    if (!studentCount)
        return { content: [{ type: 'text', text: 'No students in this cohort.' }] };
    const courseIds = courses.map((c) => c.id);
    const attempts = await supabaseRun(sb => sb.from('course_attempts').select('course_id, passed').not('completed_at', 'is', null).in('course_id', courseIds));
    const statsMap = {};
    for (const a of attempts ?? []) {
        if (!statsMap[a.course_id])
            statsMap[a.course_id] = { completions: 0, passes: 0 };
        statsMap[a.course_id].completions++;
        if (a.passed)
            statsMap[a.course_id].passes++;
    }
    const lines = courses.map((c) => {
        const s = statsMap[c.id] ?? { completions: 0, passes: 0 };
        const compRate = Math.round((s.completions / studentCount) * 100);
        const passRate = s.completions ? Math.round((s.passes / s.completions) * 100) : 0;
        return `• ${c.title}\n  Completions: ${s.completions}/${studentCount} (${compRate}%) · Pass rate: ${passRate}%`;
    }).join('\n');
    return { content: [{ type: 'text', text: `Cohort stats -- ${studentCount} students:\n\n${lines}` }] };
});
server.tool('get_leaderboard', 'Get the top students by XP for a cohort.', {
    cohort_id: z.string().describe('Cohort ID -- if you only have a name, call list_cohorts first to resolve it'),
    limit: z.number().min(1).max(50).optional().describe('Number of students to return (default 10)'),
}, async ({ cohort_id, limit = 10 }) => {
    const students = await supabaseRun(sb => sb.from('students').select('id, full_name').eq('cohort_id', cohort_id).eq('role', 'student'));
    if (!students?.length)
        return { content: [{ type: 'text', text: 'No students in this cohort.' }] };
    const ids = students.map((s) => s.id);
    const xpRows = await supabaseRun(sb => sb.from('student_xp').select('student_id, total_xp').in('student_id', ids).order('total_xp', { ascending: false }).limit(limit));
    const nameMap = {};
    for (const s of students)
        nameMap[s.id] = s.full_name;
    const formatted = (xpRows ?? []).map((x, i) => `${i + 1}. ${nameMap[x.student_id] ?? 'Unknown'} -- ${x.total_xp} XP`).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No XP data yet.' }] };
});
// --- COURSES ---
server.tool('list_courses', 'List all courses created by the instructor.', {}, async () => {
    const data = await supabaseQuery('courses', 'id, title, status, slug, cohort_ids, created_at');
    const formatted = data.map((c) => `• ${c.title} [${c.status}] -- ID: ${c.id} -- slug: ${c.slug}`).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No courses found.' }] };
});
server.tool('get_course', 'Get the full content of a course by ID, including all questions and lesson slides. Use this before updating a course to see what already exists.', {
    id: z.string().describe('Course ID -- if you only have a name, call list_courses first to resolve it'),
}, async ({ id }) => {
    const rows = await supabaseQuery('courses', 'id, title, description, status, slug, cohort_ids, questions, passmark, learn_outcomes, theme, mode, deadline_days');
    const data = rows.find((r) => r.id === id);
    if (!data)
        return { content: [{ type: 'text', text: `Course not found: ${id}` }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});
server.tool('create_course', 'Create a new course on the AI Skills Africa platform. Each question supports: question text, options array, correct index, explanation, and an optional lesson object (title, body, videoUrl) for teaching content shown before the question. All fields are saved directly to the database.', {
    title: z.string().describe('Course title'),
    description: z.string().optional().describe('Short description shown on the course card'),
    questions: z.array(z.object({
        question: z.string().describe('The question text'),
        options: z.array(z.string()).describe('List of answer options'),
        correct: z.number().describe('Index of the correct option (0-based)'),
        explanation: z.string().optional().describe('Explanation shown after answering'),
        lesson: z.object({
            title: z.string().optional().describe('Lesson section title'),
            body: z.string().optional().describe('Lesson content shown before the question (supports HTML)'),
            videoUrl: z.string().optional().describe('Optional video URL for the lesson'),
        }).optional().describe('Optional lesson content attached to this question'),
        lessonOnly: z.boolean().optional().describe('If true, this is a lesson-only slide with no question'),
    })).describe('Array of quiz questions, optionally with lesson content'),
    cohort_ids: z.array(z.string()).optional().describe('Cohort IDs to assign this course to'),
    passmark: z.number().min(1).max(100).optional().describe('Pass percentage (default 50)'),
    deadline_days: z.number().optional().describe('Days to complete after assignment'),
    learn_outcomes: z.array(z.string()).optional().describe('What students will learn'),
    theme: z.enum(['forest', 'lime', 'emerald', 'rose', 'amber']).optional().describe('Color theme (default: forest)'),
    mode: z.enum(['dark', 'light', 'auto']).optional().describe('Display mode (default: dark)'),
}, async ({ title, description, questions, cohort_ids, passmark, deadline_days, learn_outcomes, theme, mode }) => {
    const data = await apiCall('/api/forms', {
        title,
        description,
        cohort_ids: cohort_ids ?? [],
        deadline_days: deadline_days ?? null,
        status: 'draft',
        config: {
            isCourse: true,
            questions: questions ?? [],
            passmark: passmark ?? 50,
            learnOutcomes: learn_outcomes ?? [],
            theme: theme ?? 'forest',
            mode: mode ?? 'dark',
        },
    });
    return { content: [{ type: 'text', text: `Course created.\nID: ${data.id}\nSlug: ${data.slug}\nStatus: ${data.status}` }] };
});
server.tool('update_course', 'Update an existing course by ID.', {
    id: z.string().describe('Course ID to update'),
    title: z.string().optional(),
    description: z.string().optional(),
    questions: z.array(z.object({
        question: z.string(),
        options: z.array(z.string()),
        correct: z.number(),
        explanation: z.string().optional(),
        lesson: z.object({
            title: z.string().optional(),
            body: z.string().optional(),
            videoUrl: z.string().optional(),
        }).optional(),
        lessonOnly: z.boolean().optional(),
    })).optional(),
    cohort_ids: z.array(z.string()).optional(),
    passmark: z.number().min(1).max(100).optional(),
    deadline_days: z.number().optional(),
    status: z.enum(['draft', 'published']).optional(),
    learn_outcomes: z.array(z.string()).optional(),
    theme: z.enum(['forest', 'lime', 'emerald', 'rose', 'amber']).optional(),
    mode: z.enum(['dark', 'light', 'auto']).optional(),
}, async ({ id, title, description, questions, cohort_ids, passmark, deadline_days, status, learn_outcomes, theme, mode }) => {
    await apiCall('/api/forms', {
        id,
        title,
        description,
        cohort_ids,
        deadline_days,
        status,
        config: {
            isCourse: true,
            questions,
            passmark,
            learnOutcomes: learn_outcomes,
            theme,
            mode,
        },
    }, 'PUT');
    return { content: [{ type: 'text', text: `Course updated. ID: ${id}` }] };
});
server.tool('publish_content', 'Publish or unpublish any course, virtual experience, or learning path by ID.', {
    id: z.string().describe('Content ID'),
    content_type: z.enum(['course', 'virtual_experience', 'learning_path']).describe('Type of content'),
    status: z.enum(['published', 'draft']).describe('New status'),
}, async ({ id, content_type, status }) => {
    if (content_type === 'learning_path') {
        // Get current data first so we preserve required fields
        const rows = await supabaseQuery('learning_paths', 'id, title, item_ids, cohort_ids');
        const lp = rows.find((r) => r.id === id);
        if (!lp)
            return { content: [{ type: 'text', text: `Learning path not found: ${id}` }] };
        await apiCall('/api/learning-paths', { action: 'update', id, title: lp.title, item_ids: lp.item_ids, cohort_ids: lp.cohort_ids, status });
    }
    else {
        // PATCH /api/forms handles both courses and virtual_experiences
        await apiCall('/api/forms', { formId: id, status }, 'PATCH');
    }
    return { content: [{ type: 'text', text: `${content_type} ${status === 'published' ? 'published' : 'set to draft'}. ID: ${id}` }] };
});
// --- VIRTUAL EXPERIENCES (GUIDED PROJECTS) ---
server.tool('list_virtual_experiences', 'List all virtual experiences (guided projects) created by the instructor.', {}, async () => {
    const data = await supabaseQuery('virtual_experiences', 'id, title, status, slug, cohort_ids, industry, difficulty, created_at');
    const formatted = data.map((v) => `• ${v.title} [${v.status}] -- ID: ${v.id} -- slug: ${v.slug}${v.industry ? ` -- ${v.industry}` : ''}`).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No virtual experiences found.' }] };
});
server.tool('get_virtual_experience', 'Get the full content of a virtual experience by ID, including all modules and lessons.', {
    id: z.string().describe('Virtual experience ID -- if you only have a name, call list_virtual_experiences first to resolve it'),
}, async ({ id }) => {
    const rows = await supabaseQuery('virtual_experiences', 'id, title, status, slug, cohort_ids, modules, learn_outcomes, industry, difficulty, role, company, duration, tools, tagline, theme, mode, deadline_days');
    const data = rows.find((r) => r.id === id);
    if (!data)
        return { content: [{ type: 'text', text: `Virtual experience not found: ${id}` }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});
server.tool('create_virtual_experience', 'Create a new virtual experience (guided project / job simulation). Returns the VE ID and slug.', {
    title: z.string().describe('VE title'),
    tagline: z.string().optional().describe('One-line description shown on the card'),
    industry: z.string().optional().describe('e.g. Finance, Healthcare, Tech'),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    role: z.string().optional().describe('Job role this simulates, e.g. Data Analyst'),
    company: z.string().optional().describe('Fictional company name for the scenario'),
    duration: z.string().optional().describe('Estimated duration, e.g. "2 hours"'),
    tools: z.array(z.string()).optional().describe('Tools used, e.g. ["Excel", "Python"]'),
    modules: z.array(z.object({
        title: z.string().describe('Module title'),
        lessons: z.array(z.object({
            title: z.string().describe('Lesson title'),
            content: z.string().optional().describe('Lesson body / instructions'),
            requirements: z.array(z.object({
                type: z.enum(['text', 'file', 'quiz']).describe('Requirement type'),
                prompt: z.string().describe('What the student must do'),
            })).optional(),
        })),
    })).describe('Modules and lessons structure'),
    learn_outcomes: z.array(z.string()).optional().describe('What students will learn'),
    cohort_ids: z.array(z.string()).optional().describe('Cohort IDs to assign to'),
    deadline_days: z.number().optional(),
}, async ({ title, tagline, industry, difficulty, role, company, duration, tools, modules, learn_outcomes, cohort_ids, deadline_days }) => {
    const data = await apiCall('/api/guided-project-save', {
        title,
        cohort_ids: cohort_ids ?? [],
        deadline_days: deadline_days ?? null,
        status: 'draft',
        config: {
            tagline,
            industry,
            difficulty,
            role,
            company,
            duration,
            tools: tools ?? [],
            modules: modules ?? [],
            learnOutcomes: learn_outcomes ?? [],
        },
    });
    return { content: [{ type: 'text', text: `Virtual experience created.\nID: ${data.id}\nSlug: ${data.slug}` }] };
});
server.tool('update_virtual_experience', 'Update an existing virtual experience by ID.', {
    id: z.string().describe('VE ID to update'),
    title: z.string().optional(),
    tagline: z.string().optional(),
    industry: z.string().optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    role: z.string().optional(),
    company: z.string().optional(),
    duration: z.string().optional(),
    tools: z.array(z.string()).optional(),
    modules: z.array(z.object({
        title: z.string(),
        lessons: z.array(z.object({
            title: z.string(),
            content: z.string().optional(),
            requirements: z.array(z.object({
                type: z.enum(['text', 'file', 'quiz']),
                prompt: z.string(),
            })).optional(),
        })),
    })).optional(),
    learn_outcomes: z.array(z.string()).optional(),
    cohort_ids: z.array(z.string()).optional(),
    deadline_days: z.number().optional(),
    status: z.enum(['draft', 'published']).optional(),
}, async ({ id, title, tagline, industry, difficulty, role, company, duration, tools, modules, learn_outcomes, cohort_ids, deadline_days, status }) => {
    const data = await apiCall('/api/guided-project-save', {
        editId: id,
        title,
        cohort_ids,
        deadline_days,
        status,
        config: {
            tagline,
            industry,
            difficulty,
            role,
            company,
            duration,
            tools,
            modules,
            learnOutcomes: learn_outcomes,
        },
    });
    return { content: [{ type: 'text', text: `Virtual experience updated. ID: ${data.id ?? id}` }] };
});
// --- LEARNING PATHS ---
server.tool('list_learning_paths', 'List all learning paths created by the instructor.', {}, async () => {
    const data = await supabaseQuery('learning_paths', 'id, title, status, item_ids, cohort_ids, created_at');
    const formatted = data.map((p) => `• ${p.title} [${p.status}] -- ID: ${p.id} -- ${p.item_ids?.length ?? 0} items`).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No learning paths found.' }] };
});
server.tool('get_learning_path', 'Get the full content of a learning path by ID, including all item IDs and assigned cohorts.', {
    id: z.string().describe('Learning path ID -- if you only have a name, call list_learning_paths first to resolve it'),
}, async ({ id }) => {
    const rows = await supabaseQuery('learning_paths', 'id, title, description, status, item_ids, cohort_ids, created_at');
    const data = rows.find((r) => r.id === id);
    if (!data)
        return { content: [{ type: 'text', text: `Learning path not found: ${id}` }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
});
server.tool('create_learning_path', 'Create a new learning path that groups courses and/or virtual experiences in order.', {
    title: z.string().describe('Learning path title'),
    description: z.string().optional().describe('Description of the path'),
    item_ids: z.array(z.string()).describe('Ordered list of course/VE IDs to include'),
    cohort_ids: z.array(z.string()).optional().describe('Cohort IDs to assign to'),
}, async ({ title, description, item_ids, cohort_ids }) => {
    const data = await apiCall('/api/learning-paths', {
        action: 'create',
        title,
        description: description ?? null,
        item_ids: item_ids ?? [],
        cohort_ids: cohort_ids ?? [],
        status: 'draft',
    });
    return { content: [{ type: 'text', text: `Learning path created.\nID: ${data.id}` }] };
});
server.tool('update_learning_path', 'Update an existing learning path by ID.', {
    id: z.string().describe('Learning path ID to update'),
    title: z.string().optional(),
    description: z.string().optional(),
    item_ids: z.array(z.string()).optional(),
    cohort_ids: z.array(z.string()).optional(),
    status: z.enum(['draft', 'published']).optional(),
}, async ({ id, title, description, item_ids, cohort_ids, status }) => {
    await apiCall('/api/learning-paths', {
        action: 'update',
        id,
        title,
        description,
        item_ids,
        cohort_ids,
        status,
    });
    return { content: [{ type: 'text', text: `Learning path updated. ID: ${id}` }] };
});
// --- BUNNY VIDEO IMPORT ---
const BUNNY_API_KEY = process.env.BUNNY_API_KEY ?? '';
const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID ?? '';
async function bunnyGet(path) {
    if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID)
        throw new Error('BUNNY_API_KEY and BUNNY_LIBRARY_ID are required');
    const res = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}${path}`, {
        headers: { AccessKey: BUNNY_API_KEY, accept: 'application/json' },
    });
    if (!res.ok)
        throw new Error(`Bunny API error ${res.status}`);
    return res.json();
}
server.tool('list_bunny_collections', 'List all video collections (folders) in the Bunny.net video library. Use this to find the collection ID before importing videos.', {}, async () => {
    const data = await bunnyGet('/collections?page=1&itemsPerPage=100&orderBy=name');
    const items = data.items ?? [];
    if (!items.length)
        return { content: [{ type: 'text', text: 'No collections found.' }] };
    const formatted = items.map((c) => `• ${c.name} -- ID: ${c.guid} -- ${c.videoCount ?? 0} videos`).join('\n');
    return { content: [{ type: 'text', text: formatted }] };
});
server.tool('list_bunny_videos', 'List all videos in a Bunny.net collection (folder) in title order. Use this to preview video titles and order before creating a course.', {
    collection_id: z.string().describe('Bunny collection ID -- get this from list_bunny_collections'),
}, async ({ collection_id }) => {
    let page = 1;
    let allVideos = [];
    while (true) {
        const data = await bunnyGet(`/videos?page=${page}&itemsPerPage=100&collection=${collection_id}&orderBy=title`);
        const items = data.items ?? [];
        allVideos = allVideos.concat(items);
        if (allVideos.length >= (data.totalItems ?? 0) || items.length < 100)
            break;
        page++;
    }
    if (!allVideos.length)
        return { content: [{ type: 'text', text: 'No videos found in this collection.' }] };
    const sorted = allVideos.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { numeric: true, sensitivity: 'base' }));
    const formatted = sorted.map((v, i) => `${i + 1}. ${v.title} (${Math.round((v.length ?? 0) / 60)}m)`).join('\n');
    return { content: [{ type: 'text', text: `${sorted.length} videos:\n\n${formatted}` }] };
});
server.tool('create_course_from_bunny', 'Fetch all videos from a Bunny.net collection (folder) in order and create a course. Each video becomes a lesson slide. If comprehension_questions are provided, they are interleaved after each video slide -- one entry per video in the same order.', {
    collection_id: z.string().describe('Bunny collection (folder) ID -- get this from list_bunny_collections'),
    title: z.string().describe('Course title'),
    description: z.string().optional().describe('Course description'),
    cohort_ids: z.array(z.string()).optional().describe('Cohort IDs to assign to'),
    passmark: z.number().min(1).max(100).optional().describe('Pass percentage (default 50)'),
    deadline_days: z.number().optional(),
    theme: z.enum(['forest', 'lime', 'emerald', 'rose', 'amber']).optional(),
    mode: z.enum(['dark', 'light', 'auto']).optional(),
    learn_outcomes: z.array(z.string()).optional().describe('What students will learn'),
    comprehension_questions: z.array(z.array(z.object({
        question: z.string(),
        options: z.array(z.string()),
        correct: z.number().describe('Index of correct option (0-based)'),
        explanation: z.string().optional(),
    }))).optional().describe('Array of question sets -- one array per video, in the same order as the videos. Each set is placed after its video slide.'),
}, async ({ collection_id, title, description, cohort_ids, passmark, deadline_days, theme, mode, learn_outcomes, comprehension_questions }) => {
    // Fetch all videos sorted by sortIndex, then by title as fallback
    // Fetch all pages so no videos are missed
    let page = 1;
    let allVideos = [];
    while (true) {
        const data = await bunnyGet(`/videos?page=${page}&itemsPerPage=100&collection=${collection_id}&orderBy=title`);
        const items = data.items ?? [];
        allVideos = allVideos.concat(items);
        if (allVideos.length >= (data.totalItems ?? 0) || items.length < 100)
            break;
        page++;
    }
    const videos = allVideos.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { numeric: true, sensitivity: 'base' }));
    if (!videos.length)
        return { content: [{ type: 'text', text: 'No videos found in this collection.' }] };
    // Build slides: video lesson + optional questions after each
    const slides = [];
    videos.forEach((v, i) => {
        // Lesson slide
        slides.push({
            question: '',
            options: [],
            correct: 0,
            lessonOnly: true,
            lesson: {
                title: v.title ?? `Lesson ${i + 1}`,
                body: '',
                videoUrl: `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${v.guid}?autoplay=false`,
            },
        });
        // Comprehension questions for this video (if provided)
        const qs = comprehension_questions?.[i] ?? [];
        for (const q of qs) {
            slides.push({
                question: q.question,
                options: q.options,
                correct: q.correct,
                correctAnswer: q.options[q.correct] ?? '',
                explanation: q.explanation ?? '',
            });
        }
    });
    const courseData = await apiCall('/api/forms', {
        title,
        description: description ?? null,
        cohort_ids: cohort_ids ?? [],
        deadline_days: deadline_days ?? null,
        status: 'draft',
        config: {
            isCourse: true,
            questions: slides,
            passmark: passmark ?? 50,
            learnOutcomes: learn_outcomes ?? [],
            theme: theme ?? 'forest',
            mode: mode ?? 'dark',
        },
    });
    const totalQ = slides.filter((s) => !s.lessonOnly).length;
    const summary = videos.map((v, i) => {
        const qCount = comprehension_questions?.[i]?.length ?? 0;
        return `  ${i + 1}. ${v.title}${qCount ? ` (+ ${qCount} questions)` : ''}`;
    }).join('\n');
    return { content: [{ type: 'text', text: `Course created.\nID: ${courseData.id}\nSlug: ${courseData.slug}\n${videos.length} videos · ${totalQ} questions\n\n${summary}` }] };
});
// --- START SERVER ---
const transport = new StdioServerTransport();
await server.connect(transport);
