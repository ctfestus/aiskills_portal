-- 135: allow the 'auto' appearance mode.
--
-- `mode` stores the creator's chosen appearance mode. 'auto' was already a valid
-- value in the content contract (lib/theme-types.ts ThemeMode) and offered in the
-- editors, but the CHECK constraint only allowed 'light'/'dark', so saving 'auto'
-- failed with a constraint violation. Only courses and events expose an appearance
-- mode picker (the shared create editor + FormEditor, which edits course|event),
-- so those are the two tables that can receive 'auto'. At runtime 'auto' follows
-- the app theme the viewer has selected (not the OS device).

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_mode_check,
  ADD  CONSTRAINT courses_mode_check CHECK (mode IN ('light','dark','auto'));

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_mode_check,
  ADD  CONSTRAINT events_mode_check CHECK (mode IN ('light','dark','auto'));
