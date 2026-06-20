import { describe, expect, it } from 'vitest';
import {
  getLastScheduledSessionDate,
  getNextScheduledSessionDate,
  isScheduledSessionDate,
} from '@/lib/event-sessions';

describe('event session recurrence helpers', () => {
  it('returns the next weekly session instead of the historical start date', () => {
    const event = {
      event_date: '2026-01-03',
      recurrence: 'weekly',
      recurrence_days: [6],
    };

    expect(getNextScheduledSessionDate(event, '2026-06-20')).toBe('2026-06-20');
    expect(getNextScheduledSessionDate(event, '2026-06-21')).toBe('2026-06-27');
  });

  it('returns the most recent real occurrence for an ended recurring series', () => {
    const event = {
      event_date: '2026-01-03',
      recurrence: 'weekly',
      recurrence_days: [6],
      recurrence_end_date: '2026-06-13',
    };

    expect(getNextScheduledSessionDate(event, '2026-06-20')).toBeNull();
    expect(getLastScheduledSessionDate(event, '2026-06-20')).toBe('2026-06-13');
  });

  it('falls back to the start weekday when weekly days are empty', () => {
    const event = {
      event_date: '2026-01-07',
      recurrence: 'weekly',
      recurrence_days: [],
    };

    expect(isScheduledSessionDate(event, '2026-01-14')).toBe(true);
    expect(isScheduledSessionDate(event, '2026-01-15')).toBe(false);
    expect(getNextScheduledSessionDate(event, '2026-01-08')).toBe('2026-01-14');
  });

  it('separates future and past one-time events', () => {
    const event = {
      event_date: '2026-06-22',
      recurrence: 'once',
    };

    expect(getNextScheduledSessionDate(event, '2026-06-20')).toBe('2026-06-22');
    expect(getNextScheduledSessionDate(event, '2026-06-23')).toBeNull();
    expect(getLastScheduledSessionDate(event, '2026-06-23')).toBe('2026-06-22');
  });
});
