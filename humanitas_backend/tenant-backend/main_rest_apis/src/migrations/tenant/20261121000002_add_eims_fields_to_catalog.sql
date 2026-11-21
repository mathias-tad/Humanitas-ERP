-- MoR EIMS e-invoicing fields on the product catalog (AGENTS.md rule 28, docs/eims/EIMS_REFERENCE.md).
-- Every invoice line sent to MoR needs: ItemCode (<=15), ProductDescription (<=100), NatureOfSupplies,
-- Unit (MoR code), TaxCode, HarmonizationCode (<=15, conditional) and the excise amount.
-- Storing them on the product now means Sales, POS and Invoicing never guess them at runtime.

-- ── MoR master data codes (from MoR "master data"; MoR adds codes on request) ──────
CREATE TABLE IF NOT EXISTS eims_codes (
    list_name   VARCHAR(40)  NOT NULL,
    code        VARCHAR(20)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    rate        NUMERIC(7,4),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (list_name, code)
);

INSERT INTO eims_codes (list_name, code, name, rate, sort_order) VALUES
    ('unit', 'PCS', 'Pieces', NULL, 1),
    ('unit', 'KLG', 'Kilogram', NULL, 2),
    ('unit', 'LTR', 'Litre', NULL, 3),
    ('unit', 'MTR', 'Metre', NULL, 4),
    ('unit', 'ROL', 'Roll', NULL, 5),
    -- Line tax codes (rate in %). VAT15 is used by the MoR API and tax guide although not in the master list.
    ('tax_code', 'VAT15', 'VAT 15%', 15, 1),
    ('tax_code', 'VAT0', 'VAT zero-rated', 0, 2),
    ('tax_code', 'VATEX', 'VAT exempt', 0, 3),
    ('tax_code', 'TOT2', 'Turnover tax 2%', 2, 4),
    ('tax_code', 'TOT10', 'Turnover tax 10%', 10, 5),
    -- Withholding codes: invoice/receipt level, never on a product.
    ('withholding_code', 'VATWH', 'VAT withholding (B2G, 50% of VAT)', 50, 1),
    ('withholding_code', 'WTHOT', 'Income withholding 3%', 3, 2),
    ('withholding_code', 'WHOP2', 'Withholding 2%', 2, 3),
    ('nature_of_supply', 'goods', 'Goods', NULL, 1),
    ('nature_of_supply', 'service', 'Services', NULL, 2),
    ('transaction_type', 'B2C', 'Business to consumer', NULL, 1),
    ('transaction_type', 'B2B', 'Business to business', NULL, 2),
    ('transaction_type', 'B2G', 'Business to government', NULL, 3),
    ('transaction_type', 'G2B', 'Government to business', NULL, 4),
    ('transaction_type', 'G2C', 'Government to consumer', NULL, 5),
    ('transaction_type', 'G2G', 'Government to government', NULL, 6),
    ('document_type', 'INV', 'Sales invoice', NULL, 1),
    ('document_type', 'CRE', 'Credit memo', NULL, 2),
    ('document_type', 'DEB', 'Debit memo', NULL, 3),
    ('document_type', 'FIN', 'Final', NULL, 4),
    ('document_type', 'MIX', 'Mixed invoice', NULL, 5),
    ('document_type', 'INC', 'Inter-company invoice', NULL, 6),
    ('document_type', 'PRF', 'Proforma invoice', NULL, 7),
    ('document_type', 'OVD', 'Overdue invoice', NULL, 8),
    ('document_type', 'INT', 'Interim', NULL, 9),
    ('document_type', 'RTN', 'Retainer', NULL, 10),
    ('cancellation_reason', '1', 'Duplicate', NULL, 1),
    ('cancellation_reason', '2', 'Data entry mistake', NULL, 2),
    ('cancellation_reason', '3', 'Order cancelled', NULL, 3),
    ('cancellation_reason', '4', 'Others', NULL, 4),
    ('currency', 'ETB', 'Ethiopian Birr', NULL, 1),
    ('currency', 'USD', 'US Dollar', NULL, 2),
    ('currency', 'EUR', 'Euro', NULL, 3),
    ('region', '13', 'Addis Ababa', NULL, 1),
    ('region', '2', 'Oromia', NULL, 2),
    ('region', '11', 'Amhara', NULL, 3),
    ('region', '3', 'Tigray', NULL, 4),
    ('region', '4', 'Afar', NULL, 5),
    ('region', '14', 'Sidama', NULL, 6),
    ('source_type', 'ERP', 'ERP', NULL, 1),
    ('source_type', 'POS', 'POS', NULL, 2),
    ('source_type', 'SPOS', 'Smart POS', NULL, 3),
    ('source_type', 'CRM', 'CRM', NULL, 4),
    ('payment_mode', 'CASH', 'Cash', NULL, 1),
    ('payment_mode', 'CHEQUE', 'Cheque', NULL, 2),
    ('payment_mode', 'CPO', 'CPO', NULL, 3),
    ('payment_mode', 'Local Bank Transfer', 'Local bank transfer', NULL, 4),
    ('payment_mode', 'SWIFT', 'SWIFT', NULL, 5),
    ('payment_mode', 'Wire Transfer', 'Wire transfer', NULL, 6),
    ('payment_mode', 'Letter of Credit', 'Letter of credit', NULL, 7),
    ('payment_mode', 'Card', 'Card', NULL, 8),
    ('business_size', 'S', 'Small', NULL, 1),
    ('business_size', 'M', 'Medium', NULL, 2),
    ('business_size', 'L', 'Large', NULL, 3)
