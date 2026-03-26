-- ============================================================
-- FestForms Certificate System Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Certificates table (one per student per course)
CREATE TABLE IF NOT EXISTS public.certificates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       uuid REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  response_id   uuid REFERENCES public.responses(id) ON DELETE CASCADE NOT NULL,
  student_name  text NOT NULL,
  student_email text,
  issued_at     timestamptz DEFAULT now(),
  revoked       boolean DEFAULT false,
  revoked_at    timestamptz,
  UNIQUE (response_id)
);

-- Prevent the same email from getting multiple active certificates for the same course
-- (partial unique index: only one non-revoked cert per email per form)
CREATE UNIQUE INDEX IF NOT EXISTS certificates_unique_active_student
  ON public.certificates (form_id, student_email)
  WHERE revoked = false AND student_email IS NOT NULL;

-- 2. Certificate design settings (one design per course form)
CREATE TABLE IF NOT EXISTS public.certificate_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id              uuid REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL UNIQUE,
  institution_name     text DEFAULT 'FestMan',
  primary_color        text DEFAULT '#0b07d5',
  accent_color         text DEFAULT '#ff9500',
  background_image_url text,
  logo_url             text,
  signature_url        text,
  signatory_name       text DEFAULT '',
  signatory_title      text DEFAULT '',
  certify_text         text DEFAULT 'This is to certify that',
  completion_text      text DEFAULT 'has successfully completed',
  font_family          text DEFAULT 'serif',
  heading_size         text DEFAULT 'md',
  padding_top          integer DEFAULT 280,
  padding_left         integer DEFAULT 182,
  line_spacing         text DEFAULT 'normal',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- 3. RLS Policies for certificates
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- No public SELECT policy — anon clients must not be able to enumerate certificates.
-- Public certificate pages use /api/certificate/[id] (service role) which returns
-- only display fields and never exposes student_email.
-- Drop the old overly-permissive policy if it exists:
DROP POLICY IF EXISTS "certificates_public_read" ON public.certificates;

-- Writes are handled server-side via /api/course using the service role key
-- which bypasses RLS entirely. No client write access needed.
-- Form owners can still revoke/reissue from the dashboard (authenticated).
CREATE POLICY "certificates_owner_write" ON public.certificates
  FOR ALL USING (
    form_id IN (
      SELECT id FROM public.forms WHERE user_id = auth.uid()
    )
  );

-- 4. RLS Policies for certificate_settings
ALTER TABLE public.certificate_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed to render public certificate page)
CREATE POLICY "cert_settings_public_read" ON public.certificate_settings
  FOR SELECT USING (true);

-- Only the form owner can write settings
CREATE POLICY "cert_settings_owner_write" ON public.certificate_settings
  FOR ALL USING (
    form_id IN (
      SELECT id FROM public.forms WHERE user_id = auth.uid()
    )
  );

-- 5. Storage bucket for certificate assets (backgrounds, logos, signatures)
-- Run this separately if needed:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('cert-assets', 'cert-assets', true);

-- Storage policy: public read
-- CREATE POLICY "cert_assets_public" ON storage.objects FOR SELECT USING (bucket_id = 'cert-assets');
-- CREATE POLICY "cert_assets_auth_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cert-assets' AND auth.role() = 'authenticated');
-- CREATE POLICY "cert_assets_auth_update" ON storage.objects FOR UPDATE USING (bucket_id = 'cert-assets' AND auth.role() = 'authenticated');
-- CREATE POLICY "cert_assets_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'cert-assets' AND auth.role() = 'authenticated');
