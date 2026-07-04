-- 134: case studies (scenario groups) for a certification.
--
-- A scenario is a shared stimulus (context, dataset description, business case) that several exam
-- questions reference via each question's scenarioId (stored inside the questions jsonb). The taker
-- shows the scenario alongside every question that belongs to it. Shape: [{id, title, content}].

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS scenarios jsonb NOT NULL DEFAULT '[]';
