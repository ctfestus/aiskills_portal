const BANNER = 'https://zcbsjhuhnqhobqtlkkgv.supabase.co/storage/v1/object/public/media-assets/FestMan.jpg';
const APP_URL = process.env.APP_URL || 'https://festforms.com';

// -- Shared shell ---
function shell(content: string, bannerUrl?: string) {
  const resolvedBanner = bannerUrl || BANNER;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table style="max-width:600px;width:100%;margin:0 auto;" cellpadding="0" cellspacing="0">

        <!-- Banner -->
        <tr><td>
          <img
            src="${resolvedBanner}"
            alt="AI Skills Africa"
            width="600"
            style="width:100%;height:auto;display:block;"
          />
        </td></tr>

        <!-- Content -->
        <tr><td style="padding:20px;">
          ${content}

          <!-- Footer -->
          <p style="font-size:12px;color:#a1a1aa;margin-top:24px;">
            You received this because you submitted a form on AI Skills Africa. &middot;
            <a href="${APP_URL}" style="color:#2563eb;">Visit AI Skills Africa</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function cta(label: string, url: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr><td>
      <a href="${url}" style="background-color:#2563eb;color:#ffffff;padding:14px 26px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">${label}</a>
    </td></tr>
  </table>`;
}

function detailBlock(label: string, value: string) {
  return `<p style="margin:4px 0;"><b>${label}:</b> ${value}</p>`;
}

// -- helpers for meeting platform ---
function platformName(url?: string): string {
  if (!url) return 'Meeting Link';
  const u = url.toLowerCase();
  if (u.includes('meet.google.com')) return 'Google Meet';
  if (u.includes('zoom.us')) return 'Zoom';
  if (u.includes('teams.microsoft.com') || u.includes('teams.live.com')) return 'Microsoft Teams';
  return 'Join Meeting';
}
function platformColor(url?: string): string {
  if (!url) return '#1f1bc3';
  const u = url.toLowerCase();
  if (u.includes('meet.google.com')) return '#1a73e8';
  if (u.includes('zoom.us')) return '#2d8cff';
  if (u.includes('teams.microsoft.com') || u.includes('teams.live.com')) return '#6264a7';
  return '#1f1bc3';
}

// -- 1. Event Registration Confirmation ---
export function confirmationEmail(data: {
  name?: string;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  eventTimezone?: string;
  meetingLink?: string;
  eventType?: string;
  formUrl: string;
  customTitle?: string;
  customBody?: string;
  bannerUrl?: string;
}) {
  const { name, eventTitle, eventDate, eventTime, eventLocation, eventTimezone, meetingLink, formUrl, customTitle, customBody, bannerUrl } = data;

  const meetingBlock = meetingLink ? `
    <div style="margin:16px 0;padding:16px;background:#f0f7ff;border-radius:10px;border:1px solid #c5deff;text-align:center;">
      <p style="margin:0 0 10px;font-weight:600;color:#333;">${platformName(meetingLink)}</p>
      <a href="${meetingLink}" style="display:inline-block;padding:10px 24px;background:${platformColor(meetingLink)};color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Join Meeting -></a>
      <p style="margin:8px 0 0;font-size:12px;color:#888;">Keep this link. You will need it to attend.</p>
    </div>` : '';

  const content = `
    <p><b>Hi ${name || 'there'},</b></p>
    <p>${customBody || 'Your registration has been confirmed. We look forward to seeing you!'}</p>

    <p style="font-size:18px;font-weight:bold;margin-top:16px;">${customTitle || 'Registration Confirmed ✓'}</p>
    <p><b>${eventTitle}</b></p>

    ${eventDate ? detailBlock('Date', [eventDate, eventTime, eventTimezone].filter(Boolean).join(' · ')) : ''}
    ${eventLocation ? detailBlock('Location', eventLocation) : ''}
    ${meetingBlock}

    ${cta('View Event', formUrl)}

    <p>Keep this email for your records. You'll receive a reminder before the event starts.</p>
    <br>
    <p><b>Best regards,</b></p>
    <p>The AI Skills Africa Team</p>
  `;

  return shell(content, bannerUrl);
}

// -- 2. Event Reminder ---
export function reminderEmail(data: {
  name?: string;
  eventTitle: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  eventTimezone?: string;
  meetingLink?: string;
  formUrl: string;
  isOneHour?: boolean;
  bannerUrl?: string;
}) {
  const { name, eventTitle, eventDate, eventTime, eventLocation, eventTimezone, meetingLink, formUrl, isOneHour, bannerUrl } = data;
  const timeLabel = isOneHour ? '1 hour' : 'tomorrow';

  const meetingBlock = meetingLink ? `
    <div style="margin:16px 0;padding:16px;background:#f0f7ff;border-radius:10px;border:1px solid #c5deff;text-align:center;">
      <p style="margin:0 0 10px;font-weight:600;color:#333;">${platformName(meetingLink)}</p>
      <a href="${meetingLink}" style="display:inline-block;padding:10px 24px;background:${platformColor(meetingLink)};color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Join Meeting -></a>
    </div>` : '';

  const content = `
    <p><b>Hi ${name || 'there'},</b></p>
    <p>This is a friendly reminder that <b>${eventTitle}</b> is starting in <b>${timeLabel}</b>${isOneHour ? '. Get ready!' : '.'}</p>

    <p style="font-size:18px;font-weight:bold;margin-top:16px;">Event Reminder</p>
    <p><b>${eventTitle}</b></p>

    ${eventDate ? detailBlock('Date', [eventDate, eventTime, eventTimezone].filter(Boolean).join(' · ')) : ''}
    ${eventLocation ? detailBlock('Location', eventLocation) : ''}
    ${meetingBlock}

    ${cta('View Event Details', formUrl)}

    <p>You can access your dashboard anytime to view your upcoming events.</p>
    <br>
    <p><b>Best regards,</b></p>
    <p>The AI Skills Africa Team</p>
  `;

  return shell(content, bannerUrl);
}

// -- 3. Course Result ---
export function courseResultEmail(data: {
  name?: string;
  courseTitle: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  points?: number;
  passmark?: number;
  formUrl: string;
  certUrl?: string;
}) {
  const { name, courseTitle, score, total, percentage, passed, points, passmark, formUrl, certUrl } = data;

  const content = `
    <p><b>Hi ${name || 'there'},</b></p>
    <p>${passed ? 'Congratulations! You passed the course. Well done! 🎉' : 'Thanks for completing the course. Keep practising. You can retake it to improve your score.'}</p>

    <p style="font-size:18px;font-weight:bold;margin-top:16px;">Your Course Result</p>
    <p><b>${courseTitle}</b></p>

    ${detailBlock('Score', `${score} / ${total}`)}
    ${detailBlock('Percentage', `${percentage}%`)}
    ${detailBlock('Result', passed ? '✓ Passed' : 'Failed')}
    ${passmark ? detailBlock('Pass mark', `${passmark}%`) : ''}
    ${points ? detailBlock('XP Earned', `⭐ ${points.toLocaleString()} XP`) : ''}

    ${certUrl ? cta('🎓 View Your Certificate', certUrl) : cta('View Course', formUrl)}

    <p>${certUrl ? 'Your certificate is ready to view, download, and share.' : 'You can access your dashboard anytime to continue learning and track your progress.'}</p>
    <br>
    <p><b>Best regards,</b></p>
    <p>The AI Skills Africa Team</p>
  `;

  return shell(content);
}

// -- 4. Course OTP Verification ---
export function otpEmail(data: { code: string; courseName?: string }) {
  const { code, courseName } = data;

  const content = `
    <p><b>Hi there,</b></p>
    <p>Use the code below to verify your email and start${courseName ? ` <b>${courseName}</b>` : ' the course'}. This code expires in <b>10 minutes</b>.</p>

    <p style="font-size:18px;font-weight:bold;margin-top:16px;">Your Verification Code</p>

    <div style="margin:20px 0;padding:24px;background:#f0fdf4;border:2px solid #22c55e;border-radius:10px;text-align:center;">
      <span style="font-size:36px;font-weight:900;letter-spacing:0.3em;color:#16a34a;font-family:'Courier New',Courier,monospace;">${code}</span>
    </div>

    <p>Enter this code on the course page to continue. Do not share it with anyone.</p>
    <p style="color:#a1a1aa;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
    <br>
    <p><b>Best regards,</b></p>
    <p>The AI Skills Africa Team</p>
  `;

  return shell(content);
}

// -- 5. Student Nudge (not started / stalled) ---
export function nudgeEmail(data: {
  name: string;
  contentTitle: string;
  contentType: string;
  status: 'not_started' | 'stalled';
  formUrl: string;
}) {
  const { name, contentTitle, contentType, status, formUrl } = data;
  const typeLabel = contentType === 'virtual_experience' ? 'virtual experience' : contentType;
  const ctaLabel  = status === 'not_started' ? `Start ${typeLabel}` : 'Continue where you left off';

  const intro = status === 'not_started'
    ? `We noticed you have not started <b>${contentTitle}</b> yet. We just wanted to reach out with a little encouragement.`
    : `We noticed you have not visited <b>${contentTitle}</b> in a while. We are checking in because we believe in you and do not want you to miss out.`;

  const content = `
    <p><b>Hi ${name},</b></p>
    <p>${intro}</p>

    <div style="margin:20px 0;padding:20px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;">
      <p style="margin:0 0 10px;font-weight:700;color:#15803d;font-size:15px;">Why upskilling matters 🚀</p>
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
        In today's fast-moving world, the skills you build today directly shape the opportunities you unlock tomorrow.
        Every lesson you complete, every challenge you tackle puts you ahead -- and the learning you do here is
        directly relevant to real roles in the industry.
      </p>
    </div>

    ${status === 'stalled' ? `
    <p style="color:#374151;">
      <b>You've already taken the first step</b> -- which is the hardest part. Getting back on track is easier than you think.
      Remember why you started, and know that each module you complete brings you closer to a real skill you can use.
    </p>` : `
    <p style="color:#374151;">
      It only takes a few minutes to begin. Once you start, you will find the content is practical, relevant, and designed
      to give you real skills. Not just theory.
    </p>`}

    <div style="margin:20px 0;padding:20px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;">
      <p style="margin:0 0 6px;font-weight:700;color:#92400e;font-size:14px;">Need support? We are here for you. 🤝</p>
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
        If anything felt unclear, you got stuck, or life simply got in the way. Please do not hesitate to reach out.
        Our team is available to help you through any challenges. You are not on this journey alone.
      </p>
    </div>

    ${cta(ctaLabel, formUrl)}

    <br>
    <p><b>Best regards,</b></p>
    <p>AI Skills Africa - Learning Experience Team</p>
  `;

  return shell(content);
}

// -- 6. 80% Milestone ---
export function milestoneEmail(data: {
  name: string;
  contentTitle: string;
  contentType: string;
  formUrl: string;
}) {
  const { name, contentTitle, contentType, formUrl } = data;
  const typeLabel = contentType === 'virtual_experience' ? 'virtual experience' : contentType;

  const content = `
    <p><b>Hi ${name},</b></p>
    <p>You are <b>80% of the way through</b> <b>${contentTitle}</b>. That is incredible progress! 🎉</p>

    <div style="margin:20px 0;padding:20px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;text-align:center;">
      <div style="font-size:40px;font-weight:900;color:#16a34a;">80%</div>
      <div style="font-size:14px;color:#15803d;font-weight:600;margin-top:4px;">Almost there!</div>
    </div>

    <p style="color:#374151;">
      You have put in the hard work and you are so close to the finish line. Do not stop now.
      Completing this ${typeLabel} will add a real, demonstrable skill to your profile.
    </p>

    <div style="margin:20px 0;padding:16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;">
      <p style="margin:0;font-weight:700;color:#92400e;font-size:14px;">💡 Did you know?</p>
      <p style="margin:8px 0 0;color:#374151;font-size:14px;line-height:1.7;">
        Students who reach 80% completion are <b>3× more likely to finish</b>. You are already in that group.
        One final push and you will have something to be genuinely proud of.
      </p>
    </div>

    ${cta('Finish strong ', formUrl)}

    <br>
    <p><b>Best regards,</b></p>
    <p>AI Skills Africa - Learning Experience Team</p>
  `;

  return shell(content);
}

// -- 7. Weekly Digest ---
export function weeklyDigestEmail(data: {
  name: string;
  completed: { title: string; contentType: string; score?: number | null }[];
  inProgress: { title: string; contentType: string }[];
  dashboardUrl: string;
}) {
  const { name, completed, inProgress, dashboardUrl } = data;

  const typeLabel = (t: string) => t === 'virtual_experience' ? 'Virtual Experience' : t === 'course' ? 'Course' : t;

  const completedRows = completed.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <span style="display:inline-block;width:20px;text-align:center;">✅</span>
        <b style="color:#111;">${item.title}</b>
        <span style="margin-left:8px;font-size:12px;color:#6b7280;">${typeLabel(item.contentType)}${item.score != null ? ` · Score: ${item.score}%` : ''}</span>
      </td>
    </tr>`).join('');

  const inProgressRows = inProgress.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <span style="display:inline-block;width:20px;text-align:center;">📚</span>
        <b style="color:#111;">${item.title}</b>
        <span style="margin-left:8px;font-size:12px;color:#6b7280;">${typeLabel(item.contentType)} · In progress</span>
      </td>
    </tr>`).join('');

  const content = `
    <p><b>Hi ${name},</b></p>
    <p>Here's a look at your learning activity this week. Keep the momentum going! 🚀</p>

    ${completed.length > 0 ? `
    <p style="font-size:15px;font-weight:700;color:#111;margin-top:24px;">What you completed this week</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;">
      ${completedRows}
    </table>` : ''}

    ${inProgress.length > 0 ? `
    <p style="font-size:15px;font-weight:700;color:#111;margin-top:24px;">Still in progress. You have got this!</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0;">
      ${inProgressRows}
    </table>` : ''}

    <div style="margin:24px 0;padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;">
      <p style="margin:0;color:#15803d;font-size:14px;line-height:1.7;">
        <b>Every week counts.</b> The skills you are building here open doors to real opportunities.
        Consistency is the single most powerful habit you can build as a learner.
      </p>
    </div>

    ${cta('Continue learning', dashboardUrl)}

    <br>
    <p><b>Best regards,</b></p>
    <p>AI Skills Africa - Learning Experience Team</p>
  `;

  return shell(content);
}

// -- 8. Blast / Announcement ---
export function deadlineReminderEmail(data: {
  name: string;
  contentTitle: string;
  contentType: string;
  formUrl: string;
  daysLeft: number;
}) {
  const { name, contentTitle, contentType, formUrl, daysLeft } = data;
  const typeLabel = contentType === 'course' ? 'course' : 'virtual experience';
  const urgency = daysLeft <= 0 ? 'Your deadline has passed'
    : daysLeft === 1 ? 'You have 1 day left'
    : `You have ${daysLeft} days left`;
  const urgencyColor = daysLeft <= 0 ? '#ef4444' : daysLeft <= 1 ? '#dc2626' : '#f59e0b';

  const content = `
    <h2 style="color:#111;font-size:22px;margin-bottom:8px;">⏰ ${urgency}</h2>
    <p>Hi ${name},</p>
    <p>This is a reminder that your deadline for the following ${typeLabel} is approaching:</p>
    <div style="background:#f9fafb;border-left:4px solid ${urgencyColor};border-radius:4px;padding:16px;margin:16px 0;">
      <p style="font-weight:700;font-size:16px;margin:0;">${contentTitle}</p>
      <p style="color:#ef4444;font-weight:600;margin:6px 0 0;">${urgency}</p>
    </div>
    <p>Do not let your progress go to waste. Every skill you build today is an investment in your future career. Log in now and keep going.</p>
    <p style="background:#f0fdf4;border-radius:8px;padding:12px;font-size:14px;color:#166534;">
      💡 <b>Quick tip:</b> Even 15 minutes of focused learning counts. You can do this!
    </p>
    ${cta('Complete Now', formUrl)}
    <p>If you need any help or have questions, our team is always here for you. Just reply to this email.</p>
    <br>
    <p><b>Best regards,</b></p>
    <p>AI Skills Africa - Learning Experience Team</p>
  `;

  return shell(content);
}

export function blastEmail(data: {
  subject: string;
  body: string;
  senderName?: string;
  formTitle: string;
  formUrl: string;
  bannerUrl?: string;
  ctaLabel?: string;
}) {
  const { body, senderName, formTitle, formUrl, bannerUrl, ctaLabel } = data;

  const content = `
    <p>${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>

    ${cta(ctaLabel || 'View Page', formUrl)}

    <br>
    <p><b>Best regards,</b></p>
    <p>${senderName || formTitle}</p>
  `;

  return shell(content, bannerUrl);
}
