-- Add first_name and last_name as computed columns derived from full_name
-- This allows legacy queries that reference first_name/last_name to work
DO $$
BEGIN
  -- Add first_name generated column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE users ADD COLUMN first_name VARCHAR(255)
      GENERATED ALWAYS AS (split_part(full_name, ' ', 1)) STORED;
  END IF;
  
  -- Add last_name generated column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE users ADD COLUMN last_name VARCHAR(255)
      GENERATED ALWAYS AS (
        CASE WHEN position(' ' IN full_name) > 0 
          THEN substring(full_name FROM position(' ' IN full_name) + 1)
          ELSE ''
        END
      ) STORED;
  END IF;
END $$;
