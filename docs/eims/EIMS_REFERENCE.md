# MoR EIMS E-Invoicing — Developer Reference

Ethiopia's Ministry of Revenues (MoR) Electronic Invoice Management System (EIMS) registers every sales
invoice, credit/debit memo, receipt and withholding receipt in real time. MoR returns an **IRN**
(invoice reference number) or **RRN** (receipt reference number) and a signed QR code. A document is
only valid once MoR has accepted it.

This file is the single source of truth for e-invoicing data in Humanitas-ERP (AGENTS.md rule 28).
It summarises MoR's own documents: the BSP integration specification (`MoR_BSP_Master`, `EIMS_compliance_Draft`),
master data list, tax calculation guide, error list, API mock collection, accreditation checklist
(Directive No. 1142), cybersecurity audit requirements, certificate guideline and support-center checklist.
**When MoR sends a new version of any of them, update this file and rule 28 in the same commit.**

Status: product catalog fields are implemented (migration `20261121000002_add_eims_fields_to_catalog.sql`).
Everything else here is the target design for the Sales, POS, Invoicing and Receipts modules.

---

## 1. API surface (MoR core API)

| Purpose | Method and path | Notes |
|---|---|---|
| Login | `POST /auth/login` | client id, client secret, API key, seller TIN; returns access token and an encryption key |
| Refresh | `POST /auth/refresh-token` | refresh before expiry; errors 4411/4412 |
| Register invoice | `POST /v1/register` | one document (INV, CRE, DEB…) |
| Register in bulk | `POST /v1/bulkRegister` | asynchronous; poll for status |
| Cancel | `POST /v1/cancel` | `{ Irn, ReasonCode, Remark }` |
| Cancel in bulk | `POST /v1/bulkCancel` | MoR enforces cancellation limits (7002/7009) |
| Verify | `POST /v1/verify` | check an IRN |
| Sales receipt (CRV) | `POST /v1/receipt/sales` | payment against registered invoices |
| Withholding receipt | `POST /v1/receipt/withholding` | withholding certificate against an IRN |

Requests are signed with the taxpayer's certificate issued through INSA's PKI (CSR with CN = TIN, RSA 2048, SHA-256;
see the certificate guideline). The enveloped request carries request + signature + certificate.

## 2. Master data codes

Stored in the tenant table `eims_codes (list_name, code, name, rate)`. MoR adds codes on request, so codes are data,
not enums in code (the database CHECK on `products.tax_code` is the one exception, because tax maths depends on it).

| List | Codes |
|---|---|
| `unit` | PCS Pieces · KLG Kilogram · LTR Litre · MTR Metre · ROL Roll |
| `tax_code` (line) | VAT15 15% · VAT0 zero-rated · VATEX exempt · TOT2 2% · TOT10 10% |
| `withholding_code` | VATWH (B2G VAT withholding) · WTHOT 3% income withholding · WHOP2 2% |
| `nature_of_supply` | goods · service (sent as `Goods` / `Service`) |
| `transaction_type` | B2C · B2B · B2G · G2B · G2C · G2G |
| `document_type` | INV sales invoice · CRE credit memo · DEB debit memo · FIN final · MIX mixed · INC inter-company · PRF proforma · OVD overdue · INT interim · RTN retainer |
| `cancellation_reason` | 1 duplicate · 2 data entry mistake · 3 order cancelled · 4 others (remark required) |
| `currency` | ETB · USD · EUR |
| `region` | 13 Addis Ababa · 2 Oromia · 11 Amhara · 3 Tigray · 4 Afar · 14 Sidama |
| `source_type` | ERP · POS · SPOS · CRM |
| `payment_mode` | CASH · CHEQUE · CPO · Local Bank Transfer · SWIFT · Wire Transfer · Letter of Credit · Card |
| `business_size` | S · M · L |

## 3. Field limits (from the BSP field table)

Columns that hold these values use exactly these limits.

**Invoice header:** TransactionType (code) · DocumentDetails.Type (code) · DocumentNumber string 100, unique per seller ·
ManualNumber string 15 (conditional) · Date ISO 8601 date-time · SourceSystem.Type (code) · SourceSystem.SystemNumber string 10 ·
InvoiceCounter numeric 20, strictly sequential per source system (7015) · ReferenceDetails.PreviousIrn string 64 (7019) ·
RelatedDocument string 100 (required for CRE/DEB, 7021) · Reason string 200 (CRE/DEB) · PurchaseOrder 100 · Contract 100 ·
CashierName 100 · SalesPersonName 100 · FirstTicket / LastTicket 20 · InvoiceCurrency (code) · ExchangeRate decimal 20
(required when not ETB, deviation checked 7030) · PaymentTerm · PaymentMode.

