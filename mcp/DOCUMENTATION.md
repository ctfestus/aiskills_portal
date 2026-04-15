# MCP Server — Full Documentation

The MCP server connects Claude Desktop to the learning platform. Chat with Claude to create content, manage students, send communications, and analyse performance — no dashboard required.

---

## Setup

### Single tenant

**Config file:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aisa": {
      "command": "node",
      "args": ["C:/path/to/mcp/dist/index.js"],
      "env": {
        "MCP_NAME":              "aisa-mcp",
        "MCP_API_URL":           "https://app.aiskillsafrica.com",
        "MCP_SUPABASE_URL":      "https://your-project.supabase.co",
        "MCP_SUPABASE_ANON_KEY": "your-anon-key",
        "MCP_EMAIL":             "instructor@example.com",
        "MCP_PASSWORD":          "your-password",
        "BUNNY_API_KEY":         "your-bunny-api-key",
        "BUNNY_LIBRARY_ID":      "your-library-id"
      }
    }
  }
}
```

### Multi-tenant (e.g. AISA + Festman)

Same binary, two entries with different `MCP_*` env vars. Each points to its own Supabase project and API URL.

```json
{
  "mcpServers": {
    "aisa": {
      "command": "node",
      "args": ["C:/path/to/mcp/dist/index.js"],
      "env": {
        "MCP_NAME":              "aisa-mcp",
        "MCP_API_URL":           "https://app.aiskillsafrica.com",
        "MCP_SUPABASE_URL":      "https://aisa-project.supabase.co",
        "MCP_SUPABASE_ANON_KEY": "aisa-anon-key",
        "MCP_EMAIL":             "instructor@aisa.com",
        "MCP_PASSWORD":          "password",
        "BUNNY_API_KEY":         "bunny-key",
        "BUNNY_LIBRARY_ID":      "110086"
      }
    },
    "festman": {
      "command": "node",
      "args": ["C:/path/to/mcp/dist/index.js"],
      "env": {
        "MCP_NAME":              "festman-mcp",
        "MCP_API_URL":           "https://learn.festman.com",
        "MCP_SUPABASE_URL":      "https://festman-project.supabase.co",
        "MCP_SUPABASE_ANON_KEY": "festman-anon-key",
        "MCP_EMAIL":             "instructor@festman.com",
        "MCP_PASSWORD":          "password",
        "BUNNY_API_KEY":         "bunny-key",
        "BUNNY_LIBRARY_ID":      "110086"
      }
    }
  }
}
```

Each MCP appears as a separate server in Claude Desktop. Address them by saying "using AISA" or "using Festman" if you have both active.

### After any code change

```bash
cd mcp
npm run build
```

Then restart Claude Desktop.

---

## Rules

- All new content is saved as **draft** — nothing goes live until you explicitly ask Claude to publish it.
- **Never provide IDs.** Use names. Claude resolves names to IDs automatically by calling the relevant `list_*` tool first.
- **Updates are safe.** All `update_*` tools fetch the current record first and merge — only the fields you mention are changed. Nothing is wiped.

---

## Tools Reference

---

### COHORTS

#### `list_cohorts`
List all cohorts. No parameters.

```
List all cohorts
```

---

#### `create_cohort`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Cohort name, e.g. "Lagos Batch 3" |

```
Create a cohort called "Accra Batch 2"
```

---

#### `list_cohort_students`
List all students in a cohort with their name, email, and XP.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cohort_id` | string | ✅ | Resolved from the cohort name you provide |

```
List all students in the Lagos cohort
```

---

#### `get_cohort_stats`
Completion and pass rate stats per course for a cohort.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cohort_id` | string | ✅ | Resolved from the cohort name you provide |

```
Show me the completion stats for the Accra Batch 2 cohort
```

---

#### `get_leaderboard`
Top students by XP for a cohort.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cohort_id` | string | ✅ | Resolved from the cohort name you provide |
| `limit` | number | — | Number of students (default 10, max 50) |

