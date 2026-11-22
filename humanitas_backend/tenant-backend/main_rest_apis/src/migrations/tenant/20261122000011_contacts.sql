-- Contacts (featureslist §4.1, CRM 1.3): one base of companies and people for every module.
-- A contact is a company or a person; a person can belong to a company (parent_id). Roles say what
-- a contact is to you: a customer (price list, credit limit, payment terms, account manager) and/or
-- a vendor (Purchasing). CRM, Sales, POS, Accounting, Purchasing, the online store and Delivery all
-- use the same records, so one company is never entered twice. History lives on the timeline (§30).

CREATE SEQUENCE IF NOT EXISTS contact_code_seq START 1;

CREATE TABLE IF NOT EXISTS contact_categories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    color         VARCHAR(7) CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
    -- Customers in this category get this price list unless they have their own.
    price_list_id UUID REFERENCES price_lists(id),
    company_id    UUID,
    sort_order    INTEGER     NOT NULL DEFAULT 0,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_by    UUID,
    updated_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_categories_name
    ON contact_categories (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

CREATE TABLE IF NOT EXISTS contacts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code               VARCHAR(30)  NOT NULL DEFAULT ('C' || lpad(nextval('contact_code_seq')::text, 6, '0')),
    contact_type       VARCHAR(10)  NOT NULL DEFAULT 'company' CHECK (contact_type IN ('company', 'person')),
    -- A person's company (itself a company contact).
    parent_id          UUID REFERENCES contacts(id),
    is_primary_contact BOOLEAN      NOT NULL DEFAULT false,
    job_title          VARCHAR(100),
    name               VARCHAR(255) NOT NULL,
    legal_name         VARCHAR(255),
    -- Ethiopian Taxpayer Identification Number: 10 digits.
    tin                VARCHAR(10)  CHECK (tin IS NULL OR tin ~ '^[0-9]{10}$'),
    vat_number         VARCHAR(30),
    phone              VARCHAR(30),
    mobile             VARCHAR(30),
    email              VARCHAR(255),
    website            VARCHAR(255),
    country            CHAR(2)      NOT NULL DEFAULT 'ET',
    region             VARCHAR(100),
    city               VARCHAR(100),
    subcity            VARCHAR(100),
    woreda             VARCHAR(100),
    street             VARCHAR(255),
    category_id        UUID REFERENCES contact_categories(id),
    tags               TEXT[]       NOT NULL DEFAULT '{}',
    is_customer        BOOLEAN      NOT NULL DEFAULT false,
    is_vendor          BOOLEAN      NOT NULL DEFAULT false,
    price_list_id      UUID REFERENCES price_lists(id),
    credit_limit       NUMERIC(18,2) CHECK (credit_limit IS NULL OR credit_limit >= 0),
    payment_terms_days INTEGER      NOT NULL DEFAULT 0 CHECK (payment_terms_days BETWEEN 0 AND 365),
    account_manager_id UUID,
    notes              TEXT,
    company_id         UUID,
    is_active          BOOLEAN      NOT NULL DEFAULT true,
    created_by         UUID,
    updated_by         UUID,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_contacts_parent CHECK (parent_id IS NULL OR (contact_type = 'person' AND parent_id <> id))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_code ON contacts (lower(code));
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_primary ON contacts (parent_id) WHERE is_primary_contact AND is_active AND parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts (lower(name));
CREATE INDEX IF NOT EXISTS idx_contacts_parent ON contacts (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tin ON contacts (tin) WHERE tin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts (is_customer) WHERE is_customer;
CREATE INDEX IF NOT EXISTS idx_contacts_vendor ON contacts (is_vendor) WHERE is_vendor;

-- Starting categories (rename or archive them freely).
INSERT INTO contact_categories (name, color, sort_order)
SELECT * FROM (VALUES ('Retail', '#0EA5E9', 1), ('Wholesale', '#22C55E', 2), ('Corporate', '#8B5CF6', 3), ('Government', '#F59E0B', 4)) AS t(name, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM contact_categories);
