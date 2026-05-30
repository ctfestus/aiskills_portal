-- Add document_review to the assignments.type CHECK constraint
ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_type_check;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_type_check
  CHECK (type IN ('standard','code_review','excel_review','dashboard_critique','virtual_experience','document_review'));