ON CONFLICT (list_name, code) DO NOTHING;

-- ── Units: the MoR unit code sent as ItemList[].Unit ───────────────────────────────
ALTER TABLE uoms ADD COLUMN IF NOT EXISTS mor_code VARCHAR(20);

UPDATE uoms u SET mor_code = v.code
  FROM (VALUES ('Unit', 'Units', 'PCS'), ('Weight', 'kg', 'KLG'), ('Volume', 'Litre', 'LTR'), ('Length', 'm', 'MTR')) AS v(category, name, code),
       uom_categories c
 WHERE c.id = u.category_id AND lower(c.name) = lower(v.category) AND lower(u.name) = lower(v.name) AND u.mor_code IS NULL;

INSERT INTO uoms (category_id, name, symbol, ratio, is_reference, rounding, mor_code)
SELECT c.id, 'Roll', 'roll', 1, false, 1, 'ROL' FROM uom_categories c WHERE lower(c.name) = 'unit'
ON CONFLICT DO NOTHING;

-- ── Categories: excise rate (%) by category, as the MoR tax guide requires ─────────
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS excise_rate NUMERIC(7,4) NOT NULL DEFAULT 0;
ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS chk_product_categories_excise;
ALTER TABLE product_categories ADD CONSTRAINT chk_product_categories_excise CHECK (excise_rate >= 0 AND excise_rate <= 500);

-- ── Products ───────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS product_item_code_seq;

ALTER TABLE products ADD COLUMN IF NOT EXISTS item_code VARCHAR(15);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_code VARCHAR(5);
ALTER TABLE products ADD COLUMN IF NOT EXISTS harmonization_code VARCHAR(15);
-- NULL = use the category's excise rate.
ALTER TABLE products ADD COLUMN IF NOT EXISTS excise_rate NUMERIC(7,4);
-- MoR ProductDescription is max 100 characters; NULL = use the product name.
ALTER TABLE products ADD COLUMN IF NOT EXISTS invoice_description VARCHAR(100);
-- Derived, so it can never disagree with the product type.
ALTER TABLE products ADD COLUMN IF NOT EXISTS nature_of_supply VARCHAR(10)
    GENERATED ALWAYS AS (CASE WHEN product_type = 'service' THEN 'service' ELSE 'goods' END) STORED;

-- Backfill existing rows: item code from a short SKU, otherwise generated; tax code from the stored rate.
UPDATE products p SET item_code = p.sku
 WHERE p.item_code IS NULL AND p.sku IS NOT NULL AND length(p.sku) <= 15
   AND NOT EXISTS (SELECT 1 FROM products o WHERE o.id <> p.id AND lower(o.sku) = lower(p.sku));
UPDATE products SET item_code = 'P' || lpad(nextval('product_item_code_seq')::text, 7, '0') WHERE item_code IS NULL;
UPDATE products SET tax_code = CASE tax_rate WHEN 0 THEN 'VAT0' WHEN 2 THEN 'TOT2' WHEN 10 THEN 'TOT10' ELSE 'VAT15' END
 WHERE tax_code IS NULL;

ALTER TABLE products ALTER COLUMN tax_code SET DEFAULT 'VAT15';
ALTER TABLE products ALTER COLUMN tax_code SET NOT NULL;
ALTER TABLE products ALTER COLUMN item_code SET NOT NULL;

ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_tax_code;
ALTER TABLE products ADD CONSTRAINT chk_products_tax_code CHECK (tax_code IN ('VAT15', 'VAT0', 'VATEX', 'TOT2', 'TOT10'));
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_excise;
ALTER TABLE products ADD CONSTRAINT chk_products_excise CHECK (excise_rate IS NULL OR (excise_rate >= 0 AND excise_rate <= 500));
ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_item_code;
ALTER TABLE products ADD CONSTRAINT chk_products_item_code CHECK (item_code ~ '^[A-Za-z0-9._/-]{1,15}$');

CREATE UNIQUE INDEX IF NOT EXISTS uq_products_item_code ON products (lower(item_code));

-- Item code is generated when not given, so quick-created products can always be e-invoiced (MoR error 7014).
-- tax_rate follows tax_code, so the two can never disagree.
CREATE OR REPLACE FUNCTION products_eims_defaults() RETURNS trigger AS $$
BEGIN
    IF NEW.item_code IS NULL OR btrim(NEW.item_code) = '' THEN
        NEW.item_code := 'P' || lpad(nextval('product_item_code_seq')::text, 7, '0');
    END IF;
    IF NEW.tax_code IS NULL THEN
        NEW.tax_code := 'VAT15';
    END IF;
    NEW.tax_rate := CASE NEW.tax_code WHEN 'VAT15' THEN 15 WHEN 'TOT2' THEN 2 WHEN 'TOT10' THEN 10 ELSE 0 END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_eims_defaults ON products;
CREATE TRIGGER trg_products_eims_defaults
    BEFORE INSERT OR UPDATE OF item_code, tax_code, tax_rate ON products
    FOR EACH ROW EXECUTE FUNCTION products_eims_defaults();

UPDATE products SET tax_code = tax_code;
