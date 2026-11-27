-- ==============================================================================
-- Migration: 20261123000001_inventory_core.sql
-- Inventory & Warehouse Management (featureslist §2).
--
-- Design notes
--  * Every table carries company_id AND branch_id (AGENTS.md rule 16). Warehouses
--    belong to a branch; stock is always read through the branch scope.
--  * Locations are hierarchical and typed by `usage` (internal / view / supplier /
--    customer / inventory / transit / production / scrap), so physical bins, virtual
--    transit and scrap staging are all the same table — the Odoo model.
--  * Stock is held ONLY in inventory_quants (product x location x lot). Movements are
--    an append-only ledger: a done move is never edited, it is reversed (rule 28
--    treats registered legal documents as immutable; the stock ledger follows the same
--    discipline so valuation can always be replayed).
--  * Valuation is computed by the Python calculation service (rule 8). FIFO keeps a
--    layer queue (inventory_valuation_layers); AVCO keeps a running average on
--    inventory_product_config. NestJS never does the costing arithmetic.
--  * Lots and serials share one table, distinguished by `kind` (Odoo stock_lot model),
--    so FEFO ordering and cradle-to-grave history work the same way for both.
-- ==============================================================================

-- ── Warehouses ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_warehouses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(16)   NOT NULL,
    name         VARCHAR(200)  NOT NULL,
    short_name   VARCHAR(32),
    address      TEXT,
    city         VARCHAR(100),
    phone        VARCHAR(50),
    manager_id   UUID,
    -- Virtual locations of this warehouse: created with it so receipts/deliveries work.
    view_location_id    UUID,
    stock_location_id   UUID,
    input_location_id   UUID,
    output_location_id  UUID,
    transit_location_id UUID,
    is_active    BOOLEAN       NOT NULL DEFAULT true,
    archived_at  TIMESTAMPTZ,
    company_id   UUID,
    branch_id    UUID,
    created_by   UUID,
    updated_by   UUID,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_warehouses_code
    ON inventory_warehouses (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(code));
CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_company ON inventory_warehouses (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_branch  ON inventory_warehouses (branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_active  ON inventory_warehouses (is_active);

-- ── Storage locations (Warehouse -> Zone -> Aisle -> Rack -> Bin) ────────────────
CREATE TABLE IF NOT EXISTS inventory_locations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id  UUID          REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
    parent_id     UUID          REFERENCES inventory_locations(id) ON DELETE CASCADE,
    code          VARCHAR(64)   NOT NULL,
    name          VARCHAR(200)  NOT NULL,
    -- Odoo-compatible usage: which side of the stock equation this location sits on.
    usage         VARCHAR(20)   NOT NULL DEFAULT 'internal'
                  CHECK (usage IN ('internal', 'view', 'supplier', 'customer', 'inventory', 'transit', 'production', 'scrap')),
    barcode       VARCHAR(128),
    -- Removal strategy for this location when it holds stock (featureslist §2).
    removal_strategy VARCHAR(20) NOT NULL DEFAULT 'fefo'
                  CHECK (removal_strategy IN ('fifo', 'fefo', 'lifo', 'closest')),
    replenish_location_id UUID  REFERENCES inventory_locations(id) ON DELETE SET NULL,
    is_active     BOOLEAN       NOT NULL DEFAULT true,
    archived_at   TIMESTAMPTZ,
    company_id    UUID,
    branch_id     UUID,
    created_by    UUID,
    updated_by    UUID,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_locations_code
    ON inventory_locations (COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(code));
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_locations_barcode
    ON inventory_locations (lower(barcode)) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_locations_warehouse ON inventory_locations (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_parent    ON inventory_locations (parent_id);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_usage     ON inventory_locations (usage);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_company   ON inventory_locations (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_branch    ON inventory_locations (branch_id);

-- ── Per-product inventory configuration ──────────────────────────────────────────
-- Tracking (none/lot/serial), costing method and replenishment live here, so the
-- Products module stays free of inventory concerns (rule 22, zero coupling).
CREATE TABLE IF NOT EXISTS inventory_product_config (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tracking          VARCHAR(10)   NOT NULL DEFAULT 'none'
                      CHECK (tracking IN ('none', 'lot', 'serial')),
    costing_method    VARCHAR(10)   NOT NULL DEFAULT 'fifo'
                      CHECK (costing_method IN ('fifo', 'avco', 'standard')),
    -- Standard cost, used when costing_method = 'standard'.
    standard_cost     NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (standard_cost >= 0),
    -- Rolling figures owned by the Python valuation engine (rule 8); read-only here.
    average_cost      NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
    quantity_on_hand  NUMERIC(18,4) NOT NULL DEFAULT 0,
    value_on_hand     NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- Replenishment defaults; per-warehouse overrides live in inventory_orderpoints.
    reorder_point     NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
    reorder_max       NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (reorder_max >= 0),
    lead_days         INTEGER       NOT NULL DEFAULT 0 CHECK (lead_days >= 0),
    -- Shelf life / expiry rules feeding lots (featureslist §1, §2).
    shelf_life_days   INTEGER       CHECK (shelf_life_days IS NULL OR shelf_life_days > 0),
    expiry_warn_days  INTEGER       NOT NULL DEFAULT 30 CHECK (expiry_warn_days >= 0),
    allow_negative    BOOLEAN       NOT NULL DEFAULT false,
    company_id        UUID,
    branch_id         UUID,
    created_by        UUID,
    updated_by        UUID,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_product_config_product ON inventory_product_config (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_config_company ON inventory_product_config (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_config_branch  ON inventory_product_config (branch_id);

-- ── Lots & serials (one table, distinguished by kind) ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_lots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    kind              VARCHAR(10)   NOT NULL DEFAULT 'lot' CHECK (kind IN ('lot', 'serial')),
    name              VARCHAR(128)  NOT NULL,
    expiry_date       DATE,
    manufacture_date  DATE,
    alert_date        DATE,
    supplier_contact_id UUID,        -- snapshot reference, no cross-module FK (rule 22)
    supplier_name     VARCHAR(255),
    receipt_move_id   UUID,
    -- Quarantine & recall management (featureslist §2).
    quality_state     VARCHAR(20)   NOT NULL DEFAULT 'available'
                      CHECK (quality_state IN ('available', 'quarantined', 'expired', 'recalled', 'rejected')),
    quality_note      TEXT,
    company_id        UUID,
    branch_id         UUID,
    created_by        UUID,
    updated_by        UUID,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_lots_product_name
    ON inventory_lots (product_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_inventory_lots_product  ON inventory_lots (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_expiry   ON inventory_lots (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_lots_quality  ON inventory_lots (quality_state);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_company  ON inventory_lots (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_branch   ON inventory_lots (branch_id);

-- ── Transfers (the document: receipt / delivery / internal / return) ─────────────
CREATE TABLE IF NOT EXISTS inventory_transfers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(32)   NOT NULL,
    transfer_type      VARCHAR(20)   NOT NULL
                       CHECK (transfer_type IN ('receipt', 'delivery', 'internal', 'return_in', 'return_out')),
    state              VARCHAR(20)   NOT NULL DEFAULT 'draft'
                       CHECK (state IN ('draft', 'waiting', 'ready', 'in_progress', 'done', 'cancelled')),
    origin             VARCHAR(128),   -- e.g. "PO-0007" / "SO-0031"; text, never a cross-module FK
    partner_contact_id UUID,           -- contacts module id, snapshot only
    partner_name       VARCHAR(255),
    from_warehouse_id  UUID          REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
    to_warehouse_id    UUID          REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
    scheduled_date     TIMESTAMPTZ,
    done_date          TIMESTAMPTZ,
    responsible_user_id UUID,
    -- Stocktake / reason linkage for auditable adjustments.
    reason             VARCHAR(255),
    notes              TEXT,
    qr_token           VARCHAR(64),
    company_id         UUID,
    branch_id          UUID,
    created_by         UUID,
    updated_by         UUID,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_transfers_name ON inventory_transfers (name);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_state   ON inventory_transfers (state);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_type    ON inventory_transfers (transfer_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_company ON inventory_transfers (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_branch  ON inventory_transfers (branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_from    ON inventory_transfers (from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_to      ON inventory_transfers (to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_date    ON inventory_transfers (scheduled_date);

-- ── Moves (the ledger lines; append-only once done) ──────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_moves (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id         UUID          REFERENCES inventory_transfers(id) ON DELETE CASCADE,
    reference           VARCHAR(32),
    move_type           VARCHAR(20)   NOT NULL DEFAULT 'internal'
                        CHECK (move_type IN ('receipt', 'delivery', 'internal', 'scrap', 'adjustment', 'production', 'consumption', 'return')),
    product_id          UUID          NOT NULL REFERENCES products(id),
    lot_id              UUID          REFERENCES inventory_lots(id) ON DELETE SET NULL,
    from_location_id    UUID          REFERENCES inventory_locations(id) ON DELETE SET NULL,
    to_location_id      UUID          REFERENCES inventory_locations(id) ON DELETE SET NULL,
    quantity            NUMERIC(18,4) NOT NULL CHECK (quantity <> 0),
    uom_id              UUID          REFERENCES uoms(id),
    -- Quantity already valued/picked; equals quantity once the move is done.
    done_quantity       NUMERIC(18,4) NOT NULL DEFAULT 0,
    unit_cost           NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    total_cost          NUMERIC(18,4) NOT NULL DEFAULT 0,
    state               VARCHAR(20)   NOT NULL DEFAULT 'draft'
                        CHECK (state IN ('draft', 'confirmed', 'assigned', 'done', 'cancelled')),
    -- What caused this move: 'transfer', 'count', 'manual', 'bridge:<key>'.
    source              VARCHAR(32)   NOT NULL DEFAULT 'transfer',
    source_document_id  UUID,
    -- Why a manual adjustment / count variance moved stock (auditable).
    reason              VARCHAR(255),
    notes               TEXT,
    -- The move this one reverses, so corrections are traceable (never an edit).
    reversed_move_id    UUID          REFERENCES inventory_moves(id) ON DELETE SET NULL,
    operator_user_id    UUID,
    done_at             TIMESTAMPTZ,
    company_id          UUID,
    branch_id           UUID,
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_transfer   ON inventory_moves (transfer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_product    ON inventory_moves (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_lot        ON inventory_moves (lot_id);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_state      ON inventory_moves (state);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_from       ON inventory_moves (from_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_to         ON inventory_moves (to_location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_done_at    ON inventory_moves (done_at);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_company    ON inventory_moves (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_branch     ON inventory_moves (branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_product_at ON inventory_moves (product_id, done_at DESC);

-- ── Stock quants (the only place a balance lives) ────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_quants (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id         UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id        UUID          NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    lot_id             UUID          REFERENCES inventory_lots(id) ON DELETE SET NULL,
    quantity           NUMERIC(18,4) NOT NULL DEFAULT 0,
    reserved_quantity  NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- Cost of the oldest open layer, for display; the authority is the valuation layer.
    unit_cost          NUMERIC(18,4) NOT NULL DEFAULT 0,
    company_id         UUID,
    branch_id          UUID,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
-- One quant per product + location + lot; NULL lot needs its own partial indexes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_quants_product_location_lot
    ON inventory_quants (product_id, location_id, lot_id) WHERE lot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_quants_product_location_nolot
    ON inventory_quants (product_id, location_id) WHERE lot_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_quants_product  ON inventory_quants (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quants_location ON inventory_quants (location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quants_lot      ON inventory_quants (lot_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quants_company  ON inventory_quants (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quants_branch   ON inventory_quants (branch_id);

-- ── FIFO valuation layers (consumed oldest-first by the Python engine) ───────────
CREATE TABLE IF NOT EXISTS inventory_valuation_layers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    lot_id            UUID          REFERENCES inventory_lots(id) ON DELETE SET NULL,
    location_id       UUID          REFERENCES inventory_locations(id) ON DELETE SET NULL,
    move_id           UUID          REFERENCES inventory_moves(id) ON DELETE SET NULL,
    quantity          NUMERIC(18,4) NOT NULL,
    remaining_qty     NUMERIC(18,4) NOT NULL DEFAULT 0,
    unit_cost         NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    value             NUMERIC(18,4) NOT NULL DEFAULT 0,
    remaining_value   NUMERIC(18,4) NOT NULL DEFAULT 0,
    company_id        UUID,
    branch_id         UUID,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_val_layers_product  ON inventory_valuation_layers (product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_val_layers_open     ON inventory_valuation_layers (product_id) WHERE remaining_qty > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_val_layers_company  ON inventory_valuation_layers (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_val_layers_branch   ON inventory_valuation_layers (branch_id);

-- ── Putaway rules (which location an incoming product lands in) ──────────────────
CREATE TABLE IF NOT EXISTS inventory_putaway_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id    UUID          REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
    product_id      UUID          REFERENCES products(id) ON DELETE CASCADE,
    category_id     UUID          REFERENCES product_categories(id) ON DELETE CASCADE,
    location_id     UUID          NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    sequence        INTEGER       NOT NULL DEFAULT 10,
    is_active       BOOLEAN       NOT NULL DEFAULT true,
    company_id      UUID,
    branch_id       UUID,
    created_by      UUID,
    updated_by      UUID,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_putaway_warehouse ON inventory_putaway_rules (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_putaway_product   ON inventory_putaway_rules (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_putaway_category  ON inventory_putaway_rules (category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_putaway_company   ON inventory_putaway_rules (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_putaway_branch    ON inventory_putaway_rules (branch_id);

-- ── Reorder points (min/max replenishment per warehouse) ─────────────────────────
CREATE TABLE IF NOT EXISTS inventory_orderpoints (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id  UUID          REFERENCES inventory_warehouses(id) ON DELETE CASCADE,
    location_id   UUID          REFERENCES inventory_locations(id) ON DELETE SET NULL,
    min_qty       NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (min_qty >= 0),
    max_qty       NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (max_qty >= 0),
    multiple_qty  NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (multiple_qty >= 0),
    is_active     BOOLEAN       NOT NULL DEFAULT true,
    company_id    UUID,
    branch_id     UUID,
    created_by    UUID,
    updated_by    UUID,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_orderpoints
    ON inventory_orderpoints (product_id, COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_inventory_orderpoints_warehouse ON inventory_orderpoints (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_orderpoints_company   ON inventory_orderpoints (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_orderpoints_branch    ON inventory_orderpoints (branch_id);

-- ── Stocktake sessions (cycle count / annual / blind) ────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_counts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(32)   NOT NULL,
    count_type          VARCHAR(20)   NOT NULL DEFAULT 'cycle'
                        CHECK (count_type IN ('cycle', 'full', 'blind', 'spot')),
    state               VARCHAR(20)   NOT NULL DEFAULT 'draft'
                        CHECK (state IN ('draft', 'counting', 'review', 'posted', 'cancelled')),
    warehouse_id        UUID          REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
    location_id         UUID          REFERENCES inventory_locations(id) ON DELETE SET NULL,
    -- Blind counts hide the expected quantity from the counter (featureslist §2).
    is_blind            BOOLEAN       NOT NULL DEFAULT false,
    scheduled_date      DATE,
    counted_at          TIMESTAMPTZ,
    responsible_user_id UUID,
    -- Adjustment approval workflow (featureslist §2).
    requires_approval   BOOLEAN       NOT NULL DEFAULT true,
    approved_by         UUID,
    approved_at         TIMESTAMPTZ,
    notes               TEXT,
    company_id          UUID,
    branch_id           UUID,
    created_by          UUID,
    updated_by          UUID,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_counts_name ON inventory_counts (name);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_state     ON inventory_counts (state);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_warehouse ON inventory_counts (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_company   ON inventory_counts (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_branch    ON inventory_counts (branch_id);

CREATE TABLE IF NOT EXISTS inventory_count_lines (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id      UUID          NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
    product_id    UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    lot_id        UUID          REFERENCES inventory_lots(id) ON DELETE SET NULL,
    location_id   UUID          REFERENCES inventory_locations(id) ON DELETE SET NULL,
    -- Expected is frozen when the line is created, so the variance stays auditable.
    expected_qty  NUMERIC(18,4) NOT NULL DEFAULT 0,
    counted_qty   NUMERIC(18,4),
    variance      NUMERIC(18,4) NOT NULL DEFAULT 0,
    uom_id        UUID          REFERENCES uoms(id),
    is_counted    BOOLEAN       NOT NULL DEFAULT false,
    notes         TEXT,
    company_id    UUID,
    branch_id     UUID,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_count_lines_row
    ON inventory_count_lines (count_id, product_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
                              COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_count   ON inventory_count_lines (count_id);
CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_product ON inventory_count_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_company ON inventory_count_lines (company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_branch  ON inventory_count_lines (branch_id);

-- ── Inventory settings (per company) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_settings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID,
    branch_id             UUID,
    default_costing_method VARCHAR(10) NOT NULL DEFAULT 'fifo'
                          CHECK (default_costing_method IN ('fifo', 'avco', 'standard')),
    default_removal_strategy VARCHAR(20) NOT NULL DEFAULT 'fefo'
                          CHECK (default_removal_strategy IN ('fifo', 'fefo', 'lifo', 'closest')),
    allow_negative_stock  BOOLEAN       NOT NULL DEFAULT false,
    -- Reserved stock cannot be sold twice: reserve on confirmation of sales/POS bridges.
    auto_reserve          BOOLEAN       NOT NULL DEFAULT true,
    -- 1/2/3-step receipts and deliveries (featureslist §2, Odoo routes).
    receipt_steps         SMALLINT      NOT NULL DEFAULT 1 CHECK (receipt_steps BETWEEN 1 AND 3),
    delivery_steps        SMALLINT      NOT NULL DEFAULT 1 CHECK (delivery_steps BETWEEN 1 AND 3),
    expiry_warn_days      INTEGER       NOT NULL DEFAULT 30 CHECK (expiry_warn_days >= 0),
    low_stock_alert       BOOLEAN       NOT NULL DEFAULT true,
    created_by            UUID,
    updated_by            UUID,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_settings_company
    ON inventory_settings (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── Stock movement ledger view (reports: stock movement history) ─────────────────
CREATE OR REPLACE VIEW inventory_movement_history AS
SELECT m.id,
       m.reference,
       m.move_type,
       m.product_id,
       p.name        AS product_name,
       p.sku,
       m.lot_id,
       l.name        AS lot_name,
       m.from_location_id,
       fl.code       AS from_location_code,
       m.to_location_id,
       tl.code       AS to_location_code,
       m.quantity,
       m.unit_cost,
       m.total_cost,
       m.state,
       m.source,
       m.reason,
       m.transfer_id,
       m.operator_user_id,
       m.done_at,
       m.company_id,
       m.branch_id
  FROM inventory_moves m
  JOIN products p ON p.id = m.product_id
  LEFT JOIN inventory_lots l ON l.id = m.lot_id
  LEFT JOIN inventory_locations fl ON fl.id = m.from_location_id
  LEFT JOIN inventory_locations tl ON tl.id = m.to_location_id;

-- ── Live stock view (on hand / reserved / free, per lot and location) ────────────
CREATE OR REPLACE VIEW inventory_stock_on_hand AS
SELECT q.id,
       q.product_id,
       p.name AS product_name,
       p.sku,
       q.lot_id,
       l.name AS lot_name,
       l.expiry_date,
       q.location_id,
       loc.code AS location_code,
       loc.usage,
       w.id   AS warehouse_id,
       w.name AS warehouse_name,
       q.quantity,
       q.reserved_quantity,
       (q.quantity - q.reserved_quantity) AS free_quantity,
       q.unit_cost,
       (q.quantity * q.unit_cost) AS stock_value,
       q.company_id,
       q.branch_id
  FROM inventory_quants q
  JOIN products p ON p.id = q.product_id
  LEFT JOIN inventory_lots l ON l.id = q.lot_id
  JOIN inventory_locations loc ON loc.id = q.location_id
  LEFT JOIN inventory_warehouses w ON w.id = loc.warehouse_id;

-- ── Sequence counters (transfer and count numbering, per company) ────────────────
CREATE TABLE IF NOT EXISTS inventory_sequences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID,
    kind        VARCHAR(20) NOT NULL,
    next_number INTEGER     NOT NULL DEFAULT 1,
    prefix      VARCHAR(8)  NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_sequences
    ON inventory_sequences (kind, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid));

INSERT INTO inventory_sequences (kind, prefix, next_number) VALUES
    ('receipt',  'WH/IN/',  1),
    ('delivery', 'WH/OUT/', 1),
    ('internal', 'WH/INT/', 1),
    ('count',    'WH/CNT/', 1),
    ('scrap',    'WH/SCR/', 1)
ON CONFLICT DO NOTHING;
