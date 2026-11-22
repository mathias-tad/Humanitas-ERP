-- Products completion (featureslist §1): separate sales unit, order quantities, packaging with
-- GS1 barcodes, kits and combos, gallery and attachments, catalog settings, customer price lists.

-- ── Units and order quantities ───────────────────────────────────────────────────
-- uom_id is the base (stock) unit; the purchase and sales units are in the same unit category.
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_uom_id UUID REFERENCES uoms(id);
UPDATE products SET sales_uom_id = uom_id WHERE sales_uom_id IS NULL;
-- Inserts that do not name a sales unit (older code paths, imports) sell in the base unit.
CREATE OR REPLACE FUNCTION products_default_sales_uom() RETURNS trigger AS $fn$
BEGIN
  IF NEW.sales_uom_id IS NULL THEN NEW.sales_uom_id := NEW.uom_id; END IF;
  RETURN NEW;
END $fn$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_products_default_sales_uom ON products;
CREATE TRIGGER trg_products_default_sales_uom BEFORE INSERT OR UPDATE OF uom_id, sales_uom_id ON products
  FOR EACH ROW EXECUTE FUNCTION products_default_sales_uom();
ALTER TABLE products ALTER COLUMN sales_uom_id SET NOT NULL;
-- Minimum order and "sold in multiples of", in the sales unit. 0 / NULL = no limit.
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_sale_qty NUMERIC(18,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_qty_step NUMERIC(18,4);
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT chk_products_order_qty CHECK (min_sale_qty >= 0 AND (sale_qty_step IS NULL OR sale_qty_step > 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- single | kit (fixed components, one price) | combo (the customer picks from groups)
ALTER TABLE products ADD COLUMN IF NOT EXISTS composition VARCHAR(10) NOT NULL DEFAULT 'single';
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT chk_products_composition CHECK (composition IN ('single', 'kit', 'combo'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Barcodes made by the in-store numbering (Product Settings); removed when the product gets variants.
ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS is_generated BOOLEAN NOT NULL DEFAULT false;

-- ── Packaging (GS1 levels: unit, inner pack, case, pallet) ────────────────────────
CREATE TABLE IF NOT EXISTS product_packagings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID          NOT NULL REFERENCES products(id),
    name        VARCHAR(50)   NOT NULL,
    level       VARCHAR(10)   NOT NULL DEFAULT 'case' CHECK (level IN ('unit', 'inner', 'case', 'pallet', 'other')),
    -- How many base units are in one package.
    quantity    NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
    gtin        VARCHAR(14)   CHECK (gtin IS NULL OR gtin ~ '^([0-9]{8}|[0-9]{12,14})$'),
    weight_kg   NUMERIC(12,4) CHECK (weight_kg IS NULL OR weight_kg >= 0),
    length_cm   NUMERIC(10,2) CHECK (length_cm IS NULL OR length_cm >= 0),
    width_cm    NUMERIC(10,2) CHECK (width_cm IS NULL OR width_cm >= 0),
    height_cm   NUMERIC(10,2) CHECK (height_cm IS NULL OR height_cm >= 0),
    can_sell    BOOLEAN       NOT NULL DEFAULT true,
    can_buy     BOOLEAN       NOT NULL DEFAULT true,
    sort_order  INTEGER       NOT NULL DEFAULT 0,
    is_active   BOOLEAN       NOT NULL DEFAULT true,
    created_by  UUID,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_packagings_gtin ON product_packagings (gtin) WHERE gtin IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_packagings_name ON product_packagings (product_id, lower(name)) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_product_packagings_product ON product_packagings (product_id);

-- ── Kits and combos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_components (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID          NOT NULL REFERENCES products(id),
    component_id UUID          NOT NULL REFERENCES products(id),
    quantity     NUMERIC(18,4) NOT NULL CHECK (quantity > 0),
    sort_order   INTEGER       NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_product_components_not_self CHECK (product_id <> component_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_components ON product_components (product_id, component_id);
CREATE INDEX IF NOT EXISTS idx_product_components_component ON product_components (component_id);

CREATE TABLE IF NOT EXISTS product_combo_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID         NOT NULL REFERENCES products(id),
    name        VARCHAR(100) NOT NULL,
    min_choices INTEGER      NOT NULL DEFAULT 1 CHECK (min_choices >= 0),
    max_choices INTEGER      NOT NULL DEFAULT 1 CHECK (max_choices >= 1),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_product_combo_groups_range CHECK (min_choices <= max_choices)
);
CREATE INDEX IF NOT EXISTS idx_product_combo_groups_product ON product_combo_groups (product_id);

CREATE TABLE IF NOT EXISTS product_combo_choices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID          NOT NULL REFERENCES product_combo_groups(id) ON DELETE CASCADE,
    component_id UUID          NOT NULL REFERENCES products(id),
    quantity     NUMERIC(18,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    extra_price  NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (extra_price >= 0),
    is_default   BOOLEAN       NOT NULL DEFAULT false,
    sort_order   INTEGER       NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_combo_choices ON product_combo_choices (group_id, component_id);
CREATE INDEX IF NOT EXISTS idx_product_combo_choices_component ON product_combo_choices (component_id);

-- ── Gallery and attachments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID          NOT NULL REFERENCES products(id),
    kind        VARCHAR(10)   NOT NULL CHECK (kind IN ('image', 'attachment')),
    file_path   TEXT          NOT NULL,
    file_name   VARCHAR(255)  NOT NULL,
    mime_type   VARCHAR(120)  NOT NULL,
    file_size   INTEGER       NOT NULL CHECK (file_size > 0),
    title       VARCHAR(150),
    is_primary  BOOLEAN       NOT NULL DEFAULT false,
    sort_order  INTEGER       NOT NULL DEFAULT 0,
    is_active   BOOLEAN       NOT NULL DEFAULT true,
    created_by  UUID,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_product_media_primary CHECK (NOT is_primary OR kind = 'image')
);
CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media (product_id) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_media_one_primary ON product_media (product_id) WHERE is_primary AND is_active;

-- ── Catalog settings (one row per tenant) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_settings (
    id                   SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    sku_mode             VARCHAR(10)  NOT NULL DEFAULT 'manual' CHECK (sku_mode IN ('manual', 'auto')),
    sku_prefix           VARCHAR(10)  NOT NULL DEFAULT 'P' CHECK (sku_prefix ~ '^[A-Za-z0-9._/-]{0,10}$'),
    sku_padding          SMALLINT     NOT NULL DEFAULT 6 CHECK (sku_padding BETWEEN 1 AND 12),
    sku_next             BIGINT       NOT NULL DEFAULT 1 CHECK (sku_next >= 1),
    barcode_mode         VARCHAR(10)  NOT NULL DEFAULT 'manual' CHECK (barcode_mode IN ('manual', 'ean13')),
    -- GS1 restricted-circulation prefixes 20-29 are free for in-store numbers.
    barcode_prefix       VARCHAR(10)  NOT NULL DEFAULT '20' CHECK (barcode_prefix ~ '^[0-9]{2,10}$'),
    barcode_next         BIGINT       NOT NULL DEFAULT 1 CHECK (barcode_next >= 1),
    default_product_type VARCHAR(20)  NOT NULL DEFAULT 'consumable' CHECK (default_product_type IN ('storable', 'consumable', 'service')),
    default_tax_code     VARCHAR(10)  NOT NULL DEFAULT 'VAT15',
    default_uom_id       UUID REFERENCES uoms(id),
    default_category_id  UUID REFERENCES product_categories(id),
    require_category     BOOLEAN      NOT NULL DEFAULT false,
    require_barcode      BOOLEAN      NOT NULL DEFAULT false,
    warn_below_cost      BOOLEAN      NOT NULL DEFAULT true,
    updated_by           UUID,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
INSERT INTO product_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Customer price lists: a customer buys at its list's prices ───────────────────
CREATE TABLE IF NOT EXISTS price_list_customers (
    contact_id    UUID PRIMARY KEY REFERENCES contacts(id),
    price_list_id UUID        NOT NULL REFERENCES price_lists(id),
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_list_customers_list ON price_list_customers (price_list_id);
