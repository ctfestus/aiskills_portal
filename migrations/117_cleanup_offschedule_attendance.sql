-- 117_cleanup_offschedule_attendance
-- One-off data cleanup. Earlier, /api/join recorded a live_attendance row on
-- ANY click, using the click's calendar day as session_date with no schedule
-- check. That created phantom sessions on days the meeting never ran (e.g. a
-- weekly-Saturday event picking up Sunday/Wednesday clicks), inflating both the
-- session count and the "missed" totals in the attendance report.
--
-- The join handler now gates writes with isScheduledSessionDate(), so no new
-- off-schedule rows are created. This migration removes the existing ones.
--
-- A row is kept only when its session_date is an actual scheduled occurrence of
-- its event. recurrence_days uses 0=Sunday..6=Saturday, matching JS getUTCDay()
-- and Postgres EXTRACT(DOW), so the two implementations agree.

DELETE FROM public.live_attendance la
USING public.events e
WHERE la.event_id = e.id
  AND NOT (
    e.event_date IS NOT NULL
    AND la.session_date >= e.event_date
    AND (
      -- One-time events run only on their single date.
      ((e.recurrence = 'once' OR e.recurrence IS NULL) AND la.session_date = e.event_date)
      OR
      -- Daily events run every day up to the end date (if any).
      (e.recurrence = 'daily'
        AND (e.recurrence_end_date IS NULL OR la.session_date <= e.recurrence_end_date))
      OR
      -- Weekly events run on the selected weekdays up to the end date (if any),
      -- falling back to the weekday of event_date when no days are stored.
      (e.recurrence = 'weekly'
        AND (e.recurrence_end_date IS NULL OR la.session_date <= e.recurrence_end_date)
        AND (
          CASE
            WHEN e.recurrence_days IS NOT NULL AND array_length(e.recurrence_days, 1) > 0
              THEN EXTRACT(DOW FROM la.session_date)::int = ANY (e.recurrence_days)
            ELSE EXTRACT(DOW FROM la.session_date)::int = EXTRACT(DOW FROM e.event_date)::int
          END
        )
      )
    )
  );
