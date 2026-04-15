# Platform MCP Server

Connect Claude Desktop to the learning platform. Create and manage all content, communicate with students, and analyse performance — without opening the dashboard.

## Setup

### 1. Build

```bash
cd mcp
npm install
npm run build
```

### 2. Add to Claude Desktop config

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aisa": {
      "command": "node",
      "args": ["C:/path/to/mcp/dist/index.js"],
      "env": {
        "MCP_NAME":              "aisa-mcp",
        "MCP_API_URL":           "https://app.aiskillsafrica.com",
        "MCP_SUPABASE_URL":      "your-supabase-url",
        "MCP_SUPABASE_ANON_KEY": "your-supabase-anon-key",
        "MCP_EMAIL":             "your-instructor-email",
        "MCP_PASSWORD":          "your-password",
        "BUNNY_API_KEY":         "your-bunny-api-key",
        "BUNNY_LIBRARY_ID":      "your-bunny-library-id"
      }
    }
  }
}
```

For multiple tenants (e.g. AISA + Festman), add a second entry with different `MCP_*` env vars pointing to the other Supabase project. See `DOCUMENTATION.md` for the full multi-tenant setup.

### 3. Restart Claude Desktop

After any code change, run `npm run build` then restart Claude Desktop.

---

## Tools

### Cohorts
| Tool | Description |
|---|---|
| `list_cohorts` | List all cohorts |
| `create_cohort` | Create a new cohort |
| `list_cohort_students` | List students in a cohort with XP |
| `get_cohort_stats` | Completion and pass rate stats per course |
| `get_leaderboard` | Top students by XP |

### Courses
| Tool | Description |
|---|---|
| `list_courses` | List all courses |
| `get_course` | Get full course content |
| `create_course` | Create a course with questions and lesson slides |
| `update_course` | Update a course — safe, existing fields are preserved |
| `clone_course` | Duplicate a course into a new draft |
| `publish_content` | Publish or unpublish any content |

### Virtual Experiences
| Tool | Description |
|---|---|
| `list_virtual_experiences` | List all VEs |
| `get_virtual_experience` | Get full VE content |
| `create_virtual_experience` | Create a guided project / job simulation |
| `update_virtual_experience` | Update a VE — safe, existing fields are preserved |

### Learning Paths
| Tool | Description |
|---|---|
| `list_learning_paths` | List all learning paths |
| `get_learning_path` | Get full learning path content |
| `create_learning_path` | Group courses and VEs in order |
| `update_learning_path` | Update a learning path |
| `build_learning_path_for_skill` | Find matching content by keyword and build a path |

### Student Management
| Tool | Description |
|---|---|
| `send_announcement` | Post an announcement to cohorts |
| `send_bulk_message` | Email a segment of students (all / not started / stalled / completed) |
| `nudge_cohort` | Send nudge emails to not-started or stalled students on a course |
| `list_students_at_risk` | Students who haven't started or are stalled |
| `get_student_report` | Full profile: XP, completions, pass rates, certs, assignments |

### Assignments
| Tool | Description |
|---|---|
| `create_assignment` | Create and assign work to cohorts |
| `list_assignments` | List all assignments |
| `list_pending_submissions` | Ungraded submissions ready for review |
| `grade_submission` | Grade with score and feedback |

### Analytics & AI
| Tool | Description |
|---|---|
| `get_course_analytics` | Completion rate, pass rate, avg score, repeat failures |
| `analyze_cohort_performance` | Cross-course view with automatic risk flags |
| `suggest_course_improvements` | Flags weak questions, missing explanations, passmark issues |

### Bunny Video Import
| Tool | Description |
|---|---|
| `list_bunny_collections` | List video collections in Bunny |
| `list_bunny_videos` | List videos in a collection |
| `create_course_from_bunny` | Import a Bunny collection as a course |

---

## Key rules

- All new content is saved as **draft** — nothing is published until you ask.
- **Never type IDs.** Just use names. Claude resolves them automatically.
- `update_*` tools fetch the current state first — only fields you mention are changed.

---

## Example prompts

```
Create a 10-question Python basics course with lesson slides. Passmark 70%. Assign to Lagos cohort.
```
```
Clone the Python Basics course as "Python Advanced" and add 5 harder questions.
```
```
Show me which students in the Accra cohort are at risk, then send nudge emails to those who haven't started.
```
```
Grade all pending submissions for the Data Analytics assignment.
```
```
Analyse the performance of the Lagos cohort and tell me which courses need attention.
```
```
Build a learning path for "data analysis" and show me what it would include before creating it.
```
