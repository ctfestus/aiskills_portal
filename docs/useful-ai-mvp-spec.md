# Useful AI MVP Spec (Learner Insights)

## Goal
Turn activity data into clear, actionable learner guidance:

1. Signal: what happened
2. Meaning: why it matters
3. Action: what to do next

This matches the product direction: "Not big AI. Useful AI."

## Existing Data We Can Reuse
This app already has the core signals:

1. `public.course_attempts` for course progress, score, completion, inactivity
2. `public.guided_project_attempts` for VE progress + inactivity
3. `public.assignments` and `public.assignment_submissions` for deadline + submission risk
4. `public.cohort_assignments` for assignment timing/context by cohort
5. `public.sent_nudges` for dedupe/rate-limit behavior
6. `public.students`, `public.courses`, `public.virtual_experiences` for learner/content identity

## MVP Insight Types
Start with 5 deterministic rule-based insights:

1. `deadline_risk`  
When a learner has an assignment due in <= 2 days and not submitted.
2. `stalled_progress`  
When in-progress course/VE activity has no update in >= 7 days.
3. `score_drop`  
When latest completed attempt score drops by >= 15 points versus prior attempt.
4. `assignment_follow_up`  
When learner has >= 2 late/unsubmitted assignments in a 14-day window.
5. `win`  
When learner completed an item in last 24h (positive reinforcement).

## New Tables (Migration Draft)
Create `migrations/061_learning_insights.sql` with:

```sql
-- 061_learning_insights.sql

-- 1) Stored learner insights (cards shown in app + source for nudges)
CREATE TABLE IF NOT EXISTS public.learning_insights (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content_type    text        NOT NULL CHECK (content_type IN ('course','virtual_experience','assignment','event','system')),
  content_id      uuid,
  insight_type    text        NOT NULL CHECK (insight_type IN ('deadline_risk','stalled_progress','score_drop','assignment_follow_up','win')),
  severity        text        NOT NULL CHECK (severity IN ('info','warning','critical')),
  title           text        NOT NULL,
  message         text        NOT NULL,
  action_label    text,
  action_url      text,
  context         jsonb       NOT NULL DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed','done','expired')),
  dedupe_key      text        NOT NULL,
  source_run_date date        NOT NULL DEFAULT (now() at time zone 'utc')::date,
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_insights_dedupe UNIQUE (student_id, dedupe_key, source_run_date)
);

CREATE INDEX IF NOT EXISTS idx_learning_insights_student_status_created
  ON public.learning_insights(student_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_insights_active_valid_until
  ON public.learning_insights(status, valid_until);

CREATE INDEX IF NOT EXISTS idx_learning_insights_type
  ON public.learning_insights(insight_type, created_at DESC);

-- 2) Learner interaction log on each insight
CREATE TABLE IF NOT EXISTS public.learning_insight_actions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id  uuid        NOT NULL REFERENCES public.learning_insights(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  action      text        NOT NULL CHECK (action IN ('opened','dismissed','done','snoozed')),
  meta        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_insight_actions_insight
  ON public.learning_insight_actions(insight_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_insight_actions_student
  ON public.learning_insight_actions(student_id, created_at DESC);

-- 3) updated_at trigger
DROP TRIGGER IF EXISTS trg_learning_insights_updated_at ON public.learning_insights;
CREATE TRIGGER trg_learning_insights_updated_at
  BEFORE UPDATE ON public.learning_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) RLS
ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_insight_actions ENABLE ROW LEVEL SECURITY;

-- students: read own insights
DROP POLICY IF EXISTS "learning_insights: student read own" ON public.learning_insights;
CREATE POLICY "learning_insights: student read own"
  ON public.learning_insights FOR SELECT
  USING (student_id = (SELECT auth.uid()));

-- students: update own insight status only
DROP POLICY IF EXISTS "learning_insights: student update own status" ON public.learning_insights;
CREATE POLICY "learning_insights: student update own status"
  ON public.learning_insights FOR UPDATE
  USING (student_id = (SELECT auth.uid()))
  WITH CHECK (student_id = (SELECT auth.uid()));

-- students: log own actions
DROP POLICY IF EXISTS "learning_insight_actions: student insert own" ON public.learning_insight_actions;
CREATE POLICY "learning_insight_actions: student insert own"
  ON public.learning_insight_actions FOR INSERT
  WITH CHECK (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "learning_insight_actions: student read own" ON public.learning_insight_actions;
CREATE POLICY "learning_insight_actions: student read own"
  ON public.learning_insight_actions FOR SELECT
  USING (student_id = (SELECT auth.uid()));
```

