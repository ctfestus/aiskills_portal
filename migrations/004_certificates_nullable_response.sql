-- Allow certificates to be issued without a response_id (for guided projects)
ALTER TABLE public.certificates ALTER COLUMN response_id DROP NOT NULL;
