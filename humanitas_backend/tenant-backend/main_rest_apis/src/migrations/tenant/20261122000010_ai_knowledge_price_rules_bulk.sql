-- AI knowledge base (rule 20): one price rule for several products at once.
UPDATE ai_knowledge_entries
   SET available_actions = available_actions || $kb$["add_rule_for_several_products"]$kb$::jsonb,
       step_by_step_instructions = jsonb_set(step_by_step_instructions, '{web}',
         (step_by_step_instructions -> 'web') || $kb$["To give several products the same price or discount at once, click Add rule, choose Applies to: Several products, add the products and set the price; one rule is made for each product. For everything choose Every product; for a category and its sub-categories choose A category."]$kb$::jsonb),
       updated_at = CURRENT_TIMESTAMP
 WHERE module_key = 'products' AND feature_name = 'Price Lists'
   AND NOT (available_actions ? 'add_rule_for_several_products');
