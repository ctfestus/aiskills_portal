# AI Skills Africa MCP Server

Create and manage courses, virtual experiences, and learning paths directly from Claude.

## Setup

### 1. Install dependencies
```bash
cd mcp
npm install
npm run build
```

### 2. Add to Claude Desktop config

Open `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "aisa": {
      "command": "node",
      "args": ["C:/path/to/your/app/mcp/dist/index.js"],
      "env": {
        "AISA_API_URL":          "https://app.aiskillsafrica.com",
        "AISA_SUPABASE_URL":     "your-supabase-url",
        "AISA_SUPABASE_ANON_KEY":"your-supabase-anon-key",
        "AISA_EMAIL":            "your-instructor-email",
        "AISA_PASSWORD":         "your-instructor-password"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

## Available Tools

| Tool | Description |
|------|-------------|
| `list_cohorts` | List all cohorts (get IDs for assignments) |
| `list_courses` | List all your courses |
| `create_course` | Create a new course with questions |
| `update_course` | Update an existing course |
| `create_virtual_experience` | Create a guided project / job simulation |
| `update_virtual_experience` | Update an existing VE |
| `list_learning_paths` | List all your learning paths |
| `create_learning_path` | Group courses/VEs into a learning path |
| `update_learning_path` | Update an existing learning path |

## Example prompts

> "Create a beginner Python course with 5 questions on variables, loops, and functions. Assign it to cohort 1."

> "Create a data analyst virtual experience for a fictional fintech company called Kora. Include 3 modules: data cleaning, analysis, and reporting. Use Excel and Python."

> "Create a learning path called 'Data Foundations' with the Python course and the data analyst VE, assign to cohort 1, and publish it."
