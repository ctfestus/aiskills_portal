# AISA / Festman MCP - Tools Guide

A plain-language reference for every tool the platform MCP exposes, and how to use them from Claude Desktop. The same server powers two tenants (`aisa` and `festman`) from one build; both get every tool.

## How to use it

- Just talk. Say what you want ("create an SQL course", "who is at risk in Lagos Batch 3", "send a payment reminder") and the right tool is picked for you.
- Not sure what is possible? Say "what can you do" or run the **guide** tool. It shows a menu and asks only the questions it needs.
- You never need to know IDs. Refer to things by name (course title, cohort name, student email); the tools resolve names to IDs for you.

## Conventions (apply to every tool)

- **Draft by default.** New courses, VEs, learning paths, events, assignments, and datasets are created as drafts. Nothing is published or sent until you ask.
- **Approval before anything outward-facing.** Emails, nudges, announcements, and reminders always run a `dry_run` first to show the recipient count before they send for real.
- **Plain ASCII only** in generated content: no em dashes, curly quotes, or ellipsis characters.

---

## 1. Getting started

| Tool | What it does | How to use |
|---|---|---|
| `guide` | Interactive wizard. Shows a menu of everything you can do, then asks the exact questions needed for your goal. | Say "what can you do", or "guide me through creating a SQL course". |

---

## 2. Cohorts and students

| Tool | What it does |
|---|---|
| `list_cohorts` | List all cohorts (and their IDs). |
| `create_cohort` | Create a new cohort, e.g. "Lagos Batch 3". |
| `list_cohort_students` | List students in a cohort with name, email, and XP. |
| `get_cohort_stats` | Completion and pass-rate stats per course for a cohort. |
| `get_leaderboard` | Top students by XP for a cohort. |
| `get_student_report` | Full profile for one student: XP, completions, pass rates, certificates, assignment grades. |
| `list_certificates` | List students who earned certificates; filter by course / VE / learning path / cohort. |

Examples: "list students in Accra Cohort 2", "leaderboard for the SQL cohort", "how is Ama doing".

---

## 3. Courses

| Tool | What it does |
|---|---|
| `list_courses` | List all your courses with status and slug. |
| `get_course` | Get the full content of a course (all slides and questions). |
| `create_course` | Create a course. Slides can be lessons, multiple-choice / fill-blank / arrange / code / image questions, AI-reviewed submissions (code_review, excel_review, dashboard_critique, document_review), interactive `sql_exercise` slides, section dividers, and downloads blocks. |
| `update_course` | Update a course. Only fields you pass change; passing `questions` replaces all slides, so include every slide you want to keep. |
| `clone_course` | Duplicate a course under a new title (draft, no cohorts). |
| `publish_content` | Publish or unpublish a course, VE, learning path, or event. |

Examples: "create a beginner Excel course with 10 lessons and a quiz after each", "add a downloads slide to the SQL course", "publish the Power BI course to Lagos Batch 3".

For scenario-based SQL courses, ask "guide me through a SQL course" - each exercise is written as a real workplace request, not a textbook instruction.

---

## 4. Building a course from a document (PDF, DOCX, PPT, URL, or text)

| Tool | What it does |
|---|---|
| `create_course_from_document` | Builds a complete course from a document using the **same two-stage generator as the platform web app** (outline, then full), so the result matches the platform exactly, then saves it as a draft. **Use this to create a course from a document.** |
| `extract_document_source` | Returns only the raw teachable text of a document or URL (no course is built). Use it when you just want the source to inspect, not a built course. |

### How `create_course_from_document` works

It produces the identical house-style course as the web wizard - same question schema, types, density, scenario formatting, and lesson structure - because it calls the platform's own generation pipeline.

**Getting the source** depends on the type:

| Source | How the source is obtained |
|---|---|
| **PDF** | Claude reads PDFs natively. Attach the PDF to the chat; Claude reads it and passes the content in as the source. No Gemini, no upload. |
| **Pasted text** | Used directly as the source. |
| **TXT file** | Read off disk by the tool. |
| **DOCX / DOC / PPTX / PPT** | Extracted server-side via the platform endpoint (Gemini), because Claude cannot read Office formats natively. |
| **Public URL** | Fetched and cleaned to text server-side (no AI model). |