**Values (decimal 20,2):** TotalValue · TaxValue · ExciseValue · Discount · IncomeWithholdValue · TransactionWithholdValue.

**Seller:** LegalName 100 · TIN 10 · VatNumber 13 (if VAT-registered) · SubTin 15 · TradeName 100 (required with SubTin) ·
Email 100 · Phone 20 · Region 3 (code) · City 50 · SubCity 100 · Wereda 50 · Kebele · Zone · HouseNumber 50 · Locality.

**Buyer:** LegalName 100 (B2B/B2G) · Tin 10 · VatNumber 13 · SubTin 15 · TradeName 100 · IdType / IdNumber (when no TIN) ·
Email 100 · Phone 20 · Region 3 · City 100 · SubCity · Wereda · Kebele 100 · Zone · HouseNumber 50 · Country · Locality.

**Item line (max 999 lines):** LineNumber numeric 4 · NatureOfSupplies (code) · HarmonizationCode 15 (conditional) ·
ItemCode 15 (mandatory unless manual source, 7014) · ProductDescription 100 · UnitPrice decimal 20,2 · Quantity decimal 20,4 ·
Unit (MoR code, 7023) · Discount 20,2 · ExciseTaxValue 20,2 · TaxCode (7024) · TaxAmount · PreTaxValue · TotalLineAmount.

**Sales receipt (CRV):** ReceiptNumber · ReceiptType · Reason · ReceiptDate · ReceiptCounter · ManualReceiptNumber ·
SourceSystemType / Number · ReceiptCurrency · ExchangeRate · CollectedAmount · SellerTIN · Invoices[] { InvoiceIRN,
PaymentCoverage FULL|PARTIAL, InvoicePaidAmount, DiscountAmount, RemainingAmount, TotalAmount } · TransactionDetails
{ ModeOfPayment, ChequeNumber, CPONumber, DocumentNumber, CollectorName, PaymentServiceProvider, AccountNumber, TransactionNumber }.

**Withholding receipt:** ReceiptNumber · Reason · ReceiptCounter · ManualReceiptNumber · SourceSystem · InvoiceIRN · Currency ·
ExchangeRate · WithholdDetail { Type, Rate, PreTaxAmount, WithholdingAmount }.

## 4. Tax calculation (MoR tax guide — order is mandatory)

1. Line total = unit price × quantity.
2. Line excise = line total × excise rate — **before** discount. Excise rate comes from the product, else its category.
3. Line discount = line total × discount rate, or a fixed amount. Discounts are per line, never one global percentage.
4. Totals: total amount = Σ line totals; total discount = Σ discounts; total excise = Σ excise.
5. Taxable total = Σ (line total − discount + excise) over **VAT15** lines. Non-taxable total = the same over VAT0/VATEX lines.
   Check: total − discount + excise = taxable + non-taxable.
6. VAT = taxable total × 15%. (TOT2/TOT10 lines: turnover tax at 2% / 10%.)
7. B2G only: VAT withheld = VAT × 50% — a real deduction from what the seller receives.
8. 3% income withholding = (total amount − total discount) × 3% — **display only, never subtracted** from the grand total.
9. Grand total = total amount − total discount + total excise + VAT = taxable + non-taxable + VAT.

Worked example (must be a unit test of the shared calculator): price 100,000 × 1, excise 12%, discount 10,000, VAT15, B2B →
excise 12,000; taxable 102,000; VAT 15,300; 3% withholding 2,700 (display); grand total 117,300. Same sale as B2G → VAT withheld 7,650.

CRV (payment of a credit invoice): balance before = invoice total − previously paid; remaining = balance − collected;
coverage FULL when remaining is 0. Reject overpayment and amounts ≤ 0. No tax is recalculated on a CRV; every CRV references the IRN.

## 5. Rules every e-invoicing table and flow follows

1. **Store MoR fields on the source record** (product, customer, company, branch) and **snapshot them on the invoice line**
   at the time of sale. Never look them up again when sending or reprinting.
2. **Registered documents are immutable.** Corrections are credit/debit memos (`CRE`/`DEB` with `RelatedDocument`) or a
   cancellation with a reason code. Database triggers block UPDATE/DELETE of registered rows.
3. **Receipt only after a valid IRN/RRN and QR** (accreditation 5.1.1.3); print IRN, RRN and QR legibly (5.1.1.4).
4. **One counter chain per source system:** `InvoiceCounter` strictly sequential, `PreviousIrn` = last accepted IRN of the
   same source system. Allocate inside a transaction with a row lock.
5. **Offline/outbox:** documents waiting for MoR go to an append-only outbox with an integrity hash, retry with backoff,
   and a status history. Nothing is lost when MoR or the network is down; the cashier sees the pending state.
