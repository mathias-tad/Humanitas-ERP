-- AI knowledge base (AGENTS.md rule 20): Products completion (featureslist §1).
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'products', 'Product Reports', '/products/reports', NULL, NULL, 'web',
  'What the catalog holds and where it has gaps: products, variants, kits and combos, by type and by category; catalog completeness; margins (average, median, bands, the lowest-margin products); gaps such as no barcode, no sales price, no cost, priced below cost, no category, no picture and not ready for e-invoicing, each opening the matching product list; price lists, rules and customers on lists. Stock and sales figures come with Inventory and Sales.',
  $kb$["view_catalog_summary", "view_margins", "open_catalog_gaps", "export_catalog_gaps"]$kb$::jsonb,
  $kb$[{"label": "Gap cards", "location": "Product Reports: click one to open the products with that gap"}, {"label": "Export gaps", "location": "Top-right of Product Reports (export_product_reports)"}, {"label": "Category", "location": "Filter at the top"}]$kb$::jsonb,
  $kb$["view_product_reports", "export_product_reports"]$kb$::jsonb,
  $kb${"web": ["Go to Products -> Product Reports (/products/reports).", "Check completeness and the gap cards; click a card (for example No barcode) to open those products and fix them.", "Use the margin bands and the lowest-margin list to find products priced too low.", "Click Export gaps for a CSV of every product with a gap."], "mobile": ["Product Reports come with the next app update; use the web app until then."]}$kb$::jsonb
),
(
  'products', 'Product Settings', '/products/settings', NULL, NULL, 'web',
  'Catalog settings for the whole tenant: automatic SKUs (prefix, number of digits, next number), automatic in-store EAN-13 barcodes (prefix 20-29 or your GS1 company prefix, next number), defaults for new products (type, tax code, unit, category), required category or barcode, and the warning for prices below cost. Generated barcodes are replaced by one per variant when a product gets variants.',
  $kb$["set_sku_numbering", "set_barcode_numbering", "set_product_defaults", "require_product_fields"]$kb$::jsonb,
  $kb$[{"label": "Save", "location": "Bottom of Product Settings (edit_product_settings)"}]$kb$::jsonb,
  $kb$["view_product_settings", "edit_product_settings"]$kb$::jsonb,
  $kb${"web": ["Go to Products -> Product Settings (/products/settings).", "Turn on automatic SKUs and set the prefix and digits; the preview shows the next SKU.", "Turn on automatic barcodes with an in-store prefix (20-29) or your GS1 company prefix; new products and variants get an EAN-13.", "Set the default type, tax code, unit and category for new products, and what every product must have, then Save."], "mobile": ["Product Settings are changed in the web app."]}$kb$::jsonb
),
(
  'products', 'Product Pictures and Attachments', '/products', NULL, NULL, 'web',
  'A product''s gallery (JPEG, PNG, WebP or GIF, up to 5 MB each) and attachments (PDF, Word, Excel, PowerPoint, text or CSV: spec sheets, certificates, manuals), up to 30 per product. The main picture is the product''s image in lists, POS, labels and the app; removing it makes the next picture the main one. Every change is on the product history.',
  $kb$["upload_product_picture", "set_main_picture", "reorder_pictures", "attach_product_document", "remove_product_file"]$kb$::jsonb,
  $kb$[{"label": "Pictures tab", "location": "Product drawer (edit_products to add or remove)"}, {"label": "Set as main", "location": "On each picture"}, {"label": "Attach file", "location": "Pictures tab, Attachments section"}]$kb$::jsonb,
  $kb$["view_products", "edit_products"]$kb$::jsonb,
  $kb${"web": ["Open a product in Products (/products) and go to the Pictures tab.", "Click Add pictures, choose the files; the first becomes the main picture.", "Click Set as main on another picture or drag to reorder.", "Under Attachments click Attach file for a spec sheet or certificate."], "mobile": ["Product pictures and taking a photo from the app come with the next app update; use the web app until then."]}$kb$::jsonb
),
(
  'products', 'Packaging and GS1 Barcodes', '/products', NULL, NULL, 'web',
  'Packaging levels of a product: unit, inner pack, case, pallet, with how many base units each holds, an optional GTIN (8, 12, 13 or 14 digits, check digit verified), weight and size, and whether it is sold or bought in that package. Scanning a case GTIN finds the product with the case quantity. Also the product''s base, purchase and sales units (same unit category), the minimum order and "sold in multiples of", which Sales and POS check.',
  $kb$["add_packaging", "set_packaging_gtin", "set_sales_unit", "set_minimum_order", "scan_case_barcode"]$kb$::jsonb,
  $kb$[{"label": "Packaging tab", "location": "Product drawer (edit_products)"}, {"label": "Units and order quantities", "location": "Product form, Units section"}]$kb$::jsonb,
  $kb$["view_products", "edit_products"]$kb$::jsonb,
  $kb${"web": ["Open a product and go to the Packaging tab.", "Add a row per package (for example Box of 12, Carton of 48), its level, quantity and GTIN, then Save.", "In the product form set the purchase and sales units and, if needed, the minimum order and Sold in multiples of."], "mobile": ["Packaging shows on the product in the app with the next app update; use the web app until then."]}$kb$::jsonb
),
(
  'products', 'Kits and Combos', '/products', NULL, NULL, 'web',
  'A kit is one product made of fixed components (a gift basket, a school pack) sold at the kit''s price; the contents show the components'' total price and cost for comparison. A combo lets the customer choose from groups (a main, a side, a drink) with a minimum and maximum per group, default choices and extra prices. Components must be sold items: variants, not products with variants, and not other kits or combos. A kit or combo has no variants.',
  $kb$["make_kit", "make_combo", "add_combo_group", "compare_kit_price"]$kb$::jsonb,
  $kb$[{"label": "Contents tab", "location": "Product drawer: Single / Kit / Combo (edit_products)"}, {"label": "Kits and combos", "location": "Products list filter"}]$kb$::jsonb,
  $kb$["view_products", "edit_products"]$kb$::jsonb,
  $kb${"web": ["Open the product and go to the Contents tab.", "Choose Kit and add the components with their quantities, or Combo and add groups with their choices, minimum and maximum.", "Compare the kit price with the components total, then Save."], "mobile": ["Kit and combo contents show on the product in the app with the next app update; use the web app until then."]}$kb$::jsonb
),
(
  'products', 'Customer Price Lists', '/products/pricelists', NULL, NULL, 'web',
  'Customers put on a price list buy at its prices (wholesale customers, VIPs, one customer''s contract prices). A customer is on one list at most; a person at a company buys at the company''s list; customers on no list get the default list. Sales and POS ask the price with the customer.',
  $kb$["add_customers_to_price_list", "remove_customer_from_price_list", "check_customer_price"]$kb$::jsonb,
  $kb$[{"label": "Customers", "location": "Price list detail, Customers tab (edit_price_lists)"}]$kb$::jsonb,
  $kb$["view_price_lists", "edit_price_lists"]$kb$::jsonb,
  $kb${"web": ["Go to Products -> Price Lists (/products/pricelists) and open a list.", "On the Customers tab click Add customers and pick them; a customer on another list moves to this one.", "For one customer's contract prices, create a list for them, add their rules, then add the customer."], "mobile": ["Customer price lists are set in the web app; the app shows the customer's prices with the next app update."]}$kb$::jsonb
)
ON CONFLICT (module_key, feature_name) DO UPDATE SET
  route_path = EXCLUDED.route_path, mobile_screen_name = EXCLUDED.mobile_screen_name, mobile_nav_path = EXCLUDED.mobile_nav_path,
  platform = EXCLUDED.platform, page_purpose = EXCLUDED.page_purpose, available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations, required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions, updated_at = CURRENT_TIMESTAMP;
