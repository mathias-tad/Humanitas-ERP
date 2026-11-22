-- AI knowledge base (AGENTS.md rule 20): the mobile app now shows variants, price list prices,
-- the company/branch switcher and long lists that load as you scroll.
UPDATE ai_knowledge_entries
   SET step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}',
       $kb$["In the app (Home -> Quick Actions -> Products), a product with variants shows how many it has. Open it and use the Variants tab to see each variant with its values, SKU, barcode and price; tap a variant to open it.", "Scan a variant's barcode or search its SKU to open that variant directly. A variant shows which product it belongs to.", "Setting up attributes and the variant matrix, and changing a variant's price extra, is done in the web app on the product's Variants tab."]$kb$::jsonb),
       platform = 'both',
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Product Variants';

UPDATE ai_knowledge_entries
   SET step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}',
       $kb$["Open the product (Home -> Quick Actions -> Products, tap it) and go to the Prices tab (needs view_price_lists).", "Change the quantity to see quantity breaks; each list shows the price, its currency and whether a price list rule or the sales price set it. A product with variants lists each variant.", "To change prices, edit the price list's rules in the web app (Products -> Price Lists)."]$kb$::jsonb),
       mobile_screen_name = 'ProductDetailScreen',
       mobile_nav_path = 'Home -> Quick Actions -> Products -> (product) -> Prices',
       platform = 'both',
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Product Prices';

UPDATE ai_knowledge_entries
   SET step_by_step_instructions = jsonb_set(step_by_step_instructions, '{mobile}',
       $kb$["Price lists are created and edited in the web app (Products -> Price Lists). In the app, a product's Prices tab shows its price on every list at the quantity you enter."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Price Lists';
