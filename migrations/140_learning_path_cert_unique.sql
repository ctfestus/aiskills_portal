-- 140: unique active learning-path certificate per student
--
-- certificates has partial unique indexes for course_id, ve_id, and certification_id,
-- but not learning_path_id -- so concurrent completion/reconciliation requests could
-- both insert a learning-path certificate. Close the gap so ensureCertificate's
-- 23505 retry works for learning paths like every other content type.
--
-- Any duplicates created before this index must be resolved first or the CREATE
-- fails. Order matters:
--   1. Repoint learning_path_progress.cert_id away from duplicates that are about to
--      be revoked (the racy writer may have recorded a NEWER duplicate; keeping the
--      oldest would otherwise leave progress pointing at a revoked certificate, which
--      the certificate page refuses to render).
--   2. Revoke everything but the oldest active certificate per (path, student).
--   3. Create the unique index.

-- 1. Repoint progress rows to the keeper (oldest active cert for the pair).
UPDATE public.learning_path_progress lpp
SET cert_id = keeper.id
FROM public.certificates dup,
LATERAL (
  SELECT k.id
  FROM public.certificates k
  WHERE k.learning_path_id = dup.learning_path_id
    AND k.student_id = dup.student_id
    AND k.revoked = false
  ORDER BY k.issued_at, k.id
  LIMIT 1
) keeper
WHERE lpp.cert_id = dup.id
  AND dup.revoked = false
  AND dup.learning_path_id IS NOT NULL
  AND dup.id <> keeper.id;

-- 2. Revoke every active duplicate except the keeper.
UPDATE public.certificates c
SET revoked = true, revoked_at = now()
WHERE c.revoked = false
  AND c.learning_path_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.certificates earlier
    WHERE earlier.learning_path_id = c.learning_path_id
      AND earlier.student_id = c.student_id
      AND earlier.revoked = false
      AND (earlier.issued_at < c.issued_at
           OR (earlier.issued_at = c.issued_at AND earlier.id < c.id))
  );

-- 3. One active learning-path certificate per student.
CREATE UNIQUE INDEX IF NOT EXISTS certificates_unique_active_student_learning_path
  ON public.certificates (learning_path_id, student_id)
  WHERE revoked = false AND learning_path_id IS NOT NULL;

-- Verification (run after applying; both must return zero rows):
--   SELECT lpp.id FROM public.learning_path_progress lpp
--   JOIN public.certificates c ON c.id = lpp.cert_id
--   WHERE c.revoked = true AND c.learning_path_id IS NOT NULL;
--
--   SELECT learning_path_id, student_id, count(*) FROM public.certificates
--   WHERE revoked = false AND learning_path_id IS NOT NULL
--   GROUP BY 1, 2 HAVING count(*) > 1;
