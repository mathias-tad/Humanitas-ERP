-- AI knowledge base (AGENTS.md rule 20): price lists and product prices (featureslist §1).
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'products',
  'Price Lists',
  '/products/pricelists',
  NULL,
  NULL,
  'web',
  'Price tiers such as Retail, Wholesale, Distributor and VIP. Each list has a currency (ETB by default), an optional company (or shared by all companies) and rules. A rule applies to one product (a product with variants: all its variants, or one variant), a category (and its sub-categories) or every product, from a minimum quantity (quantity breaks such as 10 or more at 95) and optionally between two dates (promotions). It sets a fixed price, a percentage off the sales price, or a percentage on top of cost. The most specific rule wins (variant, then product, then nearest category, then every product), then the highest minimum quantity the line reaches. Without a matching rule the product''s own sales price applies. One list is the default; Sales and POS start with it. Lists in another currency use fixed prices until exchange rates come with Accounting. The Compare tab shows products across lists and exports CSV.',
  $kb$["create_price_list", "set_default_price_list", "add_price_rule", "add_quantity_break", "add_promotion_dates", "archive_price_rule", "archive_price_list", "compare_price_lists", "export_price_comparison"]$kb$::jsonb,
  $kb$[{"label": "New price list", "location": "Top-right of the Price Lists page (create_price_lists)"}, {"label": "Price list", "location": "Left column: click a list to open its rules"}, {"label": "Add rule", "location": "Under the rules table of the open list (edit_price_lists)"}, {"label": "Make default", "location": "Header of the open list (edit_price_lists)"}, {"label": "Archive", "location": "Header of the open list (delete_price_lists); the default list cannot be archived"}, {"label": "Compare", "location": "Tab at the top of the page; Export CSV beside the search (export_price_lists)"}]$kb$::jsonb,
  $kb$["view_price_lists", "create_price_lists", "edit_price_lists", "delete_price_lists", "export_price_lists"]$kb$::jsonb,
  $kb${"web": ["Go to Products -> Price Lists (/products/pricelists).", "Click New price list, enter its name (e.g. Wholesale), currency and, if it is for one company only, the company; tick Default if Sales and POS should use it first.", "Open the list and click Add rule: choose what it applies to (a product, a category or every product), the minimum quantity, and the price: a fixed price, a % off the sales price or a % on cost. Add start and end dates for a promotion.", "Add more rules for quantity breaks (e.g. 1+ at 118, 10+ at 110, 50+ at 100).", "Use the Compare tab to see products across lists at a quantity, and Export CSV to share it."], "mobile": ["Price lists are managed in the web app (Products -> Price Lists). Sales and POS in the app use the prices they set."]}$kb$::jsonb
),
(
  'products',
  'Product Prices',
  '/products',
  NULL,
  NULL,
  'web',
  'The Prices tab of a product shows its price on every active price list at a quantity you choose, which rule set it, and the product''s own sales price. For a product with variants it lists each variant.',
  $kb$["view_product_prices", "check_price_at_quantity"]$kb$::jsonb,
  $kb$[{"label": "Prices tab", "location": "Top of the product drawer, beside Details, Variants and History"}, {"label": "Quantity", "location": "Box at the top of the Prices tab"}]$kb$::jsonb,
  $kb$["view_products", "view_price_lists"]$kb$::jsonb,
  $kb${"web": ["Open the product (Products -> All Products, click its row) and go to the Prices tab.", "Change the quantity to see quantity breaks; each list shows the price and whether a rule or the sales price set it.", "To change a price, open Products -> Price Lists and edit the list's rules."], "mobile": ["Product prices per list are shown in the web app (product -> Prices tab)."]}$kb$::jsonb
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
