-- Products (featureslist §1): printable barcode, QR and price labels.
-- A template is a label size and layout (a roll for label printers, or an A4 sticker sheet of
-- columns x rows) and what each label shows. Printing happens in the browser.

CREATE TABLE IF NOT EXISTS label_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(100)  NOT NULL,
    layout            VARCHAR(10)   NOT NULL DEFAULT 'roll' CHECK (layout IN ('roll', 'sheet')),
    label_width_mm    NUMERIC(6,2)  NOT NULL DEFAULT 50 CHECK (label_width_mm BETWEEN 10 AND 300),
    label_height_mm   NUMERIC(6,2)  NOT NULL DEFAULT 25 CHECK (label_height_mm BETWEEN 10 AND 300),
    page_width_mm     NUMERIC(6,2)  NOT NULL DEFAULT 210 CHECK (page_width_mm BETWEEN 20 AND 600),
    page_height_mm    NUMERIC(6,2)  NOT NULL DEFAULT 297 CHECK (page_height_mm BETWEEN 20 AND 600),
    columns           INTEGER       NOT NULL DEFAULT 1 CHECK (columns BETWEEN 1 AND 20),
    rows              INTEGER       NOT NULL DEFAULT 1 CHECK (rows BETWEEN 1 AND 40),
    margin_top_mm     NUMERIC(6,2)  NOT NULL DEFAULT 0 CHECK (margin_top_mm BETWEEN 0 AND 100),
    margin_left_mm    NUMERIC(6,2)  NOT NULL DEFAULT 0 CHECK (margin_left_mm BETWEEN 0 AND 100),
    gap_x_mm          NUMERIC(6,2)  NOT NULL DEFAULT 0 CHECK (gap_x_mm BETWEEN 0 AND 100),
    gap_y_mm          NUMERIC(6,2)  NOT NULL DEFAULT 0 CHECK (gap_y_mm BETWEEN 0 AND 100),
    barcode_format    VARCHAR(10)   NOT NULL DEFAULT 'auto' CHECK (barcode_format IN ('auto', 'code128', 'ean13', 'qr', 'none')),
    show_name         BOOLEAN       NOT NULL DEFAULT true,
    show_variant      BOOLEAN       NOT NULL DEFAULT true,
    show_sku          BOOLEAN       NOT NULL DEFAULT false,
    show_price        BOOLEAN       NOT NULL DEFAULT true,
    show_barcode_text BOOLEAN       NOT NULL DEFAULT true,
    show_company      BOOLEAN       NOT NULL DEFAULT false,
    font_size_pt      NUMERIC(4,1)  NOT NULL DEFAULT 8 CHECK (font_size_pt BETWEEN 4 AND 36),
    -- Prices come from this list; NULL = the default list.
    price_list_id     UUID REFERENCES price_lists(id),
    company_id        UUID,
    sort_order        INTEGER       NOT NULL DEFAULT 0,
    is_active         BOOLEAN       NOT NULL DEFAULT true,
    created_by        UUID,
    updated_by        UUID,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_label_templates_name
    ON label_templates (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE INDEX IF NOT EXISTS idx_label_templates_company ON label_templates (company_id);

-- Common sizes, ready to print.
INSERT INTO label_templates (name, layout, label_width_mm, label_height_mm, page_width_mm, page_height_mm, columns, rows,
                             margin_top_mm, margin_left_mm, barcode_format, show_sku, font_size_pt, sort_order)
SELECT * FROM (VALUES
    ('Shelf label 50 × 25 mm',             'roll',  50,   25,   210, 297, 1, 1,  0,    0, 'auto', false, 8, 1),
    ('Price tag 40 × 30 mm',               'roll',  40,   30,   210, 297, 1, 1,  0,    0, 'auto', true,  8, 2),
    ('QR sticker 30 × 30 mm',              'roll',  30,   30,   210, 297, 1, 1,  0,    0, 'qr',   false, 6, 3),
    ('A4 sheet 3 × 8 (70 × 37 mm)',        'sheet', 70,   37,   210, 297, 3, 8,  0.5,  0, 'auto', true,  9, 4),
    ('A4 sheet 4 × 10 (48.5 × 25.4 mm)',   'sheet', 48.5, 25.4, 210, 297, 4, 10, 21.5, 8, 'auto', false, 7, 5)
) AS t(name, layout, label_width_mm, label_height_mm, page_width_mm, page_height_mm, columns, rows,
       margin_top_mm, margin_left_mm, barcode_format, show_sku, font_size_pt, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM label_templates);