```
Show the top 10 students in the Lagos cohort
```

---

### COURSES

#### `list_courses`
List all courses with status and slug. No parameters.

```
List all my courses
```

---

#### `get_course`
Get the full content of a course — all questions, lessons, and settings.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved from the course name you provide |

You rarely need to call this yourself — Claude calls it automatically before any update.

```
Show me the full content of the Python Basics course
```

---

#### `create_course`
Create a new course. Saved as **draft**.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Course title |
| `description` | string | — | Short description on the course card |
| `questions` | array | — | Questions with optional lesson slides (see structure below) |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs |
| `passmark` | number | — | Pass percentage (default 50) |
| `deadline_days` | number | — | Days to complete after assignment |
| `learn_outcomes` | string[] | — | What students will learn |
| `theme` | string | — | `forest` \| `lime` \| `emerald` \| `rose` \| `amber` |
| `mode` | string | — | `dark` \| `light` \| `auto` |
| `points_enabled` | boolean | — | Enable XP reward points |
| `points_base` | number | — | Base XP per question (default 100) |

**Question object:**

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | ✅ | Question text |
| `options` | string[] | ✅ | Answer options |
| `correct` | number | ✅ | Index of correct option (0-based) |
| `explanation` | string | — | Shown after answering |
| `lesson.title` | string | — | Lesson slide heading |
| `lesson.body` | string | — | Lesson content (supports HTML) |
| `lesson.videoUrl` | string | — | Embed URL for a video |
| `lessonOnly` | boolean | — | Lesson-only slide with no question |

```
Create a 10-question Python basics course with a lesson slide before each question.
Passmark 70%. Enable reward points. Assign to the Lagos cohort.
```

---

#### `update_course`
Update an existing course. Fetches current state first — unmentioned fields are preserved.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved from the course name you provide |
| `title` | string | — | New title |
| `description` | string | — | New description |
| `questions` | array | — | Full replacement questions array |
| `cohort_ids` | string[] | — | New cohort assignments |
| `passmark` | number | — | New pass percentage |
| `deadline_days` | number | — | New deadline |
| `learn_outcomes` | string[] | — | New learning outcomes |
| `theme` | string | — | New theme |
| `mode` | string | — | New display mode |
| `points_enabled` | boolean | — | Enable/disable reward points |
| `points_base` | number | — | New base XP |
| `status` | string | — | `draft` \| `published` |

```
Add an explanation to every question in the Python Basics course that is missing one
```
```
Add 5 harder questions to the Python Basics course covering classes and decorators
```

---

#### `clone_course`
Duplicate an existing course with a new title. All questions, lessons, and settings are copied. The clone is created as a **draft** with no cohorts assigned.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved from the course name you provide |
| `title` | string | ✅ | Title for the cloned course |

```
Clone the Python Basics course as "Python Advanced"
```
```
Make a copy of the SQL Fundamentals course called "SQL for Finance"
```

---

#### `publish_content`
Publish or unpublish any course, virtual experience, or learning path.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved from the content name you provide |
| `content_type` | string | ✅ | `course` \| `virtual_experience` \| `learning_path` |
| `status` | string | ✅ | `published` \| `draft` |

```
Publish the Python Basics course
```
```
Set the Data Analytics learning path back to draft
```

---

### VIRTUAL EXPERIENCES

#### `list_virtual_experiences`
List all VEs with status and industry. No parameters.

```
List all virtual experiences
```

---

#### `get_virtual_experience`
Get the full content of a VE — modules, lessons, requirements.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved from the VE name you provide |

```
Show me the full content of the PayEdge Data Analyst VE
```

---

