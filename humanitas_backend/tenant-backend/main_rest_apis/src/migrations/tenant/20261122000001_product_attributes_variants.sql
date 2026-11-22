-- Products slice 2 (featureslist §1): attributes and variants.
-- A product with variants (the "parent") holds the shared details; each variant is its own row in
-- products (parent_id set), so it has its own SKU, barcodes, price, item code for MoR e-invoices,
-- stock and history, and every module that works with products works with variants unchanged.

CREATE TABLE IF NOT EXISTS product_attributes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    display_type VARCHAR(10)  NOT NULL DEFAULT 'pills' CHECK (display_type IN ('pills', 'select', 'color')),
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    created_by   UUID,
    updated_by   UUID,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_attributes_name ON product_attributes (lower(name));

CREATE TABLE IF NOT EXISTS product_attribute_values (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID         NOT NULL REFERENCES product_attributes(id),
    name         VARCHAR(100) NOT NULL,
    -- Short code used in generated variant SKUs (e.g. RED, XL); defaults from the name.
    code         VARCHAR(20),
    html_color   VARCHAR(7)   CHECK (html_color IS NULL OR html_color ~ '^#[0-9A-Fa-f]{6}$'),
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    created_by   UUID,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_attribute_values_name ON product_attribute_values (attribute_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_product_attribute_values_attribute ON product_attribute_values (attribute_id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_id     UUID REFERENCES products(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_variants  BOOLEAN       NOT NULL DEFAULT false;
-- Added to the parent's sales price to give this variant's sales price.
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_extra   NUMERIC(18,4) NOT NULL DEFAULT 0;
-- Sorted attribute value ids of this variant: one variant per combination.
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_key   TEXT;
-- "Red, XL": the variant's name is "<parent name> (<variant_label>)".
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_label VARCHAR(255);
-- Why a variant was archived automatically: 'config' (its combination was removed) or 'parent'
-- (the parent was archived). NULL when archived by hand. Lets restores bring back only those.
ALTER TABLE products ADD COLUMN IF NOT EXISTS auto_archived VARCHAR(10) CHECK (auto_archived IS NULL OR auto_archived IN ('config', 'parent'));

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT chk_products_variant_shape
    CHECK (NOT (has_variants AND parent_id IS NOT NULL)
           AND (parent_id IS NULL) = (variant_key IS NULL)
           AND (parent_id IS NOT NULL OR price_extra = 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_variant_combination ON products (parent_id, variant_key) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_parent ON products (parent_id);

-- Which attributes and values a parent product uses (one row per attribute, in display order).
CREATE TABLE IF NOT EXISTS product_template_attributes (
    product_id   UUID    NOT NULL REFERENCES products(id),
    attribute_id UUID    NOT NULL REFERENCES product_attributes(id),
    value_ids    UUID[]  NOT NULL CHECK (cardinality(value_ids) > 0),
    sort_order   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, attribute_id)
);

-- The attribute values of each variant.
CREATE TABLE IF NOT EXISTS product_variant_values (
    product_id   UUID NOT NULL REFERENCES products(id),
    attribute_id UUID NOT NULL REFERENCES product_attributes(id),
    value_id     UUID NOT NULL REFERENCES product_attribute_values(id),
    PRIMARY KEY (product_id, attribute_id)
);
CREATE INDEX IF NOT EXISTS idx_product_variant_values_value ON product_variant_values (value_id);

INSERT INTO product_attributes (name, display_type, sort_order)
VALUES ('Size', 'pills', 1), ('Color', 'color', 2)
ON CONFLICT DO NOTHING;

INSERT INTO product_attribute_values (attribute_id, name, code, html_color, sort_order)
SELECT a.id, v.name, v.code, v.color, v.sort_order
  FROM (VALUES
    ('Size',  'S',     'S',   NULL,      1), ('Size', 'M', 'M', NULL, 2), ('Size', 'L', 'L', NULL, 3), ('Size', 'XL', 'XL', NULL, 4),
    ('Color', 'Black', 'BLK', '#111111', 1), ('Color', 'White', 'WHT', '#FFFFFF', 2),
    ('Color', 'Red',   'RED', '#D32F2F', 3), ('Color', 'Blue',  'BLU', '#1976D2', 4)
  ) AS v(attribute, name, code, color, sort_order)
  JOIN product_attributes a ON lower(a.name) = lower(v.attribute)
ON CONFLICT DO NOTHING;
