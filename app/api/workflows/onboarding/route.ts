/**
 * Onboarding email sequence -- powered by Upstash Workflow.
 * Durable multi-step flow that survives server restarts and Vercel cold starts.
 *
 * Steps:
 *   Immediately   Welcome email
 *   Day 3         Check-in: did they start a course?
 *   Day 7         Encouragement: celebrate progress or nudge if stalled
 */
import { serve } from '@upstash/workflow/nextjs';
import { Resend } from 'resend';
import { adminClient } from '@/lib/subscription';
import {
  welcomeEmail,
  day3CheckInEmail,
  day7EncouragementEmail,
} from '@/lib/email-templates';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://app.aiskillsafrica.com';

const DAY = 24 * 60 * 60 * 1000; // ms

export const { POST } = serve<{ email: string; name: string; userId: string }>(
  async (context) => {
    const { email, name, userId } = context.requestPayload;
    const studentUrl = `${APP_URL}/student`;
    const supabase   = adminClient();

    // -- Step 1: Welcome email (immediate) ---
    await context.run('send-welcome', async () => {
      await resend.emails.send({
        from:    FROM,
        to:      email,
        subject: `Welcome to AI Skills Africa, ${name}! 🎉`,
        html:    welcomeEmail({ name, studentUrl }),
      });
    });

    // -- Wait 3 days ---
    await context.sleep('wait-3-days', 3 * DAY / 1000); // Upstash sleep takes seconds

    // -- Step 2: Day-3 check-in ---
    await context.run('day3-checkin', async () => {
      // Find the first published course assigned to this student's cohort
      const { data: student } = await supabase
        .from('students')
        .select('cohort_id')
        .eq('id', userId)
        .single();

      let courseTitle: string | undefined;
      let courseUrl:   string | undefined;

      if (student?.cohort_id) {
        const { data: form } = await supabase
          .from('forms')
          .select('title, slug, id')
          .contains('cohort_ids', [student.cohort_id])
          .eq('status', 'published')
          .in('content_type', ['course'])
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (form) {
          courseTitle = form.title;
          courseUrl   = `${APP_URL}/${form.slug || form.id}?go=1`;
        }
      }

      await resend.emails.send({
        from:    FROM,
        to:      email,
        subject: `${name}, your courses are waiting for you 👋`,
        html:    day3CheckInEmail({ name, studentUrl, courseTitle, courseUrl }),
      });
    });

    // -- Wait 4 more days (7 days total) ---
    await context.sleep('wait-4-more-days', 4 * DAY / 1000);

    // -- Step 3: Day-7 encouragement ---
    await context.run('day7-encouragement', async () => {
      // Check how many courses completed so far
      const { data: attempts } = await supabase
        .from('course_attempts')
        .select('form_id')
        .eq('student_email', email)
        .eq('passed', true)
        .not('completed_at', 'is', null);

      const completedFormIds = [...new Set((attempts ?? []).map((a: any) => a.form_id))];
      const coursesCompleted = completedFormIds.length;
      const hasStarted       = (attempts ?? []).length > 0 || coursesCompleted > 0;

      await resend.emails.send({
        from:    FROM,
        to:      email,
        subject: coursesCompleted > 0
          ? `${name}, look how far you have come! 🏆`
          : hasStarted
            ? `Keep going, ${name} -- you are almost there! 💪`
            : `${name}, your learning journey is still waiting for you`,
        html: day7EncouragementEmail({ name, studentUrl, hasStarted, coursesCompleted }),
      });
    });
  },
);
