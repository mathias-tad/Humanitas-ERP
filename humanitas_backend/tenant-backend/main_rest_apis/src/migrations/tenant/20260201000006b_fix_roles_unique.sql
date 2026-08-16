DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_index i ON i.indexrelid = c.oid
        JOIN pg_class t ON i.indrelid = t.oid
        WHERE t.relname = 'roles' AND c.relname = 'roles_name_key'
    ) THEN
        ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);
    END IF;
END $$;
