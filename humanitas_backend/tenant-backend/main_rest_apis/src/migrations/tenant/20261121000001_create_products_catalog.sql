-- Products & Catalog, slice 1 (featureslist §1): units of measure, categories, products, barcodes.
-- Catalog master data: company_id NULL = shared by every company of the tenant;
-- a value limits the record to that company (rule 16). Deleting = archiving (rule 24).

-- ── Units of measure ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uom_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_by  UUID,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_uom_categories_name ON uom_categories (lower(name));

CREATE TABLE IF NOT EXISTS uoms (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id  UUID          NOT NULL REFERENCES uom_categories(id),
    name         VARCHAR(100)  NOT NULL,
    symbol       VARCHAR(20),
    -- 1 of this unit = ratio × the category's reference unit (kg: 1, g: 0.001, quintal: 100)
    ratio        NUMERIC(20,8) NOT NULL DEFAULT 1 CHECK (ratio > 0),
    is_reference BOOLEAN       NOT NULL DEFAULT false,
    rounding     NUMERIC(12,6) NOT NULL DEFAULT 0.01 CHECK (rounding > 0),
    is_active    BOOLEAN       NOT NULL DEFAULT true,
    created_by   UUID,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_uoms_reference_ratio CHECK (NOT is_reference OR ratio = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_uoms_category_name ON uoms (category_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_uoms_one_reference ON uoms (category_id) WHERE is_reference;

-- ── Product categories (tree) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   UUID REFERENCES product_categories(id),
    name        VARCHAR(150) NOT NULL,
    code        VARCHAR(50),
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    company_id  UUID,
    created_by  UUID,
    updated_by  UUID,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_product_categories_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_sibling_name
    ON product_categories (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_code ON product_categories (lower(code)) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_categories_parent ON product_categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_company ON product_categories (company_id);

-- ── Products ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku              VARCHAR(64),
    name             VARCHAR(255)  NOT NULL,
    description      TEXT,
    product_type     VARCHAR(20)   NOT NULL DEFAULT 'consumable'
                     CHECK (product_type IN ('storable', 'consumable', 'service')),
    category_id      UUID REFERENCES product_categories(id),
    uom_id           UUID          NOT NULL REFERENCES uoms(id),
    purchase_uom_id  UUID          NOT NULL REFERENCES uoms(id),
    sales_price      NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (sales_price >= 0),
    cost_price       NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    tax_rate         NUMERIC(5,2)  CHECK (tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate <= 100)),
    can_be_sold      BOOLEAN       NOT NULL DEFAULT true,
    can_be_purchased BOOLEAN       NOT NULL DEFAULT true,
    image_url        TEXT,
    is_active        BOOLEAN       NOT NULL DEFAULT true,
    archived_at      TIMESTAMPTZ,
    company_id       UUID,
    created_by       UUID,
    updated_by       UUID,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku ON products (lower(sku)) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_name ON products (lower(name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON products (company_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active);

-- One product can carry several barcodes (unit, box, pallet packaging levels).
CREATE TABLE IF NOT EXISTS product_barcodes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID          NOT NULL REFERENCES products(id),
    barcode       VARCHAR(128)  NOT NULL,
    barcode_type  VARCHAR(20)   NOT NULL DEFAULT 'other'
                  CHECK (barcode_type IN ('ean13', 'ean8', 'upca', 'code128', 'qr', 'other')),
    packaging     VARCHAR(50),
    quantity      NUMERIC(18,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    is_primary    BOOLEAN       NOT NULL DEFAULT false,
    created_by    UUID,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcodes_barcode ON product_barcodes (barcode);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product ON product_barcodes (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcodes_one_primary ON product_barcodes (product_id) WHERE is_primary;

-- ── Default units (Ethiopian trade units included: quintal) ───────────────────────
INSERT INTO uom_categories (name) VALUES ('Unit'), ('Weight'), ('Volume'), ('Length'), ('Time')
ON CONFLICT DO NOTHING;

INSERT INTO uoms (category_id, name, symbol, ratio, is_reference, rounding)
SELECT c.id, v.name, v.symbol, v.ratio, v.is_reference, v.rounding
FROM (VALUES
    ('Unit',   'Units',   'pc',   1,       true,  1),
    ('Unit',   'Dozen',   'dz',   12,      false, 1),
    ('Unit',   'Pack',    'pk',   1,       false, 1),
    ('Weight', 'kg',      'kg',   1,       true,  0.001),
    ('Weight', 'g',       'g',    0.001,   false, 0.01),
    ('Weight', 'Quintal', 'qt',   100,     false, 0.001),
    ('Weight', 'Tonne',   't',    1000,    false, 0.001),
    ('Volume', 'Litre',   'L',    1,       true,  0.001),
    ('Volume', 'mL',      'mL',   0.001,   false, 1),
    ('Length', 'm',       'm',    1,       true,  0.01),
    ('Length', 'cm',      'cm',   0.01,    false, 0.1),
    ('Time',   'Hour',    'h',    1,       true,  0.01),
    ('Time',   'Day',     'd',    8,       false, 0.01)
) AS v(category, name, symbol, ratio, is_reference, rounding)
JOIN uom_categories c ON lower(c.name) = lower(v.category)
ON CONFLICT DO NOTHING;
