-- Products slice 3 (featureslist §1): multi-tier price lists (Retail, Wholesale, VIP...).
-- A list has rules: a fixed price, a % off the sales price or a % on cost, for one product
-- (or a product with variants: all its variants), a category (and its sub-categories) or every
-- product, from a minimum quantity, optionally between two dates. Sales, POS and the online
-- store ask the list for a line's price; with no matching rule the product's sales price applies.

CREATE TABLE IF NOT EXISTS price_lists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    code        VARCHAR(30),
    -- ISO 4217. Product prices are in ETB; other currencies take fixed prices until exchange rates exist.
    currency    CHAR(3)      NOT NULL DEFAULT 'ETB' CHECK (currency ~ '^[A-Z]{3}$'),
    description TEXT,
    is_default  BOOLEAN      NOT NULL DEFAULT false,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    company_id  UUID,
    created_by  UUID,
    updated_by  UUID,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_lists_name
    ON price_lists (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_lists_one_default
    ON price_lists (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE is_default AND is_active;
CREATE INDEX IF NOT EXISTS idx_price_lists_company ON price_lists (company_id);

CREATE TABLE IF NOT EXISTS price_list_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID          NOT NULL REFERENCES price_lists(id),
    applies_to    VARCHAR(10)   NOT NULL CHECK (applies_to IN ('product', 'category', 'all')),
    product_id    UUID REFERENCES products(id),
    category_id   UUID REFERENCES product_categories(id),
    min_quantity  NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
    compute       VARCHAR(10)   NOT NULL CHECK (compute IN ('fixed', 'discount', 'markup')),
    fixed_price   NUMERIC(18,4) CHECK (fixed_price IS NULL OR fixed_price >= 0),
    percent       NUMERIC(9,4)  CHECK (percent IS NULL OR (percent >= -100 AND percent <= 1000)),
    date_start    DATE,
    date_end      DATE,
    sort_order    INTEGER       NOT NULL DEFAULT 0,
    is_active     BOOLEAN       NOT NULL DEFAULT true,
    created_by    UUID,
    updated_by    UUID,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_price_list_items_target CHECK (
        (applies_to = 'product') = (product_id IS NOT NULL) AND (applies_to = 'category') = (category_id IS NOT NULL)),
    CONSTRAINT chk_price_list_items_value CHECK (
        (compute = 'fixed' AND fixed_price IS NOT NULL) OR (compute <> 'fixed' AND percent IS NOT NULL)),
    CONSTRAINT chk_price_list_items_dates CHECK (date_end IS NULL OR date_start IS NULL OR date_end >= date_start)
);
CREATE INDEX IF NOT EXISTS idx_price_list_items_list ON price_list_items (price_list_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_price_list_items_product ON price_list_items (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_list_items_category ON price_list_items (category_id) WHERE category_id IS NOT NULL;

-- Every tenant starts with a Retail list (no rules: everything at its sales price).
INSERT INTO price_lists (name, code, is_default, sort_order)
SELECT 'Retail', 'RETAIL', true, 1
WHERE NOT EXISTS (SELECT 1 FROM price_lists);
