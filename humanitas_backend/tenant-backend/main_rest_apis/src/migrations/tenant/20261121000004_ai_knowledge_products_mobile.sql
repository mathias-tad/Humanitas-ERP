-- AI knowledge base (AGENTS.md rule 20): mobile Products screens are live, so the mobile steps replace
-- "use the web app". Updates rows written by 20261121000003_ai_knowledge_products.sql.

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'ProductsScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Open the app and tap Products under Quick Actions on Home (shown when your company has Products and you have view_products).", "Search by name, item code, SKU or barcode with the box at the top; use the Active / Archived / All chips and \"Needs e-invoicing fix\" to filter.", "Tap the scan icon (top right) to scan a barcode and open its product; if nothing matches and you have create_products, tap Create product to add it with that barcode.", "Tap New product (bottom right, needs create_products), enter the name and anything else you know, then tap Save.", "Tap a product to see its Details and History; the pencil icon (top right, edit_products) edits it, the box icon archives it (delete_products) or restores it (restore_products).", "Pull down to refresh the list; tap Load more at the bottom for more products."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'All Products';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'ProductCategoriesScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> menu (top right) -> Categories',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Open Products, tap the menu (three dots, top right) and choose Categories.", "Tap New category (bottom right, needs create_product_categories), or the + on a row to add a subcategory under it.", "Enter the name, and optionally a code and the excise %, then tap Create.", "Tap a category (edit_product_categories) to rename it, change its excise % or archive it (delete_product_categories).", "While editing a product you can also create a category from the Category field: type the new name and tap Create \"name\"."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Product Categories';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'UnitsScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> menu (top right) -> Units of measure',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Open Products, tap the menu (three dots, top right) and choose Units of measure.", "Each unit shows its ratio to the reference unit and its MoR unit code, or \"no MoR code\".", "With edit_uoms, tap a unit and choose its MoR code (PCS, KLG, LTR, MTR, ROL) or No MoR code.", "Adding new units and unit kinds is done in the web app (/products/uoms)."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Units of Measure';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'ProductDetailScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> tap a product',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Open Products and turn on the \"Needs e-invoicing fix\" chip.", "Tap a product: the box at the top of Details lists what MoR would reject.", "Tap the pencil (edit_products). In the E-invoicing (MoR) section set the item code, HS code, excise % and invoice description; pick the tax code under Tax.", "If the unit has no MoR code, set it under Products -> menu -> Units of measure.", "Tap Save: the product shows Ready for e-invoicing."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'E-invoicing (MoR) fields on products';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'ProductFormScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> New product or edit -> Category',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["In the product form tap Category and start typing.", "If the category is missing and you have create_product_categories, tap Create \"name\": it is created and selected, and everything else you typed stays in the form.", "Without that permission the sheet says which permission is needed."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'platform' AND feature_name = 'Create or open records without leaving the page';