#### `create_virtual_experience`
Create a new virtual experience (guided project / job simulation). Saved as **draft**.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | VE title |
| `tagline` | string | — | One-line description on the card |
| `industry` | string | — | e.g. Finance, Healthcare, Tech |
| `difficulty` | string | — | `Beginner` \| `Intermediate` \| `Advanced` |
| `role` | string | — | Job role simulated, e.g. Data Analyst |
| `company` | string | — | Fictional company name |
| `duration` | string | — | Estimated time, e.g. "2 hours" |
| `tools` | string[] | — | Tools used, e.g. ["Excel", "Python"] |
| `modules` | array | — | Module and lesson structure (see below) |
| `learn_outcomes` | string[] | — | What students will learn |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs |
| `deadline_days` | number | — | Days to complete |
| `theme` | string | — | `forest` \| `lime` \| `emerald` \| `rose` \| `amber` |
| `mode` | string | — | `dark` \| `light` \| `auto` |

**Module structure:**
```json
{
  "title": "Module title",
  "lessons": [
    {
      "title": "Lesson title",
      "content": "Instructions for the student",
      "requirements": [
        { "type": "text", "prompt": "What the student must write" },
        { "type": "file", "prompt": "What the student must upload" },
        { "type": "quiz", "prompt": "Question to answer" }
      ]
    }
  ]
}
```

```
Create a Data Analyst VE for a fictional fintech company called PayEdge.
3 modules: data cleaning, analysis, final report. Difficulty: Intermediate. Tools: Excel, SQL.
Assign to Accra Batch 2.
```

---

#### `update_virtual_experience`
Update an existing VE. Fetches current state first — unmentioned fields are preserved.

Same parameters as `create_virtual_experience` plus `id` and `status: draft | published`.

```
Add a 4th module to the PayEdge VE covering data visualisation
```

---

### LEARNING PATHS

#### `list_learning_paths`
List all learning paths with status and item count. No parameters.

---

#### `get_learning_path`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved from the learning path name you provide |

---

#### `create_learning_path`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Learning path title |
| `description` | string | — | Description |
| `item_ids` | string[] | ✅ | Ordered course/VE names — Claude resolves to IDs |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs |

```
Create a "Data Analytics Fundamentals" learning path with the SQL Basics course,
the Excel course, and the PayEdge VE in that order. Assign to the Lagos cohort.
```

---

#### `update_learning_path`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved from the name you provide |
| `title` | string | — | New title |
| `description` | string | — | New description |
| `item_ids` | string[] | — | New ordered item list |
| `cohort_ids` | string[] | — | New cohort assignments |
| `status` | string | — | `draft` \| `published` |

```
Add the Python Basics course to the end of the Data Analytics Fundamentals path
```

---

#### `build_learning_path_for_skill`
Search all courses and VEs by keyword and build a learning path from the matches. Previews matches before creating unless `auto_create: true`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `skill` | string | ✅ | Keyword to search, e.g. "Python", "data analysis", "Excel" |
| `title` | string | ✅ | Title for the new learning path |
| `description` | string | — | Description |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs |
| `auto_create` | boolean | — | `true` to create immediately; `false` (default) to preview first |

```
Build a learning path for "data analysis" — show me what it would include before creating it
```
```
Build a learning path for "Python" called "Python Track" and assign to the Lagos cohort. Create it now.
```

---

### STUDENT MANAGEMENT

#### `send_announcement`
Create and publish an announcement to cohorts. Appears immediately in the student dashboard feed.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Announcement title |
| `content` | string | ✅ | Body text (plain text or HTML) |
| `cohort_ids` | string[] | ✅ | Cohort names — Claude resolves to IDs |
| `is_pinned` | boolean | — | Pin to top of feed (default false) |
| `expires_at` | string | — | Expiry date, e.g. `"2025-12-31"` |

```
Send an announcement to the Lagos cohort: "Week 3 assignments are now live. Submit by Friday."
```
```
Pin an announcement to all cohorts reminding students the platform closes for maintenance on Sunday.
```

---

