-- Migration 20261017000001: Ensure all attendance_records columns exist for existing databases
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS shift_id UUID;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS scheduled_in TIME;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS scheduled_out TIME;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS actual_in TIMESTAMP;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS actual_out TIMESTAMP;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN DEFAULT false;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_duration_normal INTERVAL DEFAULT '0';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_duration_night INTERVAL DEFAULT '0';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_duration_holiday INTERVAL DEFAULT '0';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ot_duration_dayoff INTERVAL DEFAULT '0';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS forced_clock_out_by UUID REFERENCES users(id);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS forced_at TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_records' AND column_name = 'notes'
  ) THEN
    UPDATE attendance_records SET remarks = notes WHERE remarks IS NULL AND notes IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_records' 
      AND column_name = 'actual_in' 
      AND data_type = 'time without time zone'
  ) THEN
    ALTER TABLE attendance_records ALTER COLUMN actual_in TYPE TIMESTAMP USING (date + actual_in);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_records' 
      AND column_name = 'work_hours' 
      AND data_type IN ('numeric', 'decimal')
  ) THEN
    ALTER TABLE attendance_records ALTER COLUMN work_hours TYPE INTERVAL USING (work_hours || ' hours')::interval;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
