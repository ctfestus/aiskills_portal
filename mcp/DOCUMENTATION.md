# AI Skills Africa — MCP Server Documentation

The AISA MCP server connects Claude Desktop to the AI Skills Africa platform. You can create and manage all content by chatting with Claude — no dashboard required for content creation.

---

## Setup

**Config file:** `C:\Users\DELL\AppData\Roaming\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aisa": {
      "command": "node",
      "args": ["path/to/mcp/dist/index.js"],
      "env": {
        "AISA_API_URL": "https://app.aiskillsafrica.com",
        "AISA_SUPABASE_URL": "...",
        "AISA_SUPABASE_ANON_KEY": "...",
        "AISA_EMAIL": "your-instructor-email",
        "AISA_PASSWORD": "your-password",
        "BUNNY_API_KEY": "your-bunny-api-key",
        "BUNNY_LIBRARY_ID": "your-bunny-library-id"
      }
    }
  }
}
```

After any change to the MCP code, run `npm run build` inside the `mcp/` folder, then restart Claude Desktop.

---

## Rules

- All content created via MCP is saved as **draft** — nothing goes live until you explicitly ask Claude to publish it.
- **Never provide IDs.** Just use names. Claude resolves names to IDs automatically. Say *"the Python course"* or *"Lagos cohort"* and Claude will look them up.
- `update_course` replaces the full questions array — Claude calls `get_course` automatically before adding or editing questions so nothing is lost.

---

## Tools Reference

### COHORTS

---

#### `list_cohorts`
List all cohorts.

**No parameters.**

**Example prompt:**
```
List all cohorts
```

---

#### `create_cohort`
Create a new cohort.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | ✅ | Cohort name, e.g. "Lagos Batch 3" |

**Example prompt:**
```
Create a cohort called "Accra Batch 2"
```

---

#### `list_cohort_students`
List all students in a cohort with their name, email, and XP.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cohort_id` | string | ✅ | Resolved automatically from the cohort name you provide |

**Example prompt:**
```
List all students in the Lagos cohort
```

---

#### `get_cohort_stats`
Get completion and pass rate stats for a cohort across all assigned courses.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cohort_id` | string | ✅ | Resolved automatically from the cohort name you provide |

**Returns:** Per-course completion count, completion rate, and pass rate.

**Example prompt:**
```
Show me the completion stats for the Accra Batch 2 cohort
```

---

#### `get_leaderboard`
Get top students by XP for a cohort.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `cohort_id` | string | ✅ | Resolved automatically from the cohort name you provide |
| `limit` | number | — | Number of students to return (default 10, max 50) |

**Example prompt:**
```
Show the top 5 students in the Lagos cohort
```

---

### COURSES

---

#### `list_courses`
List all courses with their status and slug.

**No parameters.**

**Example prompt:**
```
List all my courses
```

---

#### `get_course`
Get the full content of a course — all questions, lesson slides, and settings.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved automatically from the course name you provide |

**You don't need to call this yourself.** Claude calls it automatically before any update to preserve existing questions.

**Example prompt:**
```
Show me the full content of the Python Basics course
```

---

#### `create_course`
Create a new course. Saved as **draft**.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Course title |
| `description` | string | — | Short description shown on course card |
| `questions` | array | — | Array of question objects (see below) |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs automatically |
| `passmark` | number | — | Pass percentage (default 50) |
| `deadline_days` | number | — | Days to complete after assignment |
| `learn_outcomes` | string[] | — | What students will learn |
| `theme` | string | — | Color theme: `forest` \| `lime` \| `emerald` \| `rose` \| `amber` (default: forest) |
| `mode` | string | — | Display mode: `dark` \| `light` \| `auto` (default: dark) |

**Question object:**

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | string | ✅ | Question text |
| `options` | string[] | ✅ | Answer options |
| `correct` | number | ✅ | Index of correct option (0-based) |
| `explanation` | string | — | Shown after answering |
| `lesson` | object | — | Lesson slide shown before this question |
| `lesson.title` | string | — | Lesson heading |
| `lesson.body` | string | — | Lesson content (supports HTML) |
| `lesson.videoUrl` | string | — | Embed URL for a video |
| `lessonOnly` | boolean | — | If true, no question — just the lesson slide |

**Example prompt:**
```
Create a 10-question course on Python basics for beginners.
Add a lesson slide before each question explaining the concept.
Assign to the Lagos cohort.
```

---

#### `update_course`
Update an existing course. Replaces the full questions array if provided — Claude reads the existing questions first automatically.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved automatically from the course name you provide |
| `title` | string | — | New title |
| `description` | string | — | New description |
| `questions` | array | — | Full replacement questions array |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs automatically |
| `passmark` | number | — | New pass percentage |
| `deadline_days` | number | — | New deadline |
| `learn_outcomes` | string[] | — | New learning outcomes |
| `theme` | string | — | New theme |
| `mode` | string | — | New display mode |

**Example prompt:**
```
Add an explanation to every question in the Python Basics course that is missing one
```

---

#### `publish_content`
Publish or unpublish any course, virtual experience, or learning path.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved automatically from the content name you provide |
| `content_type` | string | ✅ | `course` \| `virtual_experience` \| `learning_path` |
| `status` | string | ✅ | `published` \| `draft` |

**Example prompts:**
```
Publish the Python Basics course
```
```
Set the Data Analytics learning path back to draft
```

---

### VIRTUAL EXPERIENCES

---

#### `list_virtual_experiences`
List all virtual experiences with their status and industry.