6. **Seller identity (TIN, VAT number, address) is entered only during e-invoicing onboarding** and locked afterwards
   (accreditation 5.1.3.1); changes go through a controlled re-onboarding with audit.
7. **Audit log** of every exchange with MoR: who, when, what was sent, what came back (5.1.2.2). MoR auditors can export
   (5.1.2.3); retention follows the legal period (5.1.2.4).
8. **Errors:** every MoR code (4400–4607 auth, 67001–67015 certificate/signature, 7001–7030 and 70031 validation) maps to a
   plain message and the fix from MoR's error list. Validate locally before sending so 70xx errors are rare.
9. **Access:** only authorised roles configure credentials and keys (5.1.2.1); admin access needs MFA (cybersecurity 4.6).
10. **Secrets:** API credentials and private keys are encrypted at rest (AES-256), never logged, never committed.
    Certificates, `.pem`, `.key`, `.csr` files and MoR test data stay out of git.
11. **Transport:** TLS 1.2+ (1.3 where MoR supports it); mutual TLS where MoR requires it.
12. **Buyer copy:** a registered document can be sent to the buyer by email/SMS and printed on request (5.1.1.9).
13. **Data portability (SaaS, 5.2):** taxpayers can export all their data and leave; data is isolated per tenant;
    hosting in Ethiopia, Tier III, replicated across two data centres; a support centre with website and phone.

## 6. Columns future tables need (design checklist)

- **Company / branch (seller):** legal name, TIN, VAT number, sub-TIN, trade name, region code, city, sub-city, wereda,
  kebele, zone, house number, locality, email, phone, business size, registered tax accounts (VAT or TOT),
  e-invoicing onboarding state and lock timestamp.
- **Source systems (per branch, POS terminal or device):** type (ERP/POS/SPOS/CRM), system number, environment
  (sandbox/production), invoice counter, receipt counter, last IRN, encrypted credentials, certificate reference and expiry.
- **Customers (buyer):** legal name, TIN, VAT number, sub-TIN, trade name, ID type and number, region code, city,
  sub-city, wereda, kebele, zone, house number, country, email, phone, `is_government` (drives B2G), default transaction type.
- **Invoices:** document type, transaction type, document number, manual number, date-time, currency, exchange rate,
  payment term and mode, related document, previous IRN, invoice counter, reason, PO and contract numbers, cashier and
  salesperson names, the six value totals, e-invoice status (draft, queued, registered, failed, cancelled), IRN, ack date,
  signed QR, last MoR error code and message, cancellation reason, remark and date.
- **Invoice lines:** line number, item code, description, nature of supply, HS code, unit (MoR code), quantity (20,4),
  unit price, discount, excise rate and amount, tax code, tax amount, pre-tax value, line total.
- **Receipts:** the CRV fields in §3, the RRN, and the link to each invoice IRN with coverage and remaining amount.
- **Withholding receipts:** invoice IRN, type, rate, pre-tax amount, withholding amount, RRN.

## 7. Product catalog (implemented)

| Column | Meaning |
|---|---|
| `products.item_code` | MoR ItemCode, ≤ 15, unique per tenant; generated (`P0000001`…) when not given |
| `products.tax_code` | VAT15 / VAT0 / VATEX / TOT2 / TOT10; `tax_rate` is derived from it by a trigger |
| `products.nature_of_supply` | generated from `product_type` (service → service, otherwise goods) |
| `products.harmonization_code` | HS code, ≤ 15, optional (exports, some taxpayers) |
| `products.excise_rate` | % override; NULL = category rate |
| `product_categories.excise_rate` | % for the category (default 0) |
| `products.invoice_description` | ≤ 100; NULL = product name |
| `uoms.mor_code` | MoR unit code; units without one can't be e-invoiced |

The API returns `eims_ready` and `eims_issues` for each product, and `GET /products?eims=not_ready` lists products to fix.

## 8. Open questions to confirm with MoR (sandbox)

1. The master data list shows EUR with code `Br`; we use `EUR`.
2. B2G VAT withholding: the tax guide says 50% of VAT; another integrator's notes cite 100% for some government buyers.
3. Rounding: our rule 24 uses half-up per component; another integrator needed banker's rounding to pass 7012. Settle with sandbox tests.
4. `VAT15` is used by the API and tax guide but missing from the master tax code list.
5. Units for services (hour, day) and trade units (dozen, quintal, pack) have no MoR code yet; ask MoR to add them, or convert to a coded unit.
6. Nature-of-supply spelling (`Goods`/`Service` in the API, `goods`/`Service` in master data).
7. HS code format and when it becomes mandatory.
