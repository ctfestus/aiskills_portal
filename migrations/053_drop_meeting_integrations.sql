-- Meeting integration feature has been removed from the platform.
-- Drop both tables that were used inconsistently across the removed routes.

DROP TABLE IF EXISTS public.meeting_integrations;
DROP TABLE IF EXISTS public.user_integrations;
