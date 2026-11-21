-- AI knowledge base (AGENTS.md rule 20): Products pages, MoR e-invoicing fields and in-place record creation.
-- Re-running updates the entries, so edits here reach every tenant. Mobile steps change when the mobile Products screens ship.
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'products',
  'All Products',
  '/products',
  NULL,
  NULL,
  'both',
  'The product catalog: goods, consumables and services with item code, SKU, category, sales and purchase units, sales price, cost, tax code (VAT15, VAT0, VATEX, TOT2, TOT10), barcodes and e-invoicing readiness. Product types: Stock item (quantities tracked), Consumable (not tracked) and Service. Products are opened and edited in a side drawer, so the list stays in place. Archived products are hidden from lists and scanners but kept for history.',
  $kb$["search_products", "filter_by_category", "filter_by_type", "filter_by_einvoice_readiness", "view_archived", "create_product", "edit_product", "archive_product", "restore_product", "export_products_csv", "view_product_history", "add_barcodes"]$kb$::jsonb,
  $kb$[{"label": "New product", "location": "Top-right of the Products page header (shown with create_products)"}, {"label": "Export CSV", "location": "Top-right of the header, left of New product (shown with export_products)"}, {"label": "Search", "location": "Search box above the table: matches name, item code, SKU or barcode"}, {"label": "Filters", "location": "Category, Type and E-invoicing drop-downs beside the search box; Active / Archived / All tabs"}, {"label": "Open a product", "location": "Click any row (or press Enter on it) to open it in the side drawer"}, {"label": "Details / History tabs", "location": "Top of the product drawer; History lists every change with who made it and whether from the web or the mobile app"}, {"label": "Archive / Restore", "location": "Bottom-left of the product drawer (delete_products / restore_products)"}, {"label": "Save", "location": "Bottom-right of the product drawer (edit_products)"}, {"label": "Add barcode", "location": "Barcodes section of the product form; one barcode can be marked Primary"}]$kb$::jsonb,
  $kb$["view_products", "create_products", "edit_products", "delete_products", "restore_products", "export_products"]$kb$::jsonb,
  $kb${"web": ["Open Products from the module dock (Products -> All Products) or go to /products.", "To add one, click New product (top right). Enter the name; everything else is optional.", "Choose the type (Stock item, Consumable or Service), category, sales unit and purchase unit (same kind of unit, e.g. kg and Quintal).", "Enter the sales price and cost and pick the tax code (VAT 15% is the default).", "Optionally add barcodes (several per product for unit, box and pallet) and the e-invoicing fields.", "Click Create product. The new product opens in the list at once.", "To change one, click its row, edit in the drawer and click Save. The History tab shows what changed.", "To archive, open it and click Archive; switch to the Archived tab and click Restore to bring it back."], "mobile": ["Products is not in the mobile app yet. Open the web app and go to /products; the mobile Products screens are being built next."]}$kb$::jsonb
),
(
  'products',
  'Product Categories',
  '/products/categories',
  NULL,
  NULL,
  'both',
  'A tree of product categories (e.g. Food / Grains / Teff) with an optional code, a description and an excise rate that products in the category use on e-invoices unless a product sets its own. Shows how many products each category has. A category cannot be moved under itself or its own subcategories.',
  $kb$["create_category", "create_subcategory", "edit_category", "archive_category", "view_archived_categories"]$kb$::jsonb,
  $kb$[{"label": "New category", "location": "Top-right of the Product categories page (create_product_categories)"}, {"label": "+ (add subcategory)", "location": "Right end of a category row"}, {"label": "Pencil (edit)", "location": "Right end of a category row (edit_product_categories)"}, {"label": "Show archived", "location": "Switch above the tree"}, {"label": "Archive", "location": "Bottom-left of the category drawer (delete_product_categories)"}]$kb$::jsonb,
  $kb$["view_product_categories", "create_product_categories", "edit_product_categories", "delete_product_categories"]$kb$::jsonb,
  $kb${"web": ["Go to Products -> Categories & Trees (/products/categories).", "Click New category for a top-level category, or the + on a row to add a subcategory under it.", "Enter the name, and optionally a code, the excise % and a description, then click Create category.", "Click the pencil on a row to rename it, move it under another parent, or archive it.", "You can also create a category straight from the Category field of a product form: type a new name and choose Create."], "mobile": ["Products is not in the mobile app yet. Open the web app and go to /products/categories; the mobile Products screens are being built next."]}$kb$::jsonb
),
(
  'products',
  'Units of Measure',
  '/products/uoms',
  NULL,
  NULL,
  'both',
  'Units products are sold and bought in, grouped by kind (Unit, Weight, Volume, Length, Time). Each kind has one reference unit and every other unit has a ratio to it (1 Quintal = 100 kg, 1 Day = 8 hours). Units used on e-invoices need a MoR unit code (PCS, KLG, LTR, MTR, ROL); a unit without one shows ''no MoR code''.',
  $kb$["create_unit_category", "create_unit", "set_mor_unit_code", "archive_unit"]$kb$::jsonb,
  $kb$[{"label": "New unit category", "location": "Top-right of the Units of measure page (create_uoms)"}, {"label": "+ Unit", "location": "Top-right of each unit-kind card (create_uoms)"}, {"label": "MoR unit code", "location": "Drop-down on each unit row (edit_uoms); read-only badge otherwise"}, {"label": "Archive", "location": "Box icon at the end of a non-reference unit row (delete_uoms)"}]$kb$::jsonb,
  $kb$["view_uoms", "create_uoms", "edit_uoms", "delete_uoms"]$kb$::jsonb,
  $kb${"web": ["Go to Products -> Units of Measure (/products/uoms).", "To add a unit, click + Unit on the right card, enter the name, how many reference units it equals (e.g. Sack = 50 kg) and its MoR code if it has one.", "To set or change a MoR code, pick it from the drop-down on the unit row.", "For a new kind of unit, click New unit category and name its reference unit.", "A unit already used by products cannot be archived or have its ratio changed."], "mobile": ["Products is not in the mobile app yet. Open the web app and go to /products/uoms; the mobile Products screens are being built next."]}$kb$::jsonb
),
(
  'products',
  'E-invoicing (MoR) fields on products',
  '/products',
  NULL,
  NULL,
  'both',
  'What Ethiopia''s Ministry of Revenues (EIMS) needs on every product so it can appear on an e-invoice: item code (up to 15 characters, generated as P0000001… when left empty), tax code (VAT15 = 15%, VAT0 = zero-rated, VATEX = exempt, TOT2 / TOT10 = turnover tax 2% / 10%; the tax rate follows the code), supply type (Goods or Service, from the product type), HS code (optional, needed for exports), excise % (from the category unless set on the product; excise is calculated before discount), invoice description (up to 100 characters; defaults to the name) and a MoR code on the sales unit. Each product shows ''Ready for e-invoicing'' or a list of what to fix, and the list can be filtered to products that need fixing.',
  $kb$["set_item_code", "set_tax_code", "set_hs_code", "set_excise_rate", "set_invoice_description", "filter_not_ready_products"]$kb$::jsonb,
  $kb$[{"label": "E-invoicing (MoR) section", "location": "Product drawer, below the prices"}, {"label": "Tax", "location": "Drop-down beside Sales price and Cost in the product form"}, {"label": "Readiness", "location": "Top of the product Details tab, and the E-invoice column (check or warning icon) in the list"}, {"label": "E-invoicing filter", "location": "Drop-down above the product list: Ready for e-invoicing / Needs fixing"}]$kb$::jsonb,
  $kb$["view_products", "edit_products"]$kb$::jsonb,
  $kb${"web": ["Open Products (/products) and set the E-invoicing filter to Needs fixing.", "Open each product. The warning at the top of the Details tab says what to fix.", "If it says the unit has no MoR code, go to Units of Measure and set the unit's code.", "If the name is over 100 characters, enter a shorter Invoice description in the E-invoicing (MoR) section.", "Check the Tax code, and enter an HS code for exported goods and an excise % if it differs from the category.", "Click Save; the product shows Ready for e-invoicing."], "mobile": ["Products is not in the mobile app yet. Open the web app and go to /products; the mobile Products screens are being built next."]}$kb$::jsonb
),
(
  'platform',
  'Create or open records without leaving the page',
  '/products',
  NULL,
  NULL,
  'web',
  'Fields that pick a record (for example the Category field on a product) let you search, and if what you need is missing, create it on the spot: ''Create "name"'' makes it in one step, ''Create and edit "name"…'' opens the full form in a side drawer on top of your page, and ''Search more…'' opens a larger search. When you save, the new record is selected in the field and everything you had typed on the original form is kept. Drawers can stack (a product, then a new category from inside it). Creating is offered only if your company has the module and you have its create permission; otherwise the field says which permission is needed.',
  $kb$["quick_create_record", "create_and_edit_in_drawer", "search_more", "open_record_in_drawer"]$kb$::jsonb,
  $kb$[{"label": "Create \"…\"", "location": "Bottom of the field drop-down after typing a name that does not exist"}, {"label": "Create and edit \"…\"", "location": "Under Create in the same drop-down; opens a side drawer"}, {"label": "Search more…", "location": "Last item of the field drop-down"}]$kb$::jsonb,
  $kb$["create_product_categories", "create_products"]$kb$::jsonb,
  $kb${"web": ["In a record field (e.g. Category on a product), start typing the name.", "If it is not listed, choose Create \"name\" to add it at once, or Create and edit \"name\"… to fill in more details in a side drawer.", "Save the drawer: you return to your form with the new record selected and your other input unchanged."], "mobile": ["On mobile this works in the screens that have record fields; Products screens come to the app next."]}$kb$::jsonb
)
ON CONFLICT (module_key, feature_name) DO UPDATE SET
  route_path = EXCLUDED.route_path,
  mobile_screen_name = EXCLUDED.mobile_screen_name,
  mobile_nav_path = EXCLUDED.mobile_nav_path,
  platform = EXCLUDED.platform,
  page_purpose = EXCLUDED.page_purpose,
  available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations,
  required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions,
  updated_at = CURRENT_TIMESTAMP;