**The brief (gathered by Claude, like the web wizard):** before generating, Claude asks for and passes along:
- Audience, level (Beginner / Intermediate / Advanced), and the goal (what learners should be able to DO).
- Focus to emphasize; depth (`primer` 3-4 modules / `balanced` 4-8 / `comprehensive` 8-12); practice emphasis (`hands_on` / `balanced` / `knowledge`); tone.
- Whether to include **YouTube explainer videos**, and any **preferred channels**.
- Image mode (stock photos), cohorts, and pass mark.

The generator then produces the modules, lessons, and one question per lesson matched to the content (sql_exercise, code_review, multiple_choice, etc.), wires in stock images and module-intro videos per the brief, and the tool saves it as a draft. Review and `publish_content` when ready.

**What uses which model:**
- The **course generation** (questions, lessons, structure) runs on the platform's `/api/ai-course` generator - identical to the web app.
- **Reading the source:** PDF and pasted text are read by Claude (no Gemini); DOCX / DOC / PPTX / PPT use Gemini server-side; TXT and URL use no model.

**Requirements:** the `/api/ai-course` and `/api/doc-course/extract` routes must be deployed, and `GEMINI_API_KEY` set on the server (the generator and Office extraction both use it). PDF/text reading needs no key on the MCP side.

> The "source" image mode (PDF page images) is not available in the MCP path, since the PDF is read by Claude rather than uploaded; stock images still work.

Example: attach a PDF and say "build a course from this for beginner analysts, hands-on, include videos"; or "create a course from https://example.com/guide".

---

## 5. Virtual experiences (guided projects / job simulations)

| Tool | What it does |
|---|---|
| `list_virtual_experiences` | List all VEs. |
| `get_virtual_experience` | Get a VE's full content (modules, lessons, requirements). |
| `create_virtual_experience` | Create a job-simulation VE with modules, lessons, requirement types (task, deliverable, reflection, upload, mcq, and AI reviewers), and an optional dataset. |
| `update_virtual_experience` | Update a VE; only fields you pass change. |
| `clone_virtual_experience` | Duplicate a VE under a new title (draft, no cohorts). |

Example: "create a data analyst job simulation in finance with a real transactions dataset".

---

## 6. Learning paths

| Tool | What it does |
|---|---|
| `list_learning_paths` | List all learning paths. |
| `get_learning_path` | Get a path's full content. |
| `create_learning_path` | Create a path that groups courses and VEs in order. |
| `update_learning_path` | Update a path; only fields you pass change. |
| `build_learning_path_for_skill` | Find all courses and VEs matching a keyword and assemble them into a path. Previews matches before creating unless you confirm. |

Example: "build a Power BI learning path from everything we have", "make a Data Analyst track".

---

## 7. Events and live sessions

| Tool | What it does |
|---|---|
| `list_events` | List all events / live sessions. |
| `get_event` | Full details of one event. |
| `create_event` | Create an event. Publishing to cohorts auto-registers students and gives tracked join links so attendance is recorded. Supports recurring sessions and speakers. |
| `update_event` | Update an event; only fields you pass change. |
| `get_attendance_report` | Who joined vs who registered but missed - one session or across all. |
| `nudge_absent_attendees` | Email students who registered but did not join (built-in "missed session" template). `dry_run` first. |

Example: "create a weekly live SQL clinic on Tuesdays for Lagos Batch 3", "who missed last Thursday's session".

---

## 8. Communication

| Tool | What it does |
|---|---|
| `send_announcement` | Publish an announcement to cohorts; appears in the student dashboard feed. |
| `send_bulk_message` | Send a custom email to a segment of students (use `{{name}}` to personalise). `dry_run` first. |
| `nudge_cohort` | Motivational nudge emails to students who have not started or are stalled on a specific course. |

Example: "announce the new course to all cohorts", "email everyone who has not started the Excel course".

---

## 9. Assignments and grading

| Tool | What it does |
|---|---|
| `create_assignment` | Create an assignment and assign it to cohorts (draft unless published). |
| `list_assignments` | List assignments with status, due date, linked course. |
| `list_pending_submissions` | Ungraded submissions, oldest first. |
| `list_submissions` | All submissions for an assignment with status and score. |
| `update_assignment` | Update an assignment; set/change the due date, or close it to stop accepting submissions. |
| `grade_submission` | Grade a submission with a score and optional feedback. |
| `remind_unsubmitted` | Email students who have not submitted yet. `dry_run` first. |

