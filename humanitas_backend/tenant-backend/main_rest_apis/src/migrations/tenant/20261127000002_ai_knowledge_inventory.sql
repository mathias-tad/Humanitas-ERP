-- AI knowledge base (AGENTS.md rule 20): Inventory (featureslist §2).
INSERT INTO ai_knowledge_entries (
  module_key, feature_name, route_path, mobile_screen_name, mobile_nav_path, platform, page_purpose, available_actions, button_locations, required_permissions, step_by_step_instructions
) VALUES
(
  'inventory', 'Stock on hand', '/inventory', 'StockScreen', 'Home -> Stock', 'both',
  'What is where: one line per product, warehouse, location and lot, with on hand, reserved and free quantities (and value for people with view_stock_valuation). Follows the company/branch switcher. Filter by warehouse, "in stock only" and "below reorder point"; search or scan a product. Adjust adds or removes stock at one location with a reason, kept in the movement history; outbound adjustments never change the cost, inbound ones carry the given cost or the product cost. Below zero is refused unless negative stock is allowed for the product or the company.',
  $kb$["view_stock", "search_stock", "scan_product_stock", "adjust_stock", "export_stock"]$kb$::jsonb,
  $kb$[{"label": "Adjust stock", "location": "Top-right of Stock on hand, and Adjust on each line (adjust_stock)"}, {"label": "Scan", "location": "Camera button top-right; a USB/Bluetooth scanner works anywhere on the page"}, {"label": "Export", "location": "Top-right (export_stock)"}, {"label": "Warehouse / In stock only / Below reorder point", "location": "Filters above the list"}]$kb$::jsonb,
  $kb$["view_stock", "adjust_stock", "export_stock", "view_stock_valuation"]$kb$::jsonb,
  $kb${"web": ["Go to Inventory -> Stock Overview (/inventory).", "Search a product, SKU, location or lot, or scan its barcode; pick a warehouse to narrow it down.", "To correct a count click Adjust on the line: Add or Remove, the quantity and the reason, then Save.", "Click Export for a CSV of what is shown."], "mobile": ["Open Home -> Stock.", "Search, or tap the scanner icon and scan the product's barcode.", "Tap a line, choose Add or Remove, enter the quantity and the reason, and Save."]}$kb$::jsonb
),
(
  'inventory', 'Warehouses', '/inventory/warehouses', NULL, NULL, 'web',
  'Storage sites. A new warehouse gets its Stock, Input, Output, Transit and View locations at once. A warehouse belongs to a company and branch (moving it moves its locations and stock with it). A warehouse holding stock cannot be archived.',
  $kb$["create_warehouse", "edit_warehouse", "archive_warehouse", "restore_warehouse"]$kb$::jsonb,
  $kb$[{"label": "New warehouse", "location": "Top-right of Warehouses (create_warehouses)"}, {"label": "Archive / Restore", "location": "Actions column (delete_warehouses / edit_warehouses)"}]$kb$::jsonb,
  $kb$["view_warehouses", "create_warehouses", "edit_warehouses", "delete_warehouses"]$kb$::jsonb,
  $kb${"web": ["Go to Inventory -> Warehouses & Bins (/inventory/warehouses) and click New warehouse.", "Enter a short code and the name, the address and the manager; keep Create default locations on.", "To close a warehouse first move or adjust its stock out, then archive it."], "mobile": ["Warehouses are set up in the web app."]}$kb$::jsonb
),
(
  'inventory', 'Locations', '/inventory/locations', NULL, NULL, 'web',
  'The location tree inside each warehouse (zone, aisle, rack, bin) with a barcode per location. View locations only group others and hold no stock; supplier, customer and transit locations are for stock on its way. A location holding stock, or with active sub-locations, cannot be archived; a location cannot be put inside itself.',
  $kb$["create_location", "edit_location", "archive_location"]$kb$::jsonb,
  $kb$[{"label": "New location", "location": "Top-right of Locations (create_inventory_locations)"}, {"label": "Archive", "location": "Actions column (delete_inventory_locations)"}]$kb$::jsonb,
  $kb$["view_inventory_locations", "create_inventory_locations", "edit_inventory_locations", "delete_inventory_locations"]$kb$::jsonb,
  $kb${"web": ["Go to Inventory -> Locations (/inventory/locations) and pick the warehouse.", "Click New location, give it a code, a name and its parent (for example Aisle 3 under Zone A), and a barcode to scan it.", "Archive a location once it is empty."], "mobile": ["Locations are set up in the web app."]}$kb$::jsonb
),
(
  'inventory', 'Transfers', '/inventory/transfers', NULL, NULL, 'web',
  'Receipts, deliveries, internal moves and returns, numbered per company (WH/IN/, WH/OUT/, WH/INT/). Nothing moves until a transfer is marked done; then every line moves at once or none does. A receipt line with no location lands in the destination warehouse''s stock location, a delivery leaves from the source warehouse''s, an internal move goes from one to the other. Done transfers are in the ledger and are never edited; open ones can be cancelled or deleted. Scanning a product barcode while creating adds a line; scanning a transfer number on the list opens it.',
  $kb$["create_transfer", "add_transfer_line", "start_transfer", "validate_transfer", "cancel_transfer", "delete_transfer", "export_transfers"]$kb$::jsonb,
  $kb$[{"label": "New transfer", "location": "Top-right of Transfers (create_transfers)"}, {"label": "Start", "location": "Transfer drawer (edit_transfers)"}, {"label": "Mark done", "location": "Transfer drawer (validate_transfers)"}, {"label": "Cancel transfer", "location": "Transfer drawer (cancel_transfers)"}, {"label": "Status tabs", "location": "Above the list: All, Draft, In progress, Done, Cancelled"}]$kb$::jsonb,
  $kb$["view_transfers", "create_transfers", "edit_transfers", "delete_transfers", "validate_transfers", "cancel_transfers", "export_transfers"]$kb$::jsonb,
  $kb${"web": ["Go to Inventory -> Transfers (/inventory/transfers) and click New transfer.", "Choose the type: Receipt (to a warehouse), Delivery (from one), Internal move (both) or a return.", "Add lines: scan or pick each product and enter the quantity; leave the locations empty to use the warehouse's stock location.", "Open the transfer and click Mark done when the goods have arrived or left: the stock moves and the cost layers follow."], "mobile": ["Transfers are made in the web app; use Home -> Stock to check and adjust stock on the phone."]}$kb$::jsonb
),
(
  'inventory', 'Stock movements', '/inventory/movements', NULL, NULL, 'web',
  'The stock ledger: every receipt, delivery, internal move and adjustment that was done, newest first, with the reference, product, from and to, quantity, cost (with view_stock_valuation) and reason. It is never edited, only added to.',
  $kb$["view_stock_movements", "filter_movements_by_warehouse", "filter_movements_by_date"]$kb$::jsonb,
  $kb$[{"label": "Warehouse / From / To", "location": "Filters above the list"}, {"label": "Movement history", "location": "Link on a product's Stock tab"}]$kb$::jsonb,
  $kb$["view_stock"]$kb$::jsonb,
  $kb${"web": ["Go to Inventory -> Stock Movements (/inventory/movements).", "Pick a warehouse and a date range to see what moved and why.", "From a product's Stock tab, Movement history opens this list for that product."], "mobile": ["Stock movements are shown in the web app."]}$kb$::jsonb
),
(
  'products', 'Product stock tab', '/products', NULL, NULL, 'web',
  'With Inventory, a product (not a service, not a product with variants) has a Stock tab: on hand, reserved and free, by warehouse, location and lot, Adjust stock and a link to its movement history. A product still holding stock cannot be archived until the stock is delivered, moved or adjusted out.',
  $kb$["view_product_stock", "adjust_product_stock"]$kb$::jsonb,
  $kb$[{"label": "Stock tab", "location": "Product drawer, next to Packaging (view_stock)"}, {"label": "Adjust stock", "location": "Stock tab (adjust_stock)"}]$kb$::jsonb,
  $kb$["view_products", "view_stock", "adjust_stock"]$kb$::jsonb,
  $kb${"web": ["Open a product from Products and click the Stock tab.", "Click Adjust stock (or Adjust on a line) to add or remove stock with the reason."], "mobile": ["Open Home -> Stock and scan the product to see its stock."]}$kb$::jsonb
)
ON CONFLICT (module_key, feature_name) DO UPDATE SET
  route_path = EXCLUDED.route_path, mobile_screen_name = EXCLUDED.mobile_screen_name, mobile_nav_path = EXCLUDED.mobile_nav_path,
  platform = EXCLUDED.platform, page_purpose = EXCLUDED.page_purpose, available_actions = EXCLUDED.available_actions,
  button_locations = EXCLUDED.button_locations, required_permissions = EXCLUDED.required_permissions,
  step_by_step_instructions = EXCLUDED.step_by_step_instructions, updated_at = CURRENT_TIMESTAMP;
