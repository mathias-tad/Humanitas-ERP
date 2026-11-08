-- Migration: 20261108000004_add_offline_punch_sync_and_reconciliation.sql
-- Description: Adds offline biometric punch syncing, idempotent deduplication natural keys, and historical attendance reconciliation columns.

-- 1. Enhance biometric_punch_logs
ALTER TABLE biometric_punch_logs
    ADD COLUMN IF NOT EXISTS is_offline_sync BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reconciled_record_id UUID,
    ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;

-- Idempotent Natural Key Index: guarantees no duplicate punch lines across repeated sync batches
CREATE UNIQUE INDEX IF NOT EXISTS idx_biometric_punch_logs_natural_key 
ON biometric_punch_logs (COALESCE(device_serial_number, 'MANUAL'), pin, punch_time);

-- 2. Enhance attendance_records with reconciliation and pending overtime approval flags
ALTER TABLE attendance_records
    ADD COLUMN IF NOT EXISTS reconciled_from_offline_sync BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS pending_overtime_approval BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS pending_overtime_hours NUMERIC(5,2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_attendance_records_reconciled ON attendance_records(reconciled_from_offline_sync);
CREATE INDEX IF NOT EXISTS idx_attendance_records_pending_ot ON attendance_records(pending_overtime_approval);

-- 3. Register AI Knowledge entry for Offline Biometric Punch Sync & Historical Reconciliation
INSERT INTO ai_knowledge_entries (
    id, tenant_id, module, title, slug, content, tags, platform, access_level, created_at, updated_at
) VALUES (
    gen_random_uuid(),
    NULL,
    'attendance',
    'Offline Biometric Sync & Historical Shift Reconciliation',
    'offline-biometric-sync-reconciliation',
    'Humanitas features an automated Offline Biometric Sync & Historical Shift Reconciliation engine for edge biometric terminals and intermittent server connectivity:
1. Edge Retention: Hardware devices buffer 50,000+ attendance punches in flash memory with local hardware timestamps during network or server downtime.
2. Chronological Batch Ingestion: Upon reconnection, ADMS or manual USB imports sort batch logs by punch_time ASC per employee, guaranteeing proper sequence evaluation.
3. Natural Key Deduplication: Biometric logs use an idempotent key (device_serial_number, pin, punch_time) preventing double-punches across retried uploads.
4. Historical Reconciliation: When delayed punches arrive for previous days that were auto-closed by midnight cron (missed_out), the system automatically reopens the record, populates actual_out, calculates genuine work_hours, and upgrades status from Incomplete to Present.
5. Overtime Governance: Extra hours beyond shift end from offline punches are tagged as pending_overtime_approval and routed to the Live Overtime Monitor for supervisory approval rather than blind accrual.
6. Manual USB Backup: Administrators can upload raw terminal logs (.dat, .txt, .csv) via Time & Attendance -> Biometric ADMS -> Import Offline Logs.',
    ARRAY['biometric', 'adms', 'offline_sync', 'reconciliation', 'overtime', 'attendance'],
    'both',
    'all',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;