## API Contracts (Exact Response Shape)

### 1) GET `/api/insights/student`
Authenticated learner endpoint for the cards feed.

Response:

```json
{
  "insights": [
    {
      "id": "9b52d770-7b9d-4b4c-a1b9-7f5136ebf8d7",
      "type": "deadline_risk",
      "severity": "critical",
      "title": "Assignment due tomorrow",
      "message": "Data Cleaning Sprint is due in 1 day and is still not submitted.",
      "action": {
        "label": "Submit assignment",
        "url": "/student#assignments"
      },
      "status": "active",
      "content": {
        "type": "assignment",
        "id": "11f4f9ca-c0ea-4b38-b266-f69ab84d19c6"
      },
      "context": {
        "days_left": 1
      },
      "created_at": "2026-04-25T08:00:00.000Z",
      "valid_until": "2026-04-27T00:00:00.000Z"
    }
  ],
  "summary": {
    "critical": 1,
    "warning": 2,
    "info": 1,
    "active_total": 4
  },
  "generated_at": "2026-04-25T08:00:00.000Z"
}
```

### 2) POST `/api/insights/student/action`
Used when learner opens/dismisses/completes an insight.

Request:

```json
{
  "insight_id": "9b52d770-7b9d-4b4c-a1b9-7f5136ebf8d7",
  "action": "dismissed",
  "meta": {
    "source": "student_dashboard"
  }
}
```

Response:

```json
{
  "ok": true,
  "insight": {
    "id": "9b52d770-7b9d-4b4c-a1b9-7f5136ebf8d7",
    "status": "dismissed"
  },
  "action_id": "5c064eb2-0114-4f92-8668-bf8934ce54d6"
}
```

### 3) POST `/api/cron/generate-insights`
QStash/service-role endpoint that runs daily and inserts deduped insights.

Response:

```json
{
  "ok": true,
  "generated": 186,
  "expired": 42,
  "by_type": {
    "deadline_risk": 44,
    "stalled_progress": 68,
    "score_drop": 17,
    "assignment_follow_up": 21,
    "win": 36
  }
}
```

## Rule Inputs (Per Insight)

### `deadline_risk`
Use:

1. `assignments.deadline_date`
2. `assignment_submissions.status`
3. `assignments.cohort_ids` + learner `students.cohort_id`

Create insight when:

1. learner is in assignment cohort
2. `status` is not `submitted`/`graded`
3. `deadline_date - current_date <= 2`

### `stalled_progress`
Use:

1. `course_attempts.updated_at`, `completed_at`
2. `guided_project_attempts.updated_at`, `completed_at`

Create insight when:

1. not completed
2. last update >= 7 days ago

### `score_drop`
Use latest two completed `course_attempts` rows per `student_id + course_id`.

Create insight when:

1. both attempts completed
2. latest score <= previous score - 15

### `assignment_follow_up`
Use assignments in learner cohort where due date has passed and submission missing.

Create insight when:

1. overdue count >= 2 in rolling 14 days

### `win`
Use completed `course_attempts` and `assignment_submissions` in last 24 hours.

Create insight when:

1. any completion in last 24h
2. emit max 1 `win` card/day (via dedupe key)

## Dedupe Key Convention
Use deterministic keys:

1. `deadline_risk:{content_id}`
2. `stalled_progress:course:{content_id}`
3. `stalled_progress:ve:{content_id}`
4. `score_drop:{content_id}`
5. `assignment_follow_up:rolling14`
6. `win:daily`

## Suggested UI Placement
In learner dashboard (`app/student/page.tsx`):

1. New "Insights" strip near top (between hero and section cards)
2. Sort by severity: `critical`, `warning`, `info`
3. One-tap CTA button from `action.label/action.url`
4. Dismiss button posts `/api/insights/student/action`

## Important Schema Note
Current runtime code uses `sent_nudges.form_id`, but the consolidated schema snapshot does not show this column in `CREATE TABLE public.sent_nudges`.

Before shipping insight-generated nudges, verify and normalize this table shape so dedupe writes do not fail.

