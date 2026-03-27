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
      <p style="margin:8px 0 0;font-size:12px;color:#888;">Keep this link -- you'll need it to attend.</p>
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
    <p>This is a friendly reminder that <b>${eventTitle}</b> is starting in <b>${timeLabel}</b>${isOneHour ? ' -- get ready!' : '.'}</p>

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
    <p>${passed ? 'Congratulations! You passed the course. Well done! 🎉' : 'Thanks for completing the course. Keep practicing -- you can retake it to improve your score.'}</p>

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
    <p style="color:#a1a1aa;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    <br>
    <p><b>Best regards,</b></p>
    <p>The AI Skills Africa Team</p>
  `;

  return shell(content);
}

// -- 5. Blast / Announcement ---
export function blastEmail(data: {
  subject: string;
  body: string;
  senderName?: string;
  formTitle: string;
  formUrl: string;
  bannerUrl?: string;
}) {
  const { body, senderName, formTitle, formUrl, bannerUrl } = data;

  const content = `
    <p>${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>

    ${cta('View Page', formUrl)}

    <br>
    <p><b>Best regards,</b></p>
    <p>${senderName || formTitle}</p>
  `;

  return shell(content, bannerUrl);
}