#### `send_bulk_message`
Send a custom email to a filtered segment of students. Supports `{{name}}` personalisation.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `subject` | string | ✅ | Email subject |
| `message_body` | string | ✅ | Email body. Use `{{name}}` for personalisation. Max 5000 chars. |
| `segment` | string | ✅ | `all` \| `not_started` \| `in_progress` \| `stalled` \| `completed` |
| `cohort_id` | string | — | Limit to one cohort, or omit for all |
| `form_id` | string | — | Limit to one course/VE, or omit for all content |

```
Send an email to all students who haven't started any course:
Subject: "Your learning journey is waiting"
Body: "Hi {{name}}, you have courses ready for you. Log in today and get started!"
```

---

#### `nudge_cohort`
Send motivational nudge emails to students who have not started or are stalled on a specific course.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `course_id` | string | ✅ | Resolved from the course name you provide |
| `cohort_id` | string | ✅ | Resolved from the cohort name you provide |
| `status` | string | ✅ | `not_started` \| `stalled` (stalled = no activity in 7+ days) |

```
Nudge all students in the Lagos cohort who haven't started the Python Basics course
```
```
Send stalled nudges on the SQL course to the Accra Batch 2 cohort
```

---

#### `list_students_at_risk`
Show every student in a cohort who hasn't started or is stalled, broken down by course.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cohort_id` | string | ✅ | Resolved from the cohort name you provide |

```
Which students in the Lagos cohort are at risk?
```
```
Show me at-risk students in all cohorts, then nudge the ones who haven't started anything
```

---

#### `get_student_report`
Full profile for one student: XP, course completions, pass rates, certificates, assignment grades.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `student_email` | string | ✅ | Student's email address |

```
Give me a full report on john.doe@example.com
```
```
How is sarah@example.com doing? Has she passed any courses?
```

---

### ASSIGNMENTS

#### `create_assignment`
Create an assignment and assign it to cohorts. Saved as **draft** unless `status: published`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Assignment title |
| `scenario` | string | — | Business scenario / background context |
| `brief` | string | — | The assignment brief |
| `tasks` | string | — | Step-by-step tasks |
| `requirements` | string | — | Deliverables and requirements |
| `submission_instructions` | string | — | How to submit |
| `related_course` | string | — | Course name this assignment is linked to |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs |
| `status` | string | — | `draft` \| `published` (default: draft) |

```
Create an assignment called "Data Cleaning Project" linked to the SQL Basics course.
Scenario: student is a junior analyst at a bank. Task: clean a messy transactions dataset.
Assign to Lagos cohort and publish it.
```

---

#### `list_assignments`
List all assignments with status and linked course. No parameters.

```
List all assignments
```

---

#### `list_pending_submissions`
Show all ungraded submissions with a text preview, ordered by submission date.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `assignment_id` | string | — | Filter to one assignment, or omit for all |

```
Show all pending submissions
```
```
List ungraded submissions for the Data Cleaning Project assignment
```

---

#### `grade_submission`
Grade a submission with a score (0–100) and optional written feedback.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `submission_id` | string | ✅ | ID from `list_pending_submissions` |
| `grade` | number | ✅ | Score out of 100 |
| `feedback` | string | — | Written feedback shown to the student |

```
Grade submission abc123: 78/100. Feedback: "Good work on the cleaning steps. The JOIN query on task 3 could be optimised — try using an index."
```

---

### ANALYTICS & AI

#### `get_course_analytics`
Completion rate, pass rate, avg score, repeat failures, and top scores for a course.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `course_id` | string | ✅ | Resolved from the course name you provide |

```
Show me analytics for the Python Basics course
```
```
Which course has the lowest pass rate? Show me its analytics.
```

---