**No parameters.**

**Example prompt:**
```
List all virtual experiences
```

---

#### `get_virtual_experience`
Get the full content of a virtual experience — all modules, lessons, and requirements.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved automatically from the VE name you provide |

**Example prompt:**
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
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs automatically |
| `deadline_days` | number | — | Days to complete |

**Module structure:**
```json
{
  "title": "Module title",
  "lessons": [
    {
      "title": "Lesson title",
      "content": "Instructions for the student",
      "requirements": [
        { "type": "text", "prompt": "What to write" },
        { "type": "file", "prompt": "What to upload" },
        { "type": "quiz", "prompt": "Question to answer" }
      ]
    }
  ]
}
```

**Example prompt:**
```
Create a Data Analyst virtual experience for a fictional fintech company called PayEdge.
3 modules: data cleaning, analysis, and a final report.
Difficulty: Intermediate. Tools: Excel, SQL.
Assign to the Accra Batch 2 cohort.
```

---

#### `update_virtual_experience`
Update an existing virtual experience.

Same parameters as `create_virtual_experience` plus `id` (resolved automatically from the name). Also accepts `status: draft | published`.

**Example prompt:**
```
Add a 4th module to the PayEdge VE covering data visualisation
```

---

### LEARNING PATHS

---

#### `list_learning_paths`
List all learning paths with their status and item count.

**No parameters.**

**Example prompt:**
```
List all learning paths
```

---

#### `get_learning_path`
Get the full content of a learning path — items, cohorts, description.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved automatically from the learning path name you provide |

**Example prompt:**
```
Show me the full content of the Data Analytics Fundamentals learning path
```

---

#### `create_learning_path`
Create a new learning path grouping courses and/or VEs in order. Saved as **draft**.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Learning path title |
| `description` | string | — | Description |
| `item_ids` | string[] | ✅ | Ordered list of course/VE names — Claude resolves to IDs |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs automatically |

**Example prompt:**
```
Create a "Data Analytics Fundamentals" learning path with the SQL Basics course,
the Excel for Data course, and the PayEdge VE in that order.
Assign to the Lagos cohort.
```

---

#### `update_learning_path`
Update an existing learning path.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Resolved automatically from the learning path name you provide |
| `title` | string | — | New title |
| `description` | string | — | New description |
| `item_ids` | string[] | — | New ordered item list (names resolved automatically) |
| `cohort_ids` | string[] | — | New cohort assignments (names resolved automatically) |
| `status` | string | — | `draft` \| `published` |

**Example prompt:**
```
Add the Python Basics course to the end of the Data Analytics Fundamentals learning path
```

---

### BUNNY VIDEO IMPORT

Requires `BUNNY_API_KEY` and `BUNNY_LIBRARY_ID` in the config.

---

#### `list_bunny_collections`
List all video collections (folders) in the Bunny library.

**No parameters.**

**Example prompt:**
```
List my Bunny collections
```

---

#### `list_bunny_videos`
List all videos in a collection in title order with durations. Use this to preview before creating a course.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `collection_id` | string | ✅ | Resolved automatically from the collection name you provide |

**Example prompt:**
```
List all videos in the Python Bootcamp collection
```

---

#### `create_course_from_bunny`
Import an entire Bunny collection as a course. Each video becomes a lesson slide in title order. Optionally add comprehension questions after each video.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `collection_id` | string | ✅ | Resolved automatically from the collection name you provide |
| `title` | string | ✅ | Course title |
| `description` | string | — | Course description |
| `cohort_ids` | string[] | — | Cohort names — Claude resolves to IDs automatically |
| `passmark` | number | — | Pass percentage (default 50) |
| `deadline_days` | number | — | Days to complete |
| `theme` | string | — | Color theme |
| `mode` | string | — | Display mode |
| `learn_outcomes` | string[] | — | What students will learn |
| `comprehension_questions` | array[][] | — | One question set per video (same order). Each set is inserted after its video slide. |

**Video sort order:** Videos are sorted alphabetically by title using natural numeric sort. Name your videos `01 - Intro`, `02 - Variables`, etc. for reliable ordering.

**Example prompts:**

*Videos only:*
```
Create a course from the Python Bootcamp Bunny collection.
Assign to the Lagos cohort.
```

*With comprehension questions:*
```
List the videos in the Python Bootcamp collection, then create a course from it
with 2 comprehension questions after each video based on the video title.
```

---

## Common Workflows

### Create a full course from scratch
```
Create a 10-question course on "Introduction to Machine Learning"
with lesson slides before each question.
Passmark 70%. Assign to the Lagos cohort.
```

### Import a video series from Bunny
```
List my Bunny collections
→ List videos in the Python Bootcamp collection
→ Create a course from it with 3 comprehension questions after each video
→ Publish the Python Bootcamp course
```

### Build a learning path
```
List all courses
→ List all virtual experiences
→ Create a "Data Science Track" learning path with the SQL course,
  the Excel course, and the PayEdge VE. Assign to Accra Batch 2.
→ Publish the Data Science Track learning path
```

### Check cohort performance
```
Show me the completion stats for the Lagos cohort
→ Show the leaderboard for the Lagos cohort
→ Which courses have completion below 50%? Create a refresher course for those topics.
```

### Add content to an existing course
```
Add 5 more questions to the Python Basics course covering functions and loops
```
```
Add an explanation to every question in the SQL Basics course that is missing one
```
```
Add a lesson slide before question 3 in the Data Analytics course explaining pivot tables
```
