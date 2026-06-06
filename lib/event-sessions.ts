// Shared logic for deciding whether a given calendar date is a scheduled
// occurrence of a live-session event. Used both to gate attendance writes
// (so a stray click on an off-schedule day cannot invent a session) and to
// filter the attendance report (so existing off-schedule rows stop distorting
// the session count and missed totals).

export interface EventSchedule {
  event_date?: string | null;
  recurrence?: string | null;
  recurrence_end_date?: string | null;
  recurrence_days?: number[] | null;
}

// Timezones are stored as fixed GMT offsets like "GMT+0 (Accra)" or "GMT+5:30 (IST)".
// Returns the offset in minutes, or null if it can't be parsed.
export function parseGmtOffsetMinutes(timezone?: string | null): number | null {
  if (!timezone) return null;
  const m = timezone.match(/GMT\s*([+-])\s*(\d{1,2})(?::(\d{2}))?/i);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const hours = parseInt(m[2], 10);
  const mins = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (hours * 60 + mins);
}

// Today's calendar date (YYYY-MM-DD) in the event's timezone. Attendance must be
// gated and stamped against the event-local day, not the server's UTC day, or a
// click at the correct local time near UTC midnight lands on the wrong date.
export function eventLocalDate(timezone?: string | null, now: Date = new Date()): string {
  const offsetMin = parseGmtOffsetMinutes(timezone);
  if (offsetMin === null) return now.toISOString().slice(0, 10); // fall back to UTC
  return new Date(now.getTime() + offsetMin * 60_000).toISOString().slice(0, 10);
}

// dateStr must be a YYYY-MM-DD calendar date (UTC). Returns true when that date
// is an actual scheduled occurrence of the event.
export function isScheduledSessionDate(event: EventSchedule | null | undefined, dateStr: string): boolean {
  if (!event?.event_date || !dateStr) return false;

  // Nothing before the series starts counts.
  if (dateStr < event.event_date) return false;

  // One-time events only run on their single date.
  if (event.recurrence === 'once' || !event.recurrence) {
    return dateStr === event.event_date;
  }

  // Recurring events must fall on or before the end date, when one is set.
  if (event.recurrence_end_date && dateStr > event.recurrence_end_date) return false;

  if (event.recurrence === 'daily') return true;

  if (event.recurrence === 'weekly') {
    const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
    const targetDays =
      Array.isArray(event.recurrence_days) && event.recurrence_days.length > 0
        ? event.recurrence_days
        : [new Date(event.event_date + 'T12:00:00Z').getUTCDay()]; // fall back to the weekday of event_date
    return targetDays.includes(day);
  }

  return false;
}
