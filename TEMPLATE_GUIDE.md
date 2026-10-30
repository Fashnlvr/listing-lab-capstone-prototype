# Item-specific templates

Templates keep their saved wording and replace item tokens as the listing changes. Apply a template from Create Listing; the applied copy is stored with the draft/listing so it also works after reload. Applying another template replaces the generated template block instead of accumulating stale text. Seller-added notes stay in place; a fully rewritten description remains manual.

Use `{{description}}` for the automatic detailed item description and `{{tags}}` for the condensed search/discovery terms. Leave these template fields empty to keep the normal automatic outputs. The Tags field can add seller-approved terms. Legacy `{{keywords}}` tokens resolve to the same essential Tags output.

Supported item fields: `{{itemName}}`, `{{brand}}`, `{{productType}}`, `{{styleModel}}`, `{{color}}`, `{{size}}`, `{{gender}}`, `{{material}}`, `{{keyFeatures}}`, `{{category}}`, `{{condition}}`, `{{price}}`, `{{measurements}}` and `{{flaws}}`. Single-brace legacy tokens continue to work. Unknown token values are never filled with sample data; lines requiring missing facts are skipped.

Example description:

    {{description}}

    Please compare the listed measurements with an item you own.

Example tags:

    {{styleModel}}, {{material}}, {{keyFeatures}}

Shipping notes should contain the seller's actual policy. They may use item tokens, but the app never invents dispatch times, free shipping, tracking, packaging, included accessories or return promises. Shipping text appears in the buyer-facing description; it is not keyword filler.

Structured form values take priority. When those are blank, copy can use explicit product type, material, color, size, department and numbered model details from the Title. Other-item attributes and unconfirmed research suggestions are not copied into the description. Approved research wording remains supported. This does not change title-only sold-comp research.

Sources: [Poshmark description guidance](https://blog.poshmark.com/write-listing-descriptions-to-make-sales/), [eBay item description guidance](https://www.developer.ebay.com/api-docs/user-guides/static/trading-user-guide/item-description.html), [eBay search manipulation policy](https://www.ebay.com/help/selling/listings/creating-managing-listings/best-match?id=4243).

## One essential Tags output

Tags combine useful buyer search phrases, product synonyms and short style, material, fit, pattern and category labels. Output is capped at 18 unique terms, each at most 25 characters. Repetitive title permutations, size phrases and near-duplicate discovery labels are omitted. Individual tag copying and Copy All remain available; marketplace export limits still apply. There is no separate Keywords field or copy card.

Old custom-template keyword content is merged into the Tags editor and applied tag terms. Existing saved records and legacy export schema remain readable. New listing records retain a compatibility keywords property equal to Tags; it is not a separate user-facing output.

Related vocabulary comes from explicit item facts, approved research wording and a curated product/style vocabulary. It is not a measurement of live search volume or proof that a term is trending. Trend labels such as Vintage, Y2K or Boho require explicit item wording or seller-approved research wording. New Balance Numeric footwear can expand to skateboarding queries, based on [New Balance's Numeric skate category](https://www.newbalance.com/numeric-skateboard-shoes/); this mapping is not applied to other New Balance models. Every item is generated independently, without using the previous listing's terms. Sold research queries, matching, links and prices are unchanged.

Descriptions now use an item-specific opening, a separate material/construction paragraph, relevant styling suggestions, condition and fit guidance. Explicit details in the title (such as V-neck, long sleeves, low-top or lace-up) can join seller-entered features. Style/context wording does not become an unsupported construction, performance or authenticity claim. Material, condition, features, dispatch promises and measurements are never invented. The generator preserves seller notes, template shipping policy and fully rewritten descriptions. Sold-comp research is independent of description generation.

The description polish puts construction before outfit suggestions, combines condition and fit into a concise closing paragraph, and adapts fit guidance for footwear, garments and accessories. Named details can be explained in plain language (for example, an adjustable carrying strap or lace-up fastening); generic benefits are not added to items that do not have those features. Brand/model duplication and negative feature wording are handled without changing the keyword/tag generators or research inputs.

## Flyp copy fields

Create Listing includes separate copy cards for Brand, Item SKU / Style Code (the manufacturer's label code), Price, Cost of Goods and Note to Self. The existing inventory SKU remains a separate field. Manufacturer codes are entered under Additional Details and never guessed from a model name. Each tag has its own copy button; Copy All retains the complete comma-separated list, including multiword tags as single tags.

Note to Self includes the internal inventory SKU, manufacturer code, title, known cost, list price, calculator min/target prices and explicit Private Notes. Copying it assigns an inventory SKU if needed, saves the current draft and copies that exact SKU; repeated copies reuse it. Private Notes and COGS are not added to the buyer description, keywords or tags. Flyp form-field worksheets include separate private note/cost columns; these are manual mapping worksheets, not native bulk-upload files. Raw inventory backups retain the new fields, inventory CSV includes manufacturerSku/privateNotes, and the reseller spreadsheet uses explicit Private Notes when present.

Cost of Goods supports zero, persists with the item and shares calculator COGS on pricing handoff. An unknown cost stays blank. Private copy cards remain separate from the buyer-facing Description.

## Built-in core templates

General Resale plus 12 category templates are always supplied by the application: Shoes & Boots; Handbags & Bags; Tops & Sweaters; Pants & Jeans; Shorts; Skirts; Dresses & Jumpsuits; Jackets, Coats & Blazers; Activewear & Swimwear; Jewelry & Watches; Accessories; and Other / Miscellaneous. They use the live `{{description}}` and `{{tags}}` outputs, category-specific measurement guidance, and a neutral checkout/shipping reminder. They do not promise handling times, free shipping, measurements or undisclosed condition details.

Core records live in application code, not browser storage. They cannot be overwritten or deleted. In Create Listing they appear under Built-in Templates; Save Copy creates a custom editable version. In the Templates library, View opens a read-only core record and Duplicate makes an editable copy. New Template and all existing custom editing/deletion continue to work. Only custom records are written to the existing template storage key.

Core category templates apply only to a matching category (or populate an empty category). General Resale works across categories. Previews use category-appropriate sample items; those examples are never inserted into actual listings. Applying a template remains an explicit choice and does not replace private notes or rewrite manually customized listing copy unless you apply it.
