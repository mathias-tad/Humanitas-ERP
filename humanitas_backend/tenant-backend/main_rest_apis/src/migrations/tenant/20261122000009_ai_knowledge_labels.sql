-- AI knowledge base (AGENTS.md rule 20): barcode, QR and price label printing (featureslist §1).
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'products',
  'Barcode and Price Labels',
  '/products/labels',
  NULL,
  NULL,
  'web',
  'Prints barcode, QR and price labels for products: shelf labels, price tags and stickers. Pick the products (search, scan, or add a whole category) and how many labels of each; a product with variants adds its variants. Choose a template: a roll for label printers (one label per page, e.g. 50 × 25 mm) or an A4 sticker sheet (columns × rows, e.g. 3 × 8). A template sets the label size, margins and gaps, the barcode type (automatic: EAN-13, EAN-8 or UPC-A when the product barcode is one, otherwise Code 128; or always Code 128, EAN-13, QR, or none), what the label shows (name, variant, SKU, price, barcode digits, company) and the price list prices come from. The preview shows the labels exactly as they print; Print opens the browser print window with the right page size. Printing is done from the web app because it needs a printer.',
  $kb$["print_labels", "add_products_to_labels", "scan_products_to_labels", "add_category_to_labels", "choose_label_template", "create_label_template", "edit_label_template", "archive_label_template"]$kb$::jsonb,
  $kb$[{"label": "Labels", "location": "Products menu -> Barcode & Price Labels; also Print labels on the Products page"}, {"label": "Add products", "location": "Search box at the top of the Labels page; Scan with the camera, or a USB/Bluetooth scanner anywhere on the page"}, {"label": "Add category", "location": "Beside the product search"}, {"label": "Template", "location": "Right column: choose a template; New template, Edit and Archive under it (create/edit/delete_label_templates)"}, {"label": "Print", "location": "Top-right of the Labels page"}]$kb$::jsonb,
  $kb$["view_label_templates", "create_label_templates", "edit_label_templates", "delete_label_templates"]$kb$::jsonb,
  $kb${"web": ["Go to Products -> Barcode & Price Labels (/products/labels), or click Print labels on the Products page.", "Add products: search by name, SKU or barcode, scan them, or add a whole category. Set how many labels of each (a product with variants adds each variant).", "Choose a template: a roll size for a label printer or an A4 sticker sheet. Change the price list if the labels should show wholesale or VIP prices.", "Check the preview, then click Print. In the print window keep the scale at 100% (no fit to page) and margins at none.", "To make your own size, click New template, enter the label width and height (and for sheets the columns, rows, margins and gaps), choose what to show, and save."], "mobile": ["Labels are printed from the web app (Products -> Barcode & Price Labels) because printing needs a computer and a printer. In the app you can scan and open products and see their barcodes."]}$kb$::jsonb
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
