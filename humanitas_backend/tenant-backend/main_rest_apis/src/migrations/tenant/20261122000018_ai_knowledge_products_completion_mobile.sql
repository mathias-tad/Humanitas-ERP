-- AI knowledge base (AGENTS.md rules 20, 24.27): the app now shows product pictures (and takes them),
-- packaging, kit and combo contents, order quantities and the catalog report. Updates rows written by
-- 20261122000017_ai_knowledge_products_completion.sql.

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'CatalogReportScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> menu (top right) -> Catalog report',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Open Products, tap the menu (three dots, top right) and choose Catalog report (needs view_product_reports).", "See products, variants, kits and combos, how complete the catalog is and the average margin.", "Gaps to fix shows how many products have no barcode, no price, no cost, no category or no picture, are below cost or not ready for e-invoicing; fix them from Product Reports in the web app.", "Lowest margins lists the products earning least; pull down to refresh."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Product Reports';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'ProductDetailScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> a product -> Photos',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Open a product and go to the Photos tab.", "Tap Take photo to use the camera or From gallery (needs edit_products); the first picture becomes the product picture in lists, POS and labels.", "Tap a picture to see it full screen, set it as the main picture (star) or remove it (bin).", "Attachments are listed under the pictures; tap one to copy its link. Attachments are added in the web app."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Product Pictures and Attachments';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'ProductFormScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> a product -> edit (pencil)',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Open a product: the Details tab shows the base and sales units, the minimum order, Sold in multiples of, and the Packaging section (each package, its quantity and GTIN).", "Tap the pencil (edit_products) to change the base, purchase and sales units, the minimum order and Sold in multiples of, then tap Save.", "Scanning a case or box GTIN with the scan icon opens the product and shows the package and its quantity.", "Packaging levels and GTINs are added in the web app (Packaging tab)."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Packaging and GS1 Barcodes';

UPDATE ai_knowledge_entries
   SET mobile_screen_name = 'ProductDetailScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> a kit or combo',
       platform = 'both',
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Kits and combos show Kit or Combo in the product list.", "Open one: the Details tab shows the kit contents with the components' total against the kit price, or the combo's groups (Pick 1, Up to 2) with default choices and extra prices.", "Kits and combos are set up in the web app (the product's Kit / Combo tab)."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Kits and Combos';

UPDATE ai_knowledge_entries
   SET step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}', $kb$["Customers are put on price lists in the web app (Products -> Price Lists -> a list -> Customers on this list).", "In the app a product's Prices tab shows its price on every list; Sales and POS use the customer's list when the customer is chosen."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Customer Price Lists';
