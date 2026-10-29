# Pricing and spreadsheet export

The existing calculator cards, input grid and page styles are retained. Additional inputs are Minimum Profit, Target Net Margin, Room for Offers, Mileage and Cost per Mile. Fee and mileage rates are supplied by the user; the workbook's example rates are not treated as current marketplace fees or tax rates.

## Price definitions

- **Fixed costs:** purchase cost + seller-paid shipping + packaging + fixed order fee + ad/boost cost + mileage × rate.
- **Fee rate:** platform fee percentage + payment-processing percentage, expressed as a fraction of item sale price.
- **Min Sale:** `(fixed costs + minimum profit) / (1 − fee rate)`.
- **Target Price:** the greatest of Min Sale, the entered expected sale price, the price needed for target dollar profit, and `fixed costs / (1 − fee rate − target net margin)`.
- **List Price:** `target price / (1 − room for offers)`.
- Price targets round **up** to the next cent. Inputs cannot be negative; fees plus desired net margin must remain below 100%, and offer room below 100%.
- Profit, margin and ROI are shown at the entered expected sale price, or at Target Price if it is blank. A planned sale below Min Sale is flagged. ROI with zero purchase cost is unavailable.
- Percent fees are modeled on item sale price. Other fee bases, negotiated offers, taxes or marketplace fee rules can affect the actual proceeds; enter the effective fees and costs that apply to the item.

The calculator is a planning tool. These values do not claim to be market-supported sold prices or automatic marketplace fee quotes.

## Apply pricing to an item

1. In Create Listing, select **Pricing Calculator** under Price. The current item is preserved as a draft and passed through a same-tab session token.
2. Enter known costs, fees and profit/margin goals; select **Calculate Profit**.
3. Select **Apply Pricing to Listing**. The original title, SKU, notes and other item data return with the calculated List Price and saved pricing plan.
4. Save the listing. Existing saved records keep their status and ID; the handoff itself does not modify published inventory.

The calculator can also be opened independently. Applying its results starts a new listing with the chosen brand/category/condition, rather than guessing which old draft should receive the price. Changing calculator inputs invalidates the old results until recalculated.

## Spreadsheet format

The supplied Reseller Spreadsheet.xlsx was read for context only and is not changed or bundled into the site. No existing workbook rows are imported automatically.

In Inventory Dashboard, expand **Export & Backups** and choose **Reseller Spreadsheet (Overview)**. Existing CSV/JSON controls export that worksheet's field order. **Download Spreadsheet (.xlsx)** exports selected listings, or all listings if none are selected.

The XLSX file contains:

- **Overview:** the same 28 column names and order as the source worksheet, from SKU # through Notes; a title row, frozen headings, filterable table and currency formatting.
- **Pricing Inputs:** the corresponding cost, fee, margin, profit, mileage and offer assumptions, with calculated targets and estimated profit kept separate from recorded sales.

Leading-zero SKUs are stored as text in XLSX. CSV applications may infer numeric SKUs; use the XLSX download when exact leading-zero display matters.

Unknown location, QR, photo and receipt data stays blank. Sold Price, Platform Fee, Total Cost and Profit are not populated with projected sales. Recorded sold prices can drive the worksheet's fee/cost/profit formulas; supplied actual platform fees take precedence. Mileage, packaging and ad costs are included in the cost calculations. Check the actual fee amount when recording a sale.

Pricing assumptions and margins stay in inventory/spreadsheet exports. They are not added to buyer-facing marketplace descriptions or used to switch on Poshmark Smart Sell.
