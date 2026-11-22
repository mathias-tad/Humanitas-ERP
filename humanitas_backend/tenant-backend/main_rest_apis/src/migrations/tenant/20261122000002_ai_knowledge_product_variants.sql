-- AI knowledge base (AGENTS.md rule 20): product attributes and variants (featureslist §1).
-- Re-running updates the entries, so edits here reach every tenant.
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'products',
  'Product Attributes',
  '/products/attributes',
  NULL,
  NULL,
  'web',
  'The attributes products can vary by (Size, Color, Material…) and their values (S, M, L; Red, Blue). Each value can have a short code used in variant SKUs (RED, XL) and, for colors, a swatch color. Shows how many products use each attribute and how many active variants use each value. An attribute or value used by active products cannot be archived until it is removed from their variants. Size and Color come ready with common values.',
  $kb$["create_attribute", "add_attribute_value", "rename_attribute_value", "set_value_code", "set_value_color", "archive_attribute", "archive_attribute_value", "view_archived_attributes"]$kb$::jsonb,
  $kb$[{"label": "New attribute", "location": "Top-right of the Attributes page (create_product_attributes)"}, {"label": "Add value", "location": "Input at the end of each attribute card; press Enter to add (edit_product_attributes)"}, {"label": "Value chip", "location": "Click a value to rename it, change its code or color (edit_product_attributes)"}, {"label": "Archive", "location": "Menu on each attribute card and in the value dialog (delete_product_attributes)"}, {"label": "Show archived", "location": "Switch above the cards"}]$kb$::jsonb,
  $kb$["view_product_attributes", "create_product_attributes", "edit_product_attributes", "delete_product_attributes"]$kb$::jsonb,
  $kb${"web": ["Go to Products -> Attributes & Variants (/products/attributes).", "Click New attribute, enter its name (e.g. Size), choose how it shows (buttons, drop-down or color swatches) and type its values, then click Create attribute.", "To add a value later, type it in the box at the end of the attribute card and press Enter. You can also add values from a product's Variants tab.", "Click a value to rename it, set its SKU code or its color. Renaming a value renames every variant that uses it.", "Archive values or attributes you no longer use; ones used by active variants must be removed from those products first."], "mobile": ["Attributes are managed in the web app (Products -> Attributes & Variants). In the mobile app, each variant shows up as its own product: scanning a variant's barcode opens that variant."]}$kb$::jsonb
),
(
  'products',
  'Product Variants',
  '/products',
  'ProductDetailScreen',
  'Home -> Quick Actions -> Products -> (product)',
  'both',
  'A product that comes in several versions (a T-shirt in sizes S-XL and colors Red, Blue) is set up once as the parent; each combination becomes a variant named "T-shirt (Red, M)". The parent holds the shared details (category, type, units, tax, HS code, excise, description) and every variant follows them. Each variant has its own SKU (parent SKU plus value codes, e.g. TSHIRT-RED-M), barcodes, cost, item code for MoR e-invoices, and a price extra added to the parent''s sales price. Sales, POS and stock use the variants; the parent itself is not sold or scanned. Removing a value archives its variants (they keep their history) and adding it back restores them. The product list shows parents with their number of variants; searching a variant''s SKU or barcode finds its parent.',
  $kb$["set_up_variants", "add_attribute_to_product", "add_value_on_the_fly", "generate_variants", "set_variant_price_extra", "set_variant_sku", "add_variant_barcode", "archive_variant", "restore_variant", "remove_variants"]$kb$::jsonb,
  $kb$[{"label": "Variants tab", "location": "Top of the product drawer, beside Details and History"}, {"label": "Add attribute", "location": "Variants tab: drop-down to pick an attribute, then tick its values (edit_products)"}, {"label": "New value", "location": "Variants tab: box beside an attribute's values; type and press Enter (edit_product_attributes)"}, {"label": "Save variants", "location": "Bottom of the Variants tab; shows how many variants will be created or archived first (edit_products)"}, {"label": "Variant row", "location": "Variants tab table: click a row to open the variant and set its SKU, barcodes, price extra and cost"}, {"label": "Variant of …", "location": "Top of a variant's drawer: link back to the parent product"}]$kb$::jsonb,
  $kb$["view_products", "edit_products", "edit_product_attributes", "delete_products", "restore_products"]$kb$::jsonb,
  $kb${"web": ["Open the product (Products -> All Products, click its row) and go to the Variants tab.", "Pick an attribute (e.g. Size) and tick the values the product comes in; add another attribute (e.g. Color) the same way. Type a new value and press Enter to add it on the spot.", "Check the count shown (e.g. 8 variants will be created) and click Save variants.", "Each variant appears in the table with its SKU and price. Click one to give it a barcode, a price extra (e.g. +50 for XL) or its own cost.", "Shared details (category, unit, tax, price) are changed on the parent; the variants follow at once.", "To stop selling a combination, untick its value and save (its variants are archived), or open one variant and click Archive. Ticking the value again restores them."], "mobile": ["In the app (Home -> Quick Actions -> Products), a product with variants shows how many it has; scan a variant's barcode or search its SKU to open that variant directly.", "Setting up attributes and variants, and editing a variant's price extra, is done in the web app on the product's Variants tab."]}$kb$::jsonb
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
