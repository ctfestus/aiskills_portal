-- Dedicated singleton config table for payment behaviour settings.
-- Keeps payment config separate from branding/platform_settings.
CREATE TABLE IF NOT EXISTS public.payment_config (
  id                    text PRIMARY KEY DEFAULT 'default',
  outstanding_cohort_id uuid REFERENCES public.cohorts(id),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor_or_admin" ON public.payment_config FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = auth.uid()
    AND students.role IN ('admin', 'instructor')
  ));

INSERT INTO public.payment_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