#### `analyze_cohort_performance`
Cross-course analysis for a cohort. Surfaces engagement gaps, low pass rates, and hard content. Flags courses that need attention.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cohort_id` | string | ✅ | Resolved from the cohort name you provide |

```
Analyse the performance of the Lagos cohort and tell me what needs attention
```
```
Compare all cohorts and identify the weakest performing one
```

---

#### `suggest_course_improvements`
Audit a course for structural issues: missing explanations, vague questions, high failure-rate questions from real attempt data, and passmark calibration.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `course_id` | string | ✅ | Resolved from the course name you provide |

```
Suggest improvements for the SQL Basics course
```
```
Audit all my courses and tell me which ones need the most work
```

---

### BUNNY VIDEO IMPORT

Requires `BUNNY_API_KEY` and `BUNNY_LIBRARY_ID` in the config.

#### `list_bunny_collections`
List all video collections (folders) in the Bunny library. No parameters.

---

#### `list_bunny_videos`
List all videos in a collection in title order with durations.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `collection_id` | string | ✅ | Resolved from the collection name you provide |

```
List all videos in the Python Bootcamp collection
```

---

#### `create_course_from_bunny`
Import an entire Bunny collection as a course. Each video becomes a lesson slide in title order. Optionally add comprehension questions after each video.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `collection_id` | string | ✅ | Resolved from the collection name you provide |
| `title` | string | ✅ | Course title |
| `description` | string | — | Course description |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs |
| `passmark` | number | — | Pass percentage (default 50) |
| `deadline_days` | number | — | Days to complete |
| `theme` | string | — | Color theme |
| `mode` | string | — | Display mode |
| `learn_outcomes` | string[] | — | What students will learn |
| `points_enabled` | boolean | — | Enable reward points |
| `points_base` | number | — | Base XP per question |
| `comprehension_questions` | array[][] | — | One question set per video (same order as videos) |

**Video sort order:** Videos are sorted alphabetically by title using natural numeric sort. Name your videos `01 - Intro`, `02 - Variables`, etc. for reliable ordering.

```
Create a course from the Python Bootcamp Bunny collection. Assign to the Lagos cohort.
```
```
List the videos in the Python Bootcamp collection, then create a course from it
with 2 comprehension questions per video based on the video titles.
```

---

## Common Workflows

### Create a course from scratch
```
Create a 10-question "Introduction to Machine Learning" course with lesson slides.
Passmark 70%. Enable reward points (base 150 XP). Assign to the Lagos cohort.
```

### Clone and extend a course
```
Clone the Python Basics course as "Python Advanced".
Then add 8 harder questions covering decorators, generators, and async.
Assign the clone to the Accra Batch 2 cohort and publish it.
```

### Import a video series from Bunny
```
List my Bunny collections
→ List videos in the Python Bootcamp collection
→ Create a course from it with 3 comprehension questions after each video
→ Publish the course and assign to the Lagos cohort
```

### Build a learning path
```
Build a learning path for "data analysis" — show me what it would include
→ Create it as "Data Science Track", assign to Accra Batch 2, publish it
```

### Identify and act on at-risk students
```
Show me at-risk students in the Lagos cohort
→ Nudge everyone who hasn't started the Python course
→ Send a custom email to stalled students: "Hi {{name}}, you're almost there — log back in and finish!"
```

### Full cohort performance review
```
Analyse the performance of the Lagos cohort
→ Show analytics for the course with the lowest pass rate
→ Suggest improvements for that course
→ Send an announcement to the Lagos cohort about additional support resources
```

### Grading workflow
```
List all pending submissions
→ Grade submission [id]: 85/100. Feedback: "Strong analysis. Improve your conclusion."
→ Grade submission [id]: 62/100. Feedback: "Good start, but the data cleaning step missed duplicates."
```

### Create and assign an assignment
```
Create an assignment called "SQL Challenge" for the Lagos cohort.
Scenario: junior analyst at a retail company.
Tasks: write 5 SQL queries to answer business questions.
Link to the SQL Basics course. Publish it.
```

### Student deep-dive
```
Give me a full report on jane.doe@example.com
→ What courses has she completed and what were her scores?
→ Has she submitted any assignments?
```
