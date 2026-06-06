// Shared "Add to Calendar" builders, used by the public registration page and
// the student dashboard event card so both stay in sync.
//
// Recurring events: Google Calendar and the .ics download carry a full RRULE
// (BYDAY + UNTIL), so every future session is added as a series, not a single
// date. Outlook.com and Yahoo web compose URLs have no way to encode recurrence,
// so for recurring events those options are not offered (see isRecurring) and
// the .ics download is the reliable cross-platform way to get the whole series.

import { parseGmtOffsetMinutes } from '@/lib/event-sessions';

const pad = (n: number) => String(n).padStart(2, '0');

// Parse a YYYY-MM-DD date string without applying the user's device timezone.
const parseDateParts = (date: string): [number, number, number] | null => {
  const parts = date.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return [parts[0], parts[1], parts[2]];
};

const parseLocalDate = (date: string): Date | null => {
  const parts = parseDateParts(date);
  if (!parts) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const parseTimeParts = (time: string): [number, number] => {
  const timeParts = (time ?? '').split(':');
  return [timeParts[0] ? +timeParts[0] : 9, timeParts[1] ? +timeParts[1] : 0];
};

// The stored event time is local wall-clock in the event's timezone (a fixed GMT
// offset). True UTC instant = local - offset. Without this, a non-GMT+0 event
// would be stamped at the wrong hour in the calendar entry.
const utcDateFor = (date: string, time: string, timezone?: string | null, addHours = 0): Date | null => {
  const parts = parseDateParts(date);
  if (!parts) return null;
  const [h, m] = parseTimeParts(time);
  const offsetMin = parseGmtOffsetMinutes(timezone) ?? 0;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], h + addHours, m, 0) - offsetMin * 60_000);
};

const fmtUtcCompact = (dt: Date) =>
  `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;

const fmtUtcIso = (dt: Date) => dt.toISOString().replace(/\.\d{3}Z$/, 'Z');

const fmtUtcIcs = (dt: Date) =>
  `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;

const DAY_MAP = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const buildRRule = (recurrence?: string, endDate?: string, days?: number[]): string | null => {
  if (!recurrence || recurrence === 'once') return null;
  let rule = `RRULE:FREQ=${recurrence === 'weekly' ? 'WEEKLY' : 'DAILY'}`;
  if (recurrence === 'weekly' && days?.length) rule += `;BYDAY=${days.map(d => DAY_MAP[d]).join(',')}`;
  if (endDate) {
    const ed = parseLocalDate(endDate);
    if (ed) rule += `;UNTIL=${ed.getFullYear()}${pad(ed.getMonth() + 1)}${pad(ed.getDate())}T235959Z`;
  }
  return rule;
};

// True when the event repeats -- only Google and .ics can represent the series.
export const isRecurring = (recurrence?: string | null): boolean =>
  !!recurrence && recurrence !== 'once';

// Decide what goes in the calendar entry's location/description. For virtual
// events the tracked join link is embedded in both, so attendance is recorded
// when a student joins straight from their calendar reminder. The join link
// MUST be absolute -- a relative path does not resolve inside a calendar app.
export function buildCalendarFields(opts: {
  isVirtual: boolean; joinUrl: string; location?: string | null; description?: string | null;
}): { calLocation: string; calDescription: string } {
  const { isVirtual, joinUrl, location, description } = opts;
  const calLocation = isVirtual ? joinUrl : (location ?? '');
  const calDescription = [description ?? '', isVirtual && joinUrl ? `Join: ${joinUrl}` : '']
    .filter(Boolean).join('\n\n');
  return { calLocation, calDescription };
}

export const buildGoogleCalUrl = (title: string, date: string, time: string, timezone: string | null | undefined, location: string, description: string, recurrence?: string, recurrenceEndDate?: string, recurrenceDays?: number[]) => {
  const startD = utcDateFor(date, time, timezone);
  const endD = utcDateFor(date, time, timezone, 2);
  if (!startD || !endD) return null;
  const start = fmtUtcCompact(startD);
  const end = fmtUtcCompact(endD);
  const enc = encodeURIComponent;
  const rrule = buildRRule(recurrence, recurrenceEndDate, recurrenceDays);
  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(title)}&dates=${start}/${end}&location=${enc(location)}&details=${enc(description)}`;
  if (rrule) url += `&recur=${enc(rrule)}`;
  return url;
};

export const buildOutlookCalUrl = (title: string, date: string, time: string, timezone: string | null | undefined, location: string, description: string) => {
  const d = utcDateFor(date, time, timezone);
  const end = utcDateFor(date, time, timezone, 2);
  if (!d || !end) return null;
  const enc = encodeURIComponent;
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${enc(title)}&startdt=${enc(fmtUtcIso(d))}&enddt=${enc(fmtUtcIso(end))}&location=${enc(location)}&body=${enc(description)}`;
};

export const buildYahooCalUrl = (title: string, date: string, time: string, timezone: string | null | undefined, location: string, description: string) => {
  const startD = utcDateFor(date, time, timezone);
  const endD = utcDateFor(date, time, timezone, 2);
  if (!startD || !endD) return null;
  const start = fmtUtcCompact(startD);
  const end = fmtUtcCompact(endD);
  const enc = encodeURIComponent;
  return `https://calendar.yahoo.com/?v=60&title=${enc(title)}&st=${start}&et=${end}&in_loc=${enc(location)}&desc=${enc(description)}`;
};

// Escape a value for an ICS text field (RFC 5545): backslash, semicolon, comma
// and newlines must be escaped, otherwise a real newline terminates the property
// and the rest of the text (e.g. the "Join:" line) is dropped or breaks parsing.
const icsEscape = (s: string) => s
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

// Build and download a .ics file. Carries the RRULE so recurring events import
// as a full series across Apple Calendar, Outlook, and others.
export const downloadIcs = (title: string, date: string, time: string, timezone: string | null | undefined, location: string, description: string, recurrence?: string, recurrenceEndDate?: string, recurrenceDays?: number[]) => {
  const d = utcDateFor(date, time, timezone);
  const end = utcDateFor(date, time, timezone, 2);
  if (!d || !end) return;
  const rrule = buildRRule(recurrence, recurrenceEndDate, recurrenceDays);
  // UID + DTSTAMP are required by RFC 5545 -- Apple Calendar rejects events without them.
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const host = typeof window !== 'undefined' ? window.location.hostname : 'calendar';
  const uid = `${fmtUtcIcs(d)}-${Math.random().toString(36).slice(2)}@${host}`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Calendar//Event//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${dtstamp}`,
    `SUMMARY:${icsEscape(title)}`, `DTSTART:${fmtUtcIcs(d)}`, `DTEND:${fmtUtcIcs(end)}`,
    `LOCATION:${icsEscape(location)}`, `DESCRIPTION:${icsEscape(description.replace(/<[^>]*>/g, ''))}`,
    ...(rrule ? [rrule] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
  a.download = `${title.replace(/\s+/g, '-')}.ics`;
  a.click();
};
