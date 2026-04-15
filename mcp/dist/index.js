import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { apiCall, supabaseQuery, supabaseRun, getToken } from './api.js';
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
server.tool('create_course', 'Create a new course with questions and optional lesson content. No Bunny video required -- use this for text-based courses or when you already have video URLs. Use create_course_from_bunny only when building a course directly from a Bunny video collection.', {
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
    points_enabled: z.boolean().optional().describe('Enable XP reward points for this course'),
    points_base: z.number().optional().describe('Base XP points per question (default 100)'),
}, async ({ title, description, questions, cohort_ids, passmark, deadline_days, learn_outcomes, theme, mode, points_enabled, points_base }) => {
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
            pointsEnabled: points_enabled ?? false,
            pointsBase: points_base ?? 100,
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
    points_enabled: z.boolean().optional().describe('Enable XP reward points'),
    points_base: z.number().optional().describe('Base XP points per question (default 100)'),
}, async ({ id, title, description, questions, cohort_ids, passmark, deadline_days, status, learn_outcomes, theme, mode, points_enabled, points_base }) => {
    // Fetch current state so unset fields are not wiped
    const cur = await supabaseRun(sb => sb.from('courses').select('title, description, cohort_ids, deadline_days, status, questions, passmark, learn_outcomes, theme, mode, points_enabled, points_base').eq('id', id).single());
    await apiCall('/api/forms', {
        id,
        title: title ?? cur.title,
        description: description ?? cur.description,
        cohort_ids: cohort_ids ?? cur.cohort_ids,
        deadline_days: deadline_days ?? cur.deadline_days,
        status: status ?? cur.status,
        config: {
            isCourse: true,
            questions: questions ?? cur.questions,
            passmark: passmark ?? cur.passmark,
            learnOutcomes: learn_outcomes ?? cur.learn_outcomes,
            theme: theme ?? cur.theme,
            mode: mode ?? cur.mode,
            pointsEnabled: points_enabled ?? cur.points_enabled,
            pointsBase: points_base ?? cur.points_base,
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
    theme: z.enum(['forest', 'lime', 'emerald', 'rose', 'amber']).optional().describe('Color theme (default: forest)'),
    mode: z.enum(['dark', 'light', 'auto']).optional().describe('Display mode (default: dark)'),
}, async ({ title, tagline, industry, difficulty, role, company, duration, tools, modules, learn_outcomes, cohort_ids, deadline_days, theme, mode }) => {
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
            theme: theme ?? 'forest',
            mode: mode ?? 'dark',
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
    theme: z.enum(['forest', 'lime', 'emerald', 'rose', 'amber']).optional(),
    mode: z.enum(['dark', 'light', 'auto']).optional(),
}, async ({ id, title, tagline, industry, difficulty, role, company, duration, tools, modules, learn_outcomes, cohort_ids, deadline_days, status, theme, mode }) => {
    // Fetch current state so unset fields are not wiped
    const cur = await supabaseRun(sb => sb.from('virtual_experiences').select('title, cohort_ids, deadline_days, status, tagline, industry, difficulty, role, company, duration, tools, modules, learn_outcomes, theme, mode').eq('id', id).single());
    const data = await apiCall('/api/guided-project-save', {
        editId: id,
        title: title ?? cur.title,
        cohort_ids: cohort_ids ?? cur.cohort_ids,
        deadline_days: deadline_days ?? cur.deadline_days,
        status: status ?? cur.status,
        config: {
            tagline: tagline ?? cur.tagline,
            industry: industry ?? cur.industry,
            difficulty: difficulty ?? cur.difficulty,
            role: role ?? cur.role,
            company: company ?? cur.company,
            duration: duration ?? cur.duration,
            tools: tools ?? cur.tools,
            modules: modules ?? cur.modules,
            learnOutcomes: learn_outcomes ?? cur.learn_outcomes,
            theme: theme ?? cur.theme,
            mode: mode ?? cur.mode,
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
    // Fetch current state so unset fields are not wiped
    const cur = await supabaseRun(sb => sb.from('learning_paths').select('title, description, item_ids, cohort_ids, status').eq('id', id).single());
    await apiCall('/api/learning-paths', {
        action: 'update',
        id,
        title: title ?? cur.title,
        description: description ?? cur.description,
        item_ids: item_ids ?? cur.item_ids,
        cohort_ids: cohort_ids ?? cur.cohort_ids,
        status: status ?? cur.status,
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
    points_enabled: z.boolean().optional().describe('Enable XP reward points'),
    points_base: z.number().optional().describe('Base XP points per question (default 100)'),
    comprehension_questions: z.array(z.array(z.object({
        question: z.string(),
        options: z.array(z.string()),
        correct: z.number().describe('Index of correct option (0-based)'),
        explanation: z.string().optional(),
    }))).optional().describe('Array of question sets -- one array per video, in the same order as the videos. Each set is placed after its video slide.'),
}, async ({ collection_id, title, description, cohort_ids, passmark, deadline_days, theme, mode, learn_outcomes, points_enabled, points_base, comprehension_questions }) => {
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
            pointsEnabled: points_enabled ?? false,
            pointsBase: points_base ?? 100,
        },
    });
    const totalQ = slides.filter((s) => !s.lessonOnly).length;
    const summary = videos.map((v, i) => {
        const qCount = comprehension_questions?.[i]?.length ?? 0;
        return `  ${i + 1}. ${v.title}${qCount ? ` (+ ${qCount} questions)` : ''}`;
    }).join('\n');
    return { content: [{ type: 'text', text: `Course created.\nID: ${courseData.id}\nSlug: ${courseData.slug}\n${videos.length} videos · ${totalQ} questions\n\n${summary}` }] };
});
// --- INSTRUCTOR TIME-SAVERS ---
server.tool('clone_course', 'Duplicate an existing course with a new title. All questions, lessons, settings, and passmark are copied. The clone is created as a draft.', {
    id: z.string().describe('Course ID to clone -- if you only have a name, call list_courses first'),
    title: z.string().describe('Title for the new cloned course'),
}, async ({ id, title }) => {
    const cur = await supabaseRun(sb => sb.from('courses').select('description, cohort_ids, deadline_days, questions, passmark, learn_outcomes, theme, mode, points_enabled, points_base').eq('id', id).single());
    const data = await apiCall('/api/forms', {
        title,
        description: cur.description,
        cohort_ids: [],
        deadline_days: cur.deadline_days,
        status: 'draft',
        config: {
            isCourse: true,
            questions: cur.questions ?? [],
            passmark: cur.passmark ?? 50,
            learnOutcomes: cur.learn_outcomes ?? [],
            theme: cur.theme ?? 'forest',
            mode: cur.mode ?? 'dark',
            pointsEnabled: cur.points_enabled ?? false,
            pointsBase: cur.points_base ?? 100,
        },
    });
    return { content: [{ type: 'text', text: `Course cloned.\nNew ID: ${data.id}\nSlug: ${data.slug}\nStatus: draft (no cohorts assigned)` }] };
});
server.tool('send_announcement', 'Create and publish an announcement to one or more cohorts. Appears in the student dashboard feed.', {
    title: z.string().describe('Announcement title'),
    content: z.string().describe('Announcement body text (plain text or HTML)'),
    cohort_ids: z.array(z.string()).describe('Cohort IDs to send to -- call list_cohorts to resolve names'),
    is_pinned: z.boolean().optional().describe('Pin to the top of the feed (default false)'),
    expires_at: z.string().optional().describe('ISO date when announcement expires, e.g. "2025-12-31"'),
}, async ({ title, content, cohort_ids, is_pinned, expires_at }) => {
    const token = await getToken();
    // Get instructor user id from token
    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = process.env.MCP_SUPABASE_URL ?? '';
    const SUPABASE_KEY = process.env.MCP_SUPABASE_ANON_KEY ?? '';
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    await sb.auth.setSession({ access_token: token, refresh_token: '' });
    const { data: { user } } = await sb.auth.getUser();
    if (!user)
        throw new Error('Not authenticated');
    await supabaseRun(s => s.from('announcements').insert({
        title: title.trim(),
        content: content.trim(),
        cohort_ids: cohort_ids ?? [],
        is_pinned: is_pinned ?? false,
        published_at: new Date().toISOString(),
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
        author_id: user.id,
    }).select('id').single());
    return { content: [{ type: 'text', text: `Announcement sent to ${cohort_ids.length} cohort(s): "${title}"` }] };
});
server.tool('send_bulk_message', 'Send a custom email to a segment of students. Use {{name}} in the message body to personalise each email. ALWAYS run with dry_run: true first to confirm recipient count before sending. Only set dry_run: false when the user explicitly confirms they want to send.', {
    subject: z.string().describe('Email subject line'),
    message_body: z.string().describe('Email body. Use {{name}} for personalisation. Max 5000 chars.'),
    segment: z.enum(['all', 'not_started', 'in_progress', 'stalled', 'completed']).describe('Which students to target'),
    cohort_id: z.string().optional().describe('Limit to a specific cohort ID, or omit for all cohorts'),
    form_id: z.string().optional().describe('Limit to a specific course/VE ID, or omit for all content'),
    dry_run: z.boolean().optional().describe('DEFAULT true. Returns recipient count and a sample of names without sending. Set to false only when the user explicitly confirms they want the email sent.'),
}, async ({ subject, message_body, segment, cohort_id, form_id, dry_run = true }) => {
    if (dry_run) {
        // Count recipients in the MCP without touching the send API
        const [coursesRaw, vesRaw] = await Promise.all([
            supabaseQuery('courses', 'id, title, cohort_ids'),
            supabaseQuery('virtual_experiences', 'id, title, cohort_ids'),
        ]);
        let content = [
            ...(coursesRaw ?? []),
            ...(vesRaw ?? []),
        ];
        if (form_id)
            content = content.filter(c => c.id === form_id);
        const allCohortIds = [...new Set(content.flatMap(c => Array.isArray(c.cohort_ids) ? c.cohort_ids : []))];
        const activeCohortIds = cohort_id ? allCohortIds.filter(id => id === cohort_id) : allCohortIds;
        if (!activeCohortIds.length)
            return { content: [{ type: 'text', text: 'No cohorts found for this content.' }] };
        const students = await supabaseRun(sb => sb.from('students').select('id, full_name, email, cohort_id').in('cohort_id', activeCohortIds).eq('role', 'student'));
        if (!students?.length)
            return { content: [{ type: 'text', text: 'No students found.' }] };
        let recipients = students;
        if (segment !== 'all') {
            const contentIds = content.map(c => c.id);
            const [courseAttempts, gpAttempts] = await Promise.all([
                supabaseRun(sb => sb.from('course_attempts').select('student_id, course_id, completed_at, updated_at').in('course_id', contentIds)),
                supabaseRun(sb => sb.from('guided_project_attempts').select('student_id, ve_id, completed_at, updated_at').in('ve_id', contentIds)),
            ]);
            const STALL_DAYS = 7;
            const attemptMap = new Map();
            for (const a of [...(courseAttempts ?? []), ...(gpAttempts ?? [])]) {
                const contentId = a.course_id ?? a.ve_id;
                const key = `${a.student_id}|${contentId}`;
                const ex = attemptMap.get(key);
                if (!ex || a.updated_at > ex.lastActive) {
                    attemptMap.set(key, { completed: !!a.completed_at, lastActive: a.updated_at });
                }
            }
            const seen = new Set();
            recipients = [];
            for (const item of content) {
                const itemStudents = students.filter((s) => (Array.isArray(item.cohort_ids) ? item.cohort_ids : []).includes(s.cohort_id));
                for (const s of itemStudents) {
                    if (seen.has(s.email))
                        continue;
                    const attempt = attemptMap.get(`${s.id}|${item.id}`);
                    let status;
                    if (!attempt)
                        status = 'not_started';
                    else if (attempt.completed)
                        status = 'completed';
                    else {
                        const days = Math.floor((Date.now() - new Date(attempt.lastActive).getTime()) / 86400000);
                        status = days >= STALL_DAYS ? 'stalled' : 'in_progress';
                    }
                    if (status !== segment)
                        continue;
                    seen.add(s.email);
                    recipients.push(s);
                }
            }
        }
        if (!recipients.length)
            return { content: [{ type: 'text', text: `No students match segment "${segment}".` }] };
        const sample = recipients.slice(0, 5).map((r) => `${r.full_name ?? 'Unknown'} <${r.email}>`).join('\n  ');
        return { content: [{ type: 'text', text: `Dry run — would send to ${recipients.length} student(s) in segment "${segment}".\n\nSample:\n  ${sample}\n\nCall again with dry_run: false to actually send.` }] };
    }
    // Actually send
    const data = await apiCall('/api/bulk-message', {
        subject,
        messageBody: message_body,
        segment,
        cohortId: cohort_id ?? 'all',
        formId: form_id ?? null,
    });
    return { content: [{ type: 'text', text: `Bulk message sent. Recipients: ${data.sent}` }] };
});
server.tool('nudge_cohort', 'Send motivational nudge emails to students who have not started or are stalled on a course. Only contacts students matching those statuses.', {
    course_id: z.string().describe('Course ID -- call list_courses to resolve name'),
    cohort_id: z.string().describe('Cohort ID -- call list_cohorts to resolve name'),
    status: z.enum(['not_started', 'stalled']).describe('"not_started" for students who never opened the course, "stalled" for those who started but stopped'),
}, async ({ course_id, cohort_id, status }) => {
    // Get all students in cohort
    const students = await supabaseRun(sb => sb.from('students').select('id, full_name, email').eq('cohort_id', cohort_id).eq('role', 'student'));
    if (!students?.length)
        return { content: [{ type: 'text', text: 'No students in this cohort.' }] };
    // Get attempts for this course
    const attempts = await supabaseRun(sb => sb.from('course_attempts').select('student_id, completed_at, updated_at').eq('course_id', course_id));
    const attemptMap = new Map();
    for (const a of attempts ?? []) {
        const existing = attemptMap.get(a.student_id);
        if (!existing || (a.updated_at && a.updated_at > (existing.lastActive ?? ''))) {
            attemptMap.set(a.student_id, { completed: !!a.completed_at, lastActive: a.updated_at });
        }
    }
    const STALL_DAYS = 7;
    const targets = students.filter((s) => {
        const attempt = attemptMap.get(s.id);
        if (status === 'not_started')
            return !attempt;
        if (status === 'stalled') {
            if (!attempt || attempt.completed)
                return false;
            const days = Math.floor((Date.now() - new Date(attempt.lastActive).getTime()) / 86400000);
            return days >= STALL_DAYS;
        }
        return false;
    });
    if (!targets.length)
        return { content: [{ type: 'text', text: `No ${status.replace('_', ' ')} students found for this course.` }] };
    // Check sent_nudges — skip students nudged by instructor in the last 7 days for this course
    const NUDGE_COOLDOWN_DAYS = 7;
    const cooloffCutoff = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 86400000).toISOString();
    const targetIds = targets.map((s) => s.id);
    const recentNudges = await supabaseRun(sb => sb.from('sent_nudges').select('student_id')
        .eq('form_id', course_id)
        .eq('nudge_type', 'instructor')
        .in('student_id', targetIds)
        .gte('sent_at', cooloffCutoff));
    const recentlyNudged = new Set((recentNudges ?? []).map((n) => n.student_id));
    const eligible = targets.filter((s) => !recentlyNudged.has(s.id));
    const skipped = targets.length - eligible.length;
    if (!eligible.length) {
        return { content: [{ type: 'text', text: `All ${targets.length} ${status.replace('_', ' ')} student(s) were already nudged in the last ${NUDGE_COOLDOWN_DAYS} days. No emails sent.` }] };
    }
    // Send in parallel batches of 10
    let nudged = 0;
    const nudgeRecords = [];
    for (let i = 0; i < eligible.length; i += 10) {
        const batch = eligible.slice(i, i + 10);
        const results = await Promise.allSettled(batch.map((s) => apiCall('/api/nudge-student', {
            studentEmail: s.email,
            studentName: s.full_name ?? '',
            formId: course_id,
            status,
        })));
        for (let j = 0; j < results.length; j++) {
            if (results[j].status === 'fulfilled') {
                nudged++;
                nudgeRecords.push({ student_id: batch[j].id, form_id: course_id, nudge_type: 'instructor' });
            }
        }
    }
    // Record sent nudges to prevent duplicates
    if (nudgeRecords.length) {
        await supabaseRun(sb => sb.from('sent_nudges').insert(nudgeRecords).select('id').limit(1));
    }
    const parts = [`Nudge sent to ${nudged} of ${eligible.length} eligible student(s).`];
    if (skipped)
        parts.push(`${skipped} skipped (nudged within the last ${NUDGE_COOLDOWN_DAYS} days).`);
    return { content: [{ type: 'text', text: parts.join(' ') }] };
});
server.tool('list_students_at_risk', 'List students in a cohort who have not started or are stalled (no activity in 7+ days) on any assigned course.', {
    cohort_id: z.string().describe('Cohort ID -- call list_cohorts to resolve name'),
}, async ({ cohort_id }) => {
    const students = await supabaseRun(sb => sb.from('students').select('id, full_name, email').eq('cohort_id', cohort_id).eq('role', 'student'));
    if (!students?.length)
        return { content: [{ type: 'text', text: 'No students in this cohort.' }] };
    const courses = await supabaseRun(sb => sb.from('courses').select('id, title').contains('cohort_ids', [cohort_id]));
    if (!courses?.length)
        return { content: [{ type: 'text', text: 'No courses assigned to this cohort.' }] };
    const courseIds = courses.map((c) => c.id);
    const studentIds = students.map((s) => s.id);
    const attempts = await supabaseRun(sb => sb.from('course_attempts').select('student_id, course_id, completed_at, updated_at')
        .in('course_id', courseIds).in('student_id', studentIds));
    const STALL_DAYS = 7;
    const lines = [];
    for (const student of students) {
        const studentAttempts = (attempts ?? []).filter((a) => a.student_id === student.id);
        const notStarted = [];
        const stalled = [];
        for (const course of courses) {
            const courseAttempts = studentAttempts.filter((a) => a.course_id === course.id);
            if (!courseAttempts.length) {
                notStarted.push(course.title);
                continue;
            }
            const completed = courseAttempts.some((a) => a.completed_at);
            if (completed)
                continue;
            const lastActive = courseAttempts.reduce((latest, a) => a.updated_at > latest ? a.updated_at : latest, '');
            const days = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000);
            if (days >= STALL_DAYS)
                stalled.push(`${course.title} (${days}d ago)`);
        }
        if (notStarted.length || stalled.length) {
            lines.push(`\n${student.full_name} <${student.email}>`);
            if (notStarted.length)
                lines.push(`  Not started: ${notStarted.join(', ')}`);
            if (stalled.length)
                lines.push(`  Stalled: ${stalled.join(', ')}`);
        }
    }
    if (!lines.length)
        return { content: [{ type: 'text', text: 'No at-risk students found.' }] };
    return { content: [{ type: 'text', text: `At-risk students (${cohort_id}):\n${lines.join('\n')}` }] };
});
server.tool('create_assignment', 'Create a new assignment and assign it to one or more cohorts.', {
    title: z.string().describe('Assignment title'),
    scenario: z.string().optional().describe('Business scenario / background context for the student'),
    brief: z.string().optional().describe('The assignment brief — what it is about'),
    tasks: z.string().optional().describe('Step-by-step tasks for the student'),
    requirements: z.string().optional().describe('Deliverables and submission requirements'),
    submission_instructions: z.string().optional().describe('How to submit'),
    related_course: z.string().optional().describe('Course ID this assignment is linked to'),
    cohort_ids: z.array(z.string()).optional().describe('Cohort IDs to assign to'),
    status: z.enum(['draft', 'published']).optional().describe('Default: draft'),
}, async ({ title, scenario, brief, tasks, requirements, submission_instructions, related_course, cohort_ids, status }) => {
    const token = await getToken();
    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = process.env.MCP_SUPABASE_URL ?? '';
    const SUPABASE_KEY = process.env.MCP_SUPABASE_ANON_KEY ?? '';
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    await sb.auth.setSession({ access_token: token, refresh_token: '' });
    const { data: { user } } = await sb.auth.getUser();
    if (!user)
        throw new Error('Not authenticated');
    const data = await supabaseRun(s => s.from('assignments').insert({
        title: title.trim(),
        scenario: scenario ?? null,
        brief: brief ?? null,
        tasks: tasks ?? null,
        requirements: requirements ?? null,
        submission_instructions: submission_instructions ?? null,
        related_course: related_course ?? null,
        cohort_ids: cohort_ids ?? [],
        status: status ?? 'draft',
        created_by: user.id,
    }).select('id').single());
    return { content: [{ type: 'text', text: `Assignment created.\nID: ${data.id}\nTitle: ${title}\nStatus: ${status ?? 'draft'}` }] };
});
server.tool('list_assignments', 'List all assignments created by the instructor.', {}, async () => {
    const data = await supabaseQuery('assignments', 'id, title, status, cohort_ids, related_course, created_at');
    const formatted = data.map((a) => `• ${a.title} [${a.status}] -- ID: ${a.id}${a.related_course ? ` -- course: ${a.related_course}` : ''}`).join('\n');
    return { content: [{ type: 'text', text: formatted || 'No assignments found.' }] };
});
server.tool('list_pending_submissions', 'List all ungraded assignment submissions. Use this to see what needs reviewing.', {
    assignment_id: z.string().optional().describe('Filter to a specific assignment ID, or omit for all assignments'),
}, async ({ assignment_id }) => {
    let rows;
    if (assignment_id) {
        rows = await supabaseRun(sb => sb.from('assignment_submissions')
            .select('id, assignment_id, student_id, text_response, submitted_at, students(full_name, email)')
            .eq('assignment_id', assignment_id)
            .is('graded_at', null)
            .not('submitted_at', 'is', null)
            .order('submitted_at', { ascending: true }));
    }
    else {
        rows = await supabaseRun(sb => sb.from('assignment_submissions')
            .select('id, assignment_id, student_id, text_response, submitted_at, assignments(title), students(full_name, email)')
            .is('graded_at', null)
            .not('submitted_at', 'is', null)
            .order('submitted_at', { ascending: true }));
    }
    if (!rows?.length)
        return { content: [{ type: 'text', text: 'No pending submissions.' }] };
    const formatted = rows.map((r) => {
        const name = r.students?.full_name ?? 'Unknown';
        const email = r.students?.email ?? '';
        const asgn = r.assignments?.title ?? assignment_id ?? r.assignment_id;
        const date = r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : 'unknown date';
        const preview = r.text_response ? `\n    "${r.text_response.slice(0, 120)}..."` : '';
        return `• [${r.id}] ${name} <${email}> -- "${asgn}" -- submitted ${date}${preview}`;
    }).join('\n\n');
    return { content: [{ type: 'text', text: `${rows.length} pending submission(s):\n\n${formatted}` }] };
});
server.tool('grade_submission', 'Grade a student assignment submission with a score and optional feedback.', {
    submission_id: z.string().describe('Submission ID from list_pending_submissions'),
    grade: z.number().min(0).max(100).describe('Score out of 100'),
    feedback: z.string().optional().describe('Written feedback shown to the student'),
}, async ({ submission_id, grade, feedback }) => {
    await supabaseRun(sb => sb.from('assignment_submissions').update({
        grade,
        feedback: feedback ?? null,
        graded_at: new Date().toISOString(),
        status: 'graded',
    }).eq('id', submission_id).select('id').single());
    return { content: [{ type: 'text', text: `Submission ${submission_id} graded: ${grade}/100` }] };
});
server.tool('get_student_report', 'Get a full profile for a student: XP, course completions, pass rates, assignments, certificates.', {
    student_email: z.string().describe('Student email address'),
}, async ({ student_email }) => {
    const students = await supabaseRun(sb => sb.from('students').select('id, full_name, email, cohort_id, role, created_at').eq('email', student_email.trim().toLowerCase()));
    const student = students?.[0];
    if (!student)
        return { content: [{ type: 'text', text: `No student found with email: ${student_email}` }] };
    const [xpRows, attempts, certs, submissions, cohortRows] = await Promise.all([
        supabaseRun(sb => sb.from('student_xp').select('total_xp').eq('student_id', student.id)),
        supabaseRun(sb => sb.from('course_attempts').select('course_id, completed_at, passed, score').eq('student_id', student.id).not('completed_at', 'is', null).order('completed_at', { ascending: false })),
        supabaseRun(sb => sb.from('certificates').select('id, course_id, issued_at').eq('student_id', student.id).eq('revoked', false)),
        supabaseRun(sb => sb.from('assignment_submissions').select('assignment_id, grade, graded_at, submitted_at').eq('student_id', student.id).not('submitted_at', 'is', null)),
        supabaseRun(sb => sb.from('cohorts').select('id, name').eq('id', student.cohort_id)),
    ]);
    const xp = xpRows?.[0]?.total_xp ?? 0;
    const cohort = cohortRows?.[0]?.name ?? student.cohort_id ?? 'Unknown';
    const completedAttempts = attempts ?? [];
    const totalCompleted = completedAttempts.length;
    const totalPassed = completedAttempts.filter((a) => a.passed).length;
    const avgScore = totalCompleted
        ? Math.round(completedAttempts.reduce((sum, a) => sum + (a.score ?? 0), 0) / totalCompleted)
        : 0;
    const certsCount = certs?.length ?? 0;
    const submCount = submissions?.length ?? 0;
    const gradedCount = submissions?.filter((s) => s.graded_at).length ?? 0;
    const avgGrade = gradedCount
        ? Math.round(submissions.filter((s) => s.graded_at && s.grade != null).reduce((sum, s) => sum + s.grade, 0) / gradedCount)
        : null;
    const lines = [
        `Student: ${student.full_name} <${student.email}>`,
        `Cohort: ${cohort}`,
        `Joined: ${student.created_at ? new Date(student.created_at).toLocaleDateString() : 'unknown'}`,
        ``,
        `XP: ${xp}`,
        `Courses completed: ${totalCompleted}  |  Passed: ${totalPassed}  |  Avg score: ${avgScore}%`,
        `Certificates earned: ${certsCount}`,
        `Assignments submitted: ${submCount}  |  Graded: ${gradedCount}${avgGrade != null ? `  |  Avg grade: ${avgGrade}/100` : ''}`,
    ];
    if (completedAttempts.length) {
        const courseIds = [...new Set(completedAttempts.map((a) => a.course_id))];
        const courseRows = await supabaseRun(sb => sb.from('courses').select('id, title').in('id', courseIds));
        const courseMap = {};
        for (const c of courseRows ?? [])
            courseMap[c.id] = c.title;
        lines.push('', 'Completed courses:');
        for (const a of completedAttempts.slice(0, 10)) {
            const title = courseMap[a.course_id] ?? a.course_id;
            const date = new Date(a.completed_at).toLocaleDateString();
            lines.push(`  • ${title} -- ${a.passed ? 'PASSED' : 'failed'} ${a.score ?? 0}% -- ${date}`);
        }
        if (completedAttempts.length > 10)
            lines.push(`  ... and ${completedAttempts.length - 10} more`);
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
});
// --- INNOVATIVE / AI-POWERED ---
server.tool('get_course_analytics', 'Get detailed analytics for a course: attempt count, completion rate, pass rate, average score, top scorers, and students who failed multiple times.', {
    course_id: z.string().describe('Course ID -- call list_courses to resolve name'),
}, async ({ course_id }) => {
    const [courseRows, attempts] = await Promise.all([
        supabaseRun(sb => sb.from('courses').select('title, passmark, cohort_ids').eq('id', course_id).single()),
        supabaseRun(sb => sb.from('course_attempts').select('student_id, completed_at, passed, score').eq('course_id', course_id)),
    ]);
    const course = courseRows;
    if (!course?.title)
        return { content: [{ type: 'text', text: `Course not found: ${course_id}` }] };
    const allAttempts = attempts ?? [];
    const completed = allAttempts.filter((a) => a.completed_at);
    const inProgress = allAttempts.filter((a) => !a.completed_at);
    const passed = completed.filter((a) => a.passed);
    const failed = completed.filter((a) => !a.passed);
    const uniqueStudents = new Set(allAttempts.map((a) => a.student_id)).size;
    const avgScore = completed.length
        ? Math.round(completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length)
        : 0;
    // Students who failed 2+ times with no pass
    const studentAttempts = {};
    for (const a of completed) {
        if (!studentAttempts[a.student_id])
            studentAttempts[a.student_id] = { fails: 0, passed: false };
        if (a.passed)
            studentAttempts[a.student_id].passed = true;
        else
            studentAttempts[a.student_id].fails++;
    }
    const repeatedFails = Object.values(studentAttempts).filter(s => s.fails >= 2 && !s.passed).length;
    // Top scorers
    const topScores = [...completed]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5)
        .map((a) => a.score ?? 0);
    const studentIds = Object.keys(studentAttempts).slice(0, 5);
    const topStudentRows = studentIds.length
        ? await supabaseRun(sb => sb.from('students').select('id, full_name').in('id', [...completed].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5).map((a) => a.student_id)))
        : [];
    const lines = [
        `Course: ${course.title}`,
        `Passmark: ${course.passmark ?? 50}%`,
        ``,
        `Unique students: ${uniqueStudents}`,
        `In progress:     ${inProgress.length}`,
        `Completed:       ${completed.length}`,
        `Passed:          ${passed.length} (${completed.length ? Math.round(passed.length / completed.length * 100) : 0}%)`,
        `Failed:          ${failed.length}`,
        `Avg score:       ${avgScore}%`,
        `Repeat failures: ${repeatedFails} student(s) failed 2+ times without passing`,
        `Top 5 scores:    ${topScores.join('%, ')}%`,
    ];
    return { content: [{ type: 'text', text: lines.join('\n') }] };
});
server.tool('analyze_cohort_performance', 'Analyze a cohort across all assigned courses. Returns completion rates, pass rates, engagement gaps, and flags underperforming content. Use this to spot where students are struggling and what action to take.', {
    cohort_id: z.string().describe('Cohort ID -- call list_cohorts to resolve name'),
}, async ({ cohort_id }) => {
    const [students, courses] = await Promise.all([
        supabaseRun(sb => sb.from('students').select('id').eq('cohort_id', cohort_id).eq('role', 'student')),
        supabaseRun(sb => sb.from('courses').select('id, title, passmark').contains('cohort_ids', [cohort_id])),
    ]);
    const studentCount = students?.length ?? 0;
    if (!studentCount)
        return { content: [{ type: 'text', text: 'No students in this cohort.' }] };
    if (!courses?.length)
        return { content: [{ type: 'text', text: 'No courses assigned to this cohort.' }] };
    const courseIds = courses.map((c) => c.id);
    const studentIds = students.map((s) => s.id);
    const attempts = await supabaseRun(sb => sb.from('course_attempts').select('student_id, course_id, completed_at, passed, score')
        .in('course_id', courseIds).in('student_id', studentIds));
    const lines = [`Cohort performance — ${studentCount} students\n`];
    const flags = [];
    for (const course of courses) {
        const courseAttempts = attempts.filter((a) => a.course_id === course.id);
        const started = new Set(courseAttempts.map((a) => a.student_id)).size;
        const completedAll = courseAttempts.filter((a) => a.completed_at);
        const passedAll = completedAll.filter((a) => a.passed);
        const notStarted = studentCount - started;
        const avgScore = completedAll.length
            ? Math.round(completedAll.reduce((s, a) => s + (a.score ?? 0), 0) / completedAll.length)
            : 0;
        const compRate = Math.round(completedAll.length / studentCount * 100);
        const passRate = completedAll.length ? Math.round(passedAll.length / completedAll.length * 100) : 0;
        lines.push(`${course.title}`);
        lines.push(`  Not started: ${notStarted}  |  Completed: ${completedAll.length}/${studentCount} (${compRate}%)  |  Pass rate: ${passRate}%  |  Avg score: ${avgScore}%`);
        if (notStarted > studentCount * 0.5)
            flags.push(`⚠ "${course.title}": ${notStarted} students (${Math.round(notStarted / studentCount * 100)}%) haven't started`);
        if (passRate < 50 && completedAll.length >= 3)
            flags.push(`⚠ "${course.title}": low pass rate (${passRate}%) — questions may be too hard or lessons unclear`);
        if (avgScore < 40 && completedAll.length >= 3)
            flags.push(`⚠ "${course.title}": avg score ${avgScore}% — consider reviewing content difficulty`);
    }
    if (flags.length) {
        lines.push('', '--- Flags ---');
        lines.push(...flags);
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
});
server.tool('suggest_course_improvements', 'Analyse a course and return specific suggestions: questions with very high failure rates, missing explanations, lesson-less questions, and passmark calibration. The output is designed to be actioned directly.', {
    course_id: z.string().describe('Course ID -- call list_courses to resolve name'),
}, async ({ course_id }) => {
    const [courseRows, attempts] = await Promise.all([
        supabaseRun(sb => sb.from('courses').select('title, questions, passmark').eq('id', course_id).single()),
        supabaseRun(sb => sb.from('course_attempts').select('answers, score, passed').eq('course_id', course_id).not('completed_at', 'is', null)),
    ]);
    const course = courseRows;
    if (!course?.title)
        return { content: [{ type: 'text', text: `Course not found: ${course_id}` }] };
    const questions = course.questions ?? [];
    const completedAttempts = attempts ?? [];
    const suggestions = [];
    // Missing explanations
    const noExplanation = questions.filter((q) => !q.lessonOnly && !q.explanation?.trim());
    if (noExplanation.length) {
        suggestions.push(`Missing explanations (${noExplanation.length} questions): students get no feedback when they answer wrong.`);
        suggestions.push(`  Add explanations to: ${noExplanation.slice(0, 5).map((q) => `"${(q.question ?? '').slice(0, 60)}"`).join(', ')}${noExplanation.length > 5 ? ` (+${noExplanation.length - 5} more)` : ''}`);
    }
    // Questions with no lesson content
    const noLesson = questions.filter((q) => !q.lessonOnly && !q.lesson?.body?.trim() && !q.lesson?.videoUrl);
    if (noLesson.length > questions.length * 0.7) {
        suggestions.push(`Only ${questions.length - noLesson.length} of ${questions.length} questions have lesson content. Adding lessons improves completion rates.`);
    }
    // Short/vague questions
    const vague = questions.filter((q) => !q.lessonOnly && (q.question ?? '').length < 20);
    if (vague.length) {
        suggestions.push(`${vague.length} question(s) are very short (under 20 chars) — consider making them clearer.`);
    }
    // Per-question wrong answer analysis from stored answers
    if (completedAttempts.length >= 5) {
        const wrongCounts = {};
        const totalByQ = {};
        for (const attempt of completedAttempts) {
            const answers = attempt.answers ?? {};
            for (const [qId, chosen] of Object.entries(answers)) {
                const q = questions.find((q) => q.id === qId);
                if (!q || q.lessonOnly)
                    continue;
                totalByQ[qId] = (totalByQ[qId] ?? 0) + 1;
                if (chosen !== q.correctAnswer && chosen !== q.correct) {
                    wrongCounts[qId] = (wrongCounts[qId] ?? 0) + 1;
                }
            }
        }
        const hardQuestions = Object.entries(wrongCounts)
            .map(([id, wrong]) => ({ id, wrong, total: totalByQ[id] ?? 1, rate: wrong / (totalByQ[id] ?? 1) }))
            .filter(q => q.rate >= 0.6 && q.total >= 3)
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 5);
        if (hardQuestions.length) {
            suggestions.push(`High failure-rate questions (60%+ wrong):`);
            for (const hq of hardQuestions) {
                const q = questions.find((q) => q.id === hq.id);
                const text = (q?.question ?? '').slice(0, 80);
                suggestions.push(`  • "${text}" — ${Math.round(hq.rate * 100)}% got it wrong (${hq.wrong}/${hq.total} attempts)`);
            }
        }
    }
    // Passmark calibration
    if (completedAttempts.length >= 5) {
        const avgScore = Math.round(completedAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / completedAttempts.length);
        const passRate = Math.round(completedAttempts.filter((a) => a.passed).length / completedAttempts.length * 100);
        if (passRate < 40)
            suggestions.push(`Pass rate is ${passRate}% with passmark at ${course.passmark ?? 50}% — consider lowering the passmark or simplifying questions.`);
        if (passRate > 95 && completedAttempts.length >= 10)
            suggestions.push(`Pass rate is ${passRate}% — course may be too easy. Consider raising the passmark or adding harder questions.`);
        suggestions.push(`Avg score: ${avgScore}% across ${completedAttempts.length} completions.`);
    }
    if (!suggestions.length) {
        return { content: [{ type: 'text', text: `"${course.title}" looks good — no obvious issues found.` }] };
    }
    return { content: [{ type: 'text', text: `Improvement suggestions for "${course.title}":\n\n${suggestions.join('\n')}` }] };
});
server.tool('build_learning_path_for_skill', 'Find all courses and virtual experiences related to a skill or topic and create a learning path from them. Returns the matched content for review before creating.', {
    skill: z.string().describe('Skill or topic to build a path for, e.g. "Python", "Data Analysis", "Project Management"'),
    title: z.string().describe('Learning path title'),
    description: z.string().optional().describe('Learning path description'),
    cohort_ids: z.array(z.string()).optional().describe('Cohort IDs to assign to'),
    auto_create: z.boolean().optional().describe('If true, create the learning path immediately. If false (default), return the matched items for review first.'),
}, async ({ skill, title, description, cohort_ids, auto_create }) => {
    const term = skill.toLowerCase();
    const [courses, ves] = await Promise.all([
        supabaseRun(sb => sb.from('courses').select('id, title, description, status')),
        supabaseRun(sb => sb.from('virtual_experiences').select('id, title, tagline, industry, status')),
    ]);
    const matchCourse = (c) => (c.title ?? '').toLowerCase().includes(term) ||
        (c.description ?? '').toLowerCase().includes(term);
    const matchVE = (v) => (v.title ?? '').toLowerCase().includes(term) ||
        (v.tagline ?? '').toLowerCase().includes(term) ||
        (v.industry ?? '').toLowerCase().includes(term);
    const matchedCourses = (courses ?? []).filter(matchCourse);
    const matchedVEs = (ves ?? []).filter(matchVE);
    const allMatched = [
        ...matchedCourses.map((c) => ({ id: c.id, title: c.title, type: 'course', status: c.status })),
        ...matchedVEs.map((v) => ({ id: v.id, title: v.title, type: 'virtual_experience', status: v.status })),
    ];
    if (!allMatched.length) {
        return { content: [{ type: 'text', text: `No courses or VEs found matching "${skill}". Try a broader term.` }] };
    }
    const itemList = allMatched.map((m, i) => `  ${i + 1}. [${m.type}] ${m.title} [${m.status}] -- ID: ${m.id}`).join('\n');
    if (!auto_create) {
        return { content: [{ type: 'text', text: `Found ${allMatched.length} item(s) matching "${skill}":\n\n${itemList}\n\nCall again with auto_create: true to create the learning path, or adjust the title/description first.` }] };
    }
    const data = await apiCall('/api/learning-paths', {
        action: 'create',
        title,
        description: description ?? null,
        item_ids: allMatched.map(m => m.id),
        cohort_ids: cohort_ids ?? [],
        status: 'draft',
    });
    return { content: [{ type: 'text', text: `Learning path created.\nID: ${data.id}\nItems included:\n${itemList}` }] };
});
// --- START SERVER ---
const transport = new StdioServerTransport();
await server.connect(transport);