Example: "what is waiting to be graded", "remind everyone who has not submitted the project".

---

## 10. Analytics and course quality

| Tool | What it does |
|---|---|
| `get_course_analytics` | Completion rate, pass rate, average score, repeat failures, top scores. |
| `analyze_cohort_performance` | Cross-course analysis for a cohort; flags engagement gaps and weak content. |
| `suggest_course_improvements` | Audit a course for structural issues and high-failure questions. |
| `score_course_quality` | Score a course 0-100 for job-readiness, with a prioritised list of fixes. |
| `analyze_course_funnel` | Where students drop off, which slides trigger the most hints, the hardest questions, average completion time. |

Example: "score the SQL course", "where do students drop off in the Power BI course".

---

## 11. Retention and briefings

| Tool | What it does |
|---|---|
| `list_students_at_risk` | Students who have not started or are stalled on assigned courses. |
| `find_at_risk_students` | Churn detector: scores each student on payments, attendance, progress, and login activity, then ranks by risk with reasons and a recommended action. |
| `weekly_program_briefing` | Executive summary: roster growth, revenue and outstanding payments, attendance, course health, and the at-risk list. |
| `daily_ops_digest` | Autopilot digest for scheduled runs - splits the day's work into AUTO (safe to send now) and APPROVE-FIRST (needs your sign-off). |

Example: "who is at risk in Accra Cohort 2", "give me the weekly briefing".

---

## 12. Payments

| Tool | What it does |
|---|---|
| `revenue_overview` | Total billed, collected, outstanding, collection rate, and upcoming due payments. |
| `list_outstanding_payments` | Students with a balance, overdue first. |
| `get_student_payment_status` | One student's fee, paid, balance, plan, access status, schedule, and history. |
| `record_payment` | Record a payment (applied oldest-first), update balance, restore access, email a receipt. |
| `send_payment_reminders` | Email reminders to students with a balance. `dry_run` first. |
| `waive_payment` | Mark an enrollment as waived / sponsored and restore access. |

Example: "how much is outstanding in Lagos Batch 3", "record 500 GHS for ama@example.com", "sponsor this student".

---

## 13. Video import (Bunny.net)

| Tool | What it does |
|---|---|
| `list_bunny_collections` | List video collections (folders). |
| `list_bunny_videos` | List videos in a collection with durations and embed URLs (use a URL as a `lesson.videoUrl`). |
| `create_course_from_bunny` | Import a whole collection as a course - each video becomes a lesson, with optional teaching notes and a quiz per video. |

Example: "turn the Excel Basics video collection into a course with a quiz after each video".

---

## 14. Data Playground (data center datasets)

| Tool | What it does |
|---|---|
| `list_datasets` | List Data Playground datasets (includes drafts). |
| `create_dataset` | Add a dataset for students to explore and query (draft unless published). |
| `update_dataset` | Update a dataset; publish or unpublish. |
| `delete_dataset` | Permanently delete a dataset. |

---

## 15. Media and data helpers

| Tool | What it does |
|---|---|
| `search_stock_images` | Search Pexels for royalty-free photos for course/VE cover images or lesson images. |
| `fetch_real_world_data` | Pull real World Bank economic/development data (no key needed) to power SQL exercises and datasets. |

Example: "find a cover image for the finance course", "get GDP data for Ghana and Nigeria for a SQL exercise".

---

## 16. Promotion and marketing

| Tool | What it does | How to use |
|---|---|---|
| `generate_promo` | Build a grounded promo brief for a course, VE, or learning path to attract NEW learners. Pulls the real outcomes, structure, public URL, and brand voice, then produces per-platform writing instructions (LinkedIn, Instagram, X, WhatsApp, carousel, ad copy, flyer, email). Claude writes the actual copy from the brief. | "generate promo content for SQL for Data Science and Analytics". It will ask audience, tone, and which platforms, then offer to push designs into Canva and draft the email in Gmail. |

It only cites real numbers (enrolments, pass rates) when there is enough data to be credible; otherwise it will not invent stats.

---

## Reminders

- Restart Claude Desktop after the MCP is rebuilt so new or changed tools load.
- Both `aisa` and `festman` run the same build, so any tool change applies to both tenants.
