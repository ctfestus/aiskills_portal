-- Add next_path_id to learning_paths for auto-enroll chaining
ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS next_path_id uuid REFERENCES learning_paths(id) ON DELETE SET NULL;
