-- Add 'guided_project' to the content_type enum (if it's an enum type).
-- Run this in your Supabase SQL editor.

-- Check if content_type is an enum:
-- SELECT typname FROM pg_type WHERE oid = (SELECT atttypid FROM pg_attribute WHERE attrelid = 'public.forms'::regclass AND attname = 'content_type');

-- If it returns a type name (e.g. 'content_type'), run:
DO $$
BEGIN
  -- Only add if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'guided_project'
      AND enumtypid = (
        SELECT atttypid FROM pg_attribute
        WHERE attrelid = 'public.forms'::regclass
          AND attname = 'content_type'
      )
  ) THEN
    ALTER TYPE content_type ADD VALUE 'guided_project';
  END IF;
EXCEPTION
  -- If content_type is not an enum (it's just text), this block is a no-op
  WHEN others THEN NULL;
END;
$$;
