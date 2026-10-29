/* Browser-only XLSX export: no credentials, server or edits to the source workbook. */
function buildResellerWorkbook(listings) {
  const xml = (value) => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const col = (index) => {
    let name = "";
    for (let number = index + 1; number; number = Math.floor((number - 1) / 26)) name = String.fromCharCode(65 + (number - 1) % 26) + name;
    return name;
  };
  const cell = (ref, value, style = 0, formula = "") => {
    if (formula) return `<c r="${ref}" s="${style}"${value === "" ? ' t="str"' : ""}><f>${xml(formula)}</f><v>${xml(value)}</v></c>`;
    if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${Number(value.toFixed(8))}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  };
  const rowXml = (number, values, styles = []) => `<row r="${number}"${number === 1 ? ' ht="30" customHeight="1"' : number === 2 ? ' ht="36" customHeight="1"' : ""}>${values.map((value, index) => cell(col(index) + number, value, styles[index] || 0)).join("")}</row>`;
  const inputHeaders = ["SKU #", "Purchase Price", "Shipping Cost", "Packaging", "Ad Cost", "Platform Fee %", "Payment Fee %",
    "Combined Fee %", "Fixed Fee", "Mileage", "Cost per Mile", "Minimum Profit", "Target Profit", "Target Net Margin %",
    "Offer Room %", "Expected Sale Price", "Calculated List Price", "Min Sale", "Target Price", "Estimated Net Profit",
    "Estimated Net Margin %", "Fixed Costs Total"];
  const headerStyles = (values) => values.map(() => 2);
  const overviewRows = [rowXml(1, ["Reseller Spreadsheet"], [1]), rowXml(2, RESELLER_OVERVIEW_HEADERS, headerStyles(RESELLER_OVERVIEW_HEADERS))];
  const pricingRows = [rowXml(1, ["Pricing Inputs — estimates, not recorded sales"], [1]), rowXml(2, inputHeaders, headerStyles(inputHeaders))];
  listings.forEach((listing, index) => {
    const number = index + 3;
    const row = resellerSpreadsheetRow(listing);
    const plan = listing.pricingPlan;
    const inputs = plan?.inputs || {};
    const values = RESELLER_OVERVIEW_HEADERS.map((header) => row[header]);
    const cells = values.map((value, column) => {
      const ref = col(column) + number;
      const money = (column >= 13 && column <= 17) || column === 20 || column === 21 || (column >= 23 && column <= 25);
      let formula = "";
      if (column === 23 && plan) formula = `W${number}*'Pricing Inputs'!K${number}`;
      if (column === 21 && plan && listing.platformFee == null) formula = `IF(ISNUMBER(R${number}),R${number}*'Pricing Inputs'!H${number}+'Pricing Inputs'!I${number},"")`;
      if (column === 24) formula = `IF(ISNUMBER(R${number}),SUM(N${number},U${number},V${number},X${number})${plan ? `+'Pricing Inputs'!D${number}+'Pricing Inputs'!E${number}` : ""},"")`;
      if (column === 25) formula = `IF(ISNUMBER(R${number}),R${number}-Y${number},"")`;
      return cell(ref, value, money ? 3 : 0, formula);
    });
    overviewRows.push(`<row r="${number}">${cells.join("")}</row>`);
    const pricingValues = [row["SKU #"], inputs.cogs ?? "", inputs.shipping ?? "", inputs.packaging ?? "", inputs.adCost ?? "",
      inputs.platformFeePct !== undefined ? inputs.platformFeePct / 100 : "", inputs.paymentFeePct !== undefined ? inputs.paymentFeePct / 100 : "",
      plan?.feeRate ?? "", inputs.fixedFee ?? "", inputs.mileage ?? "", inputs.mileageRate ?? "", inputs.minimumProfit ?? "", inputs.targetProfit ?? "",
      inputs.targetMarginPct !== undefined ? inputs.targetMarginPct / 100 : "", inputs.offerRoomPct !== undefined ? inputs.offerRoomPct / 100 : "",
      inputs.salePrice ?? "", plan?.listPrice ?? "", plan?.minSale ?? "", plan?.targetPrice ?? "", plan?.netProfit ?? "",
      plan?.marginPct !== undefined && plan.marginPct !== null ? plan.marginPct / 100 : "", plan?.totalFixedCosts ?? ""];
    pricingRows.push(rowXml(number, pricingValues, pricingValues.map((_, column) => [5, 6, 7, 13, 14, 20].includes(column) ? 4 : [0, 9].includes(column) ? 0 : 3)));
  });
  const lastRow = Math.max(3, listings.length + 2);
  const worksheet = (rows, lastColumn, table = false) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="2" topLeftCell="B3" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
    <sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="28" width="18" customWidth="1"/>
    ${table ? '<col min="7" max="7" width="60" customWidth="1"/><col min="28" max="28" width="65" customWidth="1"/>' : ""}</cols>
    <sheetData>${rows.join("")}</sheetData><autoFilter ref="A2:${lastColumn}${lastRow}"/><mergeCells count="1"><mergeCell ref="A1:${lastColumn}1"/></mergeCells>
    ${table ? '<tableParts count="1"><tablePart r:id="rId1"/></tableParts>' : ""}</worksheet>`;
  const files = {
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Overview" sheetId="1" r:id="rId1"/><sheet name="Pricing Inputs" sheetId="2" r:id="rId2"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2D071D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": worksheet(overviewRows, "AB", true),
    "xl/worksheets/sheet2.xml": worksheet(pricingRows, "V"),
    "xl/worksheets/_rels/sheet1.xml.rels": `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>`,
    "xl/tables/table1.xml": `<?xml version="1.0"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="InventoryOverview" displayName="InventoryOverview" ref="A2:AB${lastRow}" totalsRowShown="0"><autoFilter ref="A2:AB${lastRow}"/><tableColumns count="28">${RESELLER_OVERVIEW_HEADERS.map((header, index) => `<tableColumn id="${index + 1}" name="${xml(header)}"/>`).join("")}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`,
  };
  return zipSpreadsheetFiles(files);
}

function zipSpreadsheetFiles(files) {
  const encoder = new TextEncoder();
  const crcTable = Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  const checksum = (bytes) => {
    let crc = 0xffffffff;
    bytes.forEach((value) => { crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8); });
    return (crc ^ 0xffffffff) >>> 0;
  };
  const parts = [];
  const directory = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const fileName = encoder.encode(name);
    const bytes = encoder.encode(content);
    const crc = checksum(bytes);
    const local = new Uint8Array(30 + fileName.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint16(12, 0x21, true);
    view.setUint32(14, crc, true); view.setUint32(18, bytes.length, true); view.setUint32(22, bytes.length, true);
    view.setUint16(26, fileName.length, true); local.set(fileName, 30);
    const central = new Uint8Array(46 + fileName.length);
    const entry = new DataView(central.buffer);
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x800, true);
    entry.setUint16(14, 0x21, true);
    entry.setUint32(16, crc, true); entry.setUint32(20, bytes.length, true); entry.setUint32(24, bytes.length, true);
    entry.setUint16(28, fileName.length, true); entry.setUint32(42, offset, true); central.set(fileName, 46);
    parts.push(local, bytes); directory.push(central); offset += local.length + bytes.length;
  });
  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, directory.length, true); view.setUint16(10, directory.length, true);
  view.setUint32(12, directorySize, true); view.setUint32(16, offset, true);
  const all = new Uint8Array(offset + directorySize + end.length);
  let position = 0;
  [...parts, ...directory, end].forEach((part) => { all.set(part, position); position += part.length; });
  return all;
}

function exportResellerSpreadsheet(listings) {
  const url = URL.createObjectURL(new Blob([buildResellerWorkbook(listings)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "listing-lab-reseller-spreadsheet.xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
