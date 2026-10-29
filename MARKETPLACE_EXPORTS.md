# Marketplace form exports

Choose **Listing Form → Flyp / Poshmark / eBay** on Create Listing. The copyable fields update to the chosen platform. **Download Form Fields** saves a text worksheet. The dashboard's export selector provides separate platform CSV/JSON worksheets for all or selected items; **Inventory Backup** retains the complete local record format.

These outputs prepare text for manual entry into listing forms. They do not publish listings or claim to be native bulk-upload files. Platform category selection, photos and any account-specific required fields still need completion on the destination site.

## Field handling

- Titles use a shared 80-character limit. Shortened titles are shown in the preview with a notice.
- Descriptions are plain text, including seller notes and entered item attributes. They exclude internal research snippets and comp prices.
- Flyp provides common universal-form fields for manual entry and crosslisting review.
- Poshmark descriptions are limited to 1,500 characters. Exports visibly flag shortened descriptions. Prices are rounded to whole dollars in the platform preview/export, with a notice when different from the source amount; the saved item's original price is unchanged.
- Poshmark style tags use up to three terms of at most 25 characters each. Feature terms, confirmed research terms and material are prioritized. The abundant source Tags field stays unchanged.
- An unknown original retail price stays blank. New condition alone never becomes an NWT claim; NWT is mapped only when `newWithTags` is explicitly true in the record.
- eBay exports retain cents, label SKU as **Custom label (SKU)**, and keep search phrases as reference suggestions rather than inventing an eBay hashtags field.
- Photo-guidance categories are labeled **Category reference**, not passed off as official marketplace category IDs.
- SKUs are preserved, including leading zeros. Destination-specific SKU constraints are flagged instead of silently changing item identifiers.
- Files are worksheets, so blank fields indicate information to complete on the marketplace. Poshmark worksheets use **Draft** availability.

## Native bulk uploads

Use a current template downloaded from the relevant marketplace account. eBay Seller Hub Reports templates vary by action and category. Poshmark requires its own exact, case-sensitive columns and two header rows, plus appropriate taxonomy and required values. A generic CSV must not be uploaded as though it were one of these templates. Flyp's documented workflow uses its Universal Form and reviews missing fields in each destination form; a generic CSV import schema was not established from its public help documentation.

## Sources checked October 25, 2026

- [Flyp Universal Form](https://resellertools.zendesk.com/hc/en-us/articles/4405120549645-Create-items-in-Flyp-s-Universal-form-to-Crosslist)
- [Poshmark template field definitions](https://support.poshmark.com/s/article/Bulk-Upload-Templates?language=en_US)
- [Poshmark header requirements](https://support.poshmark.com/s/article/Bulk-Upload-status-and-errors?language=en_US)
- [eBay Seller Hub Reports](https://www.ebay.com/help/selling/selling-tools/seller-hub?id=4096)
- [eBay SKU maximum length](https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/skus.html)
