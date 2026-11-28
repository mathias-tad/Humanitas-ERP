-- ==============================================================================
-- Stocktakes (featureslist §2): what a count covers and who counted each line.
-- inventory_counts / inventory_count_lines come from 20261123000001_inventory_core.sql; a count
-- can now be limited to a product category or a list of products, and each line keeps who
-- counted it, when, the quantity on hand when the count was posted and the adjustment it made,
-- so every variance can be traced to its ledger move. Idempotent.
-- ==============================================================================
ALTER TABLE inventory_counts ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;
ALTER TABLE inventory_counts ADD COLUMN IF NOT EXISTS product_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE inventory_counts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE inventory_counts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE inventory_counts ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;

ALTER TABLE inventory_count_lines ADD COLUMN IF NOT EXISTS counted_by UUID;
ALTER TABLE inventory_count_lines ADD COLUMN IF NOT EXISTS counted_at TIMESTAMPTZ;
-- Lines found during the count that were not in the snapshot (a product in the wrong place).
ALTER TABLE inventory_count_lines ADD COLUMN IF NOT EXISTS is_unexpected BOOLEAN NOT NULL DEFAULT false;
-- On hand when the count was posted: the adjustment is counted minus this, so moves made while
-- counting are never adjusted twice.
ALTER TABLE inventory_count_lines ADD COLUMN IF NOT EXISTS on_hand_at_post NUMERIC(18,4);
ALTER TABLE inventory_count_lines ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0;
ALTER TABLE inventory_count_lines ADD COLUMN IF NOT EXISTS adjustment_move_id UUID REFERENCES inventory_moves(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_location ON inventory_count_lines (location_id);
