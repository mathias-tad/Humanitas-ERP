-- Add first_name and last_name columns if they don't exist
DO $$
BEGIN
  BEGIN
    ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
  EXCEPTION 
    WHEN duplicate_column THEN NULL;
    WHEN others THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE users ADD COLUMN last_name VARCHAR(255);
  EXCEPTION 
    WHEN duplicate_column THEN NULL;
    WHEN others THEN NULL;
  END;

  -- Populate from full_name if empty
  BEGIN
    UPDATE users 
    SET first_name = split_part(full_name, ' ', 1),
        last_name = CASE WHEN position(' ' IN full_name) > 0 
                    THEN substring(full_name FROM position(' ' IN full_name) + 1)
                    ELSE '' END
    WHERE (first_name IS NULL OR first_name = '') AND full_name IS NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;
