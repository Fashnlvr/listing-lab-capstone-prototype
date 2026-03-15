const STORAGE_KEYS = {
  listings: "listingLab:listings:v2",
  draft: "listingLab:draft:v2",
  uspsUserId: "listingLab:uspsUserId:v1",
  templates: "listingLab:templates:v1",
};

const LISTING_STATUSES = ["draft", "ready", "listed", "sold"];

const APP_CONFIG = window.APP_CONFIG || {};
const EBAY_APP_ID = APP_CONFIG.EBAY_APP_ID || "";
const ENABLE_LIVE_EBAY_COMPS = Boolean(APP_CONFIG.ENABLE_LIVE_EBAY_COMPS);
const ENABLE_DEMO_EBAY_COMPS = APP_CONFIG.ENABLE_DEMO_EBAY_COMPS !== false;

const BASE_RANGES = {
  tops: [12, 28],
  bottoms: [18, 45],
  dresses: [22, 60],
  shoes: [25, 80],
  bags: [30, 120],
  outerwear: [28, 90],
  default: [15, 40],
};

const CONDITION_MULT = {
  new: 1.25,
  "like-new": 1.1,
  good: 1.0,
  fair: 0.75,
};

const PREMIUM_BRANDS = new Set([
  "coach",
  "marc jacobs",
  "kate spade",
  "calpak",
  "spanx",
  "ray-ban",
  "diff eyewear",
  "levis",
  "levi's",
  "abercrombie",
]);

function $(selector) {
  return document.querySelector(selector);
}

function pageHas(selector) {
  return Boolean($(selector));
}

function syncFilledState(field) {
  if (!field) return;
  const value = typeof field.value === "string" ? field.value.trim() : "";
  field.classList.toggle("is-filled", value !== "");
}

function initFilledFieldStates() {
  document.querySelectorAll(".form-control, .form-select").forEach((field) => {
    syncFilledState(field);
    field.addEventListener("input", () => syncFilledState(field));
    field.addEventListener("change", () => syncFilledState(field));
  });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function safeJsonParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function getListings() {
  const raw = safeStorageGet(STORAGE_KEYS.listings);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveListings(listings) {
  safeStorageSet(STORAGE_KEYS.listings, JSON.stringify(listings));
}

function addListing(listing) {
  const listings = getListings();
  listings.unshift(listing);
  saveListings(listings);
}

function removeListing(id) {
  const listings = getListings().filter((listing) => listing.id !== id);
  saveListings(listings);
}

function updateListing(id, updates) {
  const listings = getListings();
  const idx = listings.findIndex((listing) => listing.id === id);
  if (idx === -1) return false;
  listings[idx] = { ...listings[idx], ...updates };
  saveListings(listings);
  return true;
}

function getListingById(id) {
  return getListings().find((listing) => listing.id === id);
}

function getTemplates() {
  const raw = safeStorageGet(STORAGE_KEYS.templates);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveTemplates(templates) {
  safeStorageSet(STORAGE_KEYS.templates, JSON.stringify(templates));
}

function upsertTemplate(template) {
  const templates = getTemplates();
  const idx = templates.findIndex((item) => item.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates.unshift(template);
  }
  saveTemplates(templates);
}

function removeTemplate(id) {
  const templates = getTemplates().filter((template) => template.id !== id);
  saveTemplates(templates);
}

function getTemplateById(id) {
  return getTemplates().find((template) => template.id === id);
}

function saveDraft(draft) {
  safeStorageSet(STORAGE_KEYS.draft, JSON.stringify(draft));
}

function loadDraft() {
  const raw = safeStorageGet(STORAGE_KEYS.draft);
  if (!raw) return null;
  return safeJsonParse(raw, null);
}

function clearDraft() {
  safeStorageRemove(STORAGE_KEYS.draft);
}

function saveUspsUserId(userId) {
  safeStorageSet(STORAGE_KEYS.uspsUserId, userId || "");
}

function getUspsUserId() {
  return safeStorageGet(STORAGE_KEYS.uspsUserId) || "";
}

async function fetchTextWithProxy(url) {
  const direct = await fetch(url);
  if (direct.ok) return direct.text();

  const proxied = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
  if (!proxied.ok) throw new Error("request_failed");
  return proxied.text();
}

async function fetchJsonWithProxy(url) {
  const text = await fetchTextWithProxy(url);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid_json");
  }
}

async function searchEbaySoldListings(query, appId) {
  if (!appId) throw new Error("missing_ebay_app_id");

  const endpoint = new URL("https://svcs.ebay.com/services/search/FindingService/v1");
  endpoint.searchParams.set("OPERATION-NAME", "findCompletedItems");
  endpoint.searchParams.set("SERVICE-VERSION", "1.13.0");
  endpoint.searchParams.set("SECURITY-APPNAME", appId);
  endpoint.searchParams.set("RESPONSE-DATA-FORMAT", "JSON");
  endpoint.searchParams.set("REST-PAYLOAD", "true");
  endpoint.searchParams.set("keywords", query);
  endpoint.searchParams.set("itemFilter(0).name", "SoldItemsOnly");
  endpoint.searchParams.set("itemFilter(0).value", "true");
  endpoint.searchParams.set("paginationInput.entriesPerPage", "10");

  const data = await fetchJsonWithProxy(endpoint.toString());
  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];

  return items
    .map((item) => {
      const rawPrice = Number(item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__);
      const shipping = Number(item?.shippingInfo?.[0]?.shippingServiceCost?.[0]?.__value__);
      const total = (Number.isFinite(rawPrice) ? rawPrice : 0) + (Number.isFinite(shipping) ? shipping : 0);

      return {
        title: item?.title?.[0] || "",
        url: item?.viewItemURL?.[0] || "",
        price: Number.isFinite(total) && total > 0 ? Number(total.toFixed(2)) : null,
      };
    })
    .filter((item) => item.title && Number.isFinite(item.price));
}

function buildDemoCompData(state) {
  const [low, high] = state.category && state.condition
    ? getSuggestedRange(state.category, state.condition, state.brand)
    : BASE_RANGES.default;

  const center = Number(((low + high) / 2).toFixed(2));
  const titleBase = [state.brand, state.itemName].filter(Boolean).join(" ").trim() || "Comparable item";
  const offsets = [-0.15, -0.08, 0, 0.06, 0.12];

  return offsets.map((offset, idx) => {
    const price = Number((center * (1 + offset)).toFixed(2));
    return {
      title: `${titleBase} - Demo comp ${idx + 1}`,
      url: "#",
      price,
    };
  });
}

function computeCompSummary(comps) {
  const prices = comps.map((comp) => comp.price).filter((price) => Number.isFinite(price)).sort((a, b) => a - b);
  if (!prices.length) return null;

  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
  const avg = prices.reduce((acc, value) => acc + value, 0) / prices.length;

  return {
    count: prices.length,
    min: prices[0],
    max: prices[prices.length - 1],
    average: Number(avg.toFixed(2)),
    median: Number(median.toFixed(2)),
  };
}

function extractCompKeywords(titles) {
  const stopwords = new Set([
    "the", "and", "for", "with", "from", "size", "new", "used", "womens", "women", "mens", "men", "lot", "pair",
  ]);

  const counts = new Map();
  titles.forEach((title) => {
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopwords.has(word))
      .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

async function fetchUspsRates({ userId, originZip, destinationZip, pounds, ounces }) {
  if (!userId) throw new Error("missing_usps_user_id");

  const xml = `<RateV4Request USERID="${escapeHtml(userId)}"><Revision>2</Revision><Package ID="1ST"><Service>ALL</Service><ZipOrigination>${escapeHtml(originZip)}</ZipOrigination><ZipDestination>${escapeHtml(destinationZip)}</ZipDestination><Pounds>${escapeHtml(String(pounds))}</Pounds><Ounces>${escapeHtml(String(ounces))}</Ounces><Container /><Size>REGULAR</Size><Machinable>true</Machinable></Package></RateV4Request>`;
  const endpoint = `https://secure.shippingapis.com/ShippingAPI.dll?API=RateV4&XML=${encodeURIComponent(xml)}`;

  const raw = await fetchTextWithProxy(endpoint);
  const doc = new DOMParser().parseFromString(raw, "text/xml");
  const err = doc.querySelector("Error Description");
  if (err) throw new Error(err.textContent?.trim() || "usps_error");

  const entries = [...doc.querySelectorAll("Postage")].map((postage) => {
    const service = postage.querySelector("MailService")?.textContent?.replace(/\s+/g, " ").trim() || "USPS Service";
    const rate = Number(postage.querySelector("Rate")?.textContent);
    return { service, rate };
  }).filter((entry) => Number.isFinite(entry.rate));

  return entries.sort((a, b) => a.rate - b.rate);
}

function prettyCategory(value) {
  const map = {
    tops: "Tops",
    bottoms: "Bottoms",
    dresses: "Dresses",
    shoes: "Shoes",
    bags: "Bags",
    outerwear: "Outerwear",
  };
  return map[value] || value || "No category";
}

function prettyCondition(value) {
  const map = {
    new: "New",
    "like-new": "Like New",
    good: "Good",
    fair: "Fair",
  };
  return map[value] || value || "No condition";
}

function normalizeStatus(value) {
  const clean = normalize(value);
  return LISTING_STATUSES.includes(clean) ? clean : "draft";
}

function prettyStatus(value) {
  const map = {
    draft: "Draft",
    ready: "Ready",
    listed: "Listed",
    sold: "Sold",
  };
  return map[normalizeStatus(value)] || "Draft";
}

function getSuggestedRange(category, condition, brand) {
  const base = BASE_RANGES[category] || BASE_RANGES.default;
  const mult = CONDITION_MULT[condition] || 1;

  let low = Math.round(base[0] * mult);
  let high = Math.round(base[1] * mult);

  if (PREMIUM_BRANDS.has(normalize(brand))) {
    low = Math.round(low * 1.15);
    high = Math.round(high * 1.15);
  }

  if (high < low) {
    const temp = low;
    low = high;
    high = temp;
  }

  return [low, high];
}

function isPriceValid(price, suggestedRange) {
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, msg: "Enter a valid price." };
  }
  if (!suggestedRange) return { ok: true, msg: "" };

  const [low, high] = suggestedRange;
  if (price < low) return { ok: true, msg: "(below range; likely to sell faster)" };
  if (price > high) return { ok: true, msg: "(above range; may take longer)" };
  return { ok: true, msg: "(in suggested range)" };
}

function clampTitle(text, limit) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  if (clean.length <= limit) return clean;
  return clean.slice(0, Math.max(0, limit - 1)).trimEnd();
}

function getMarketplaceMap(listing) {
  const titleBase = [listing.brand, listing.itemName].filter(Boolean).join(" ").trim() || listing.itemName || "Untitled item";
  const description = String(listing.notes || "").trim();
  const keywords = String(listing.keywords || "").trim();
  const hashtags = String(listing.hashtags || "").trim();
  const category = prettyCategory(listing.category);
  const condition = prettyCondition(listing.condition);
  const priceValue = Number(listing.price);
  const price = Number.isFinite(priceValue) && priceValue > 0 ? priceValue.toFixed(2) : "";

  return {
    ebay: {
      title: clampTitle(titleBase, 80),
      category,
      condition,
      brand: listing.brand || "",
      format: "Fixed Price",
      quantity: "1",
      price,
      description,
      keywords,
      hashtags,
    },
    poshmark: {
      title: clampTitle(titleBase, 50),
      category,
      condition,
      brand: listing.brand || "",
      size: "Add size in platform",
      listingPrice: price,
      originalPrice: "Add original retail price if known",
      description,
      keywords,
      hashtags,
    },
    flyp: {
      title: clampTitle(titleBase, 80),
      category,
      condition,
      brand: listing.brand || "",
      listingPrice: price,
      description,
      keywords,
      hashtags,
    },
  };
}

function buildExportSummary(listing) {
  const lines = [];

  if (listing.itemName) lines.push(`Title: ${listing.itemName}`);
  if (listing.brand) lines.push(`Brand: ${listing.brand}`);
  lines.push(`Category: ${prettyCategory(listing.category)}`);
  lines.push(`Condition: ${prettyCondition(listing.condition)}`);
  lines.push(`Status: ${prettyStatus(listing.status)}`);

  const price = Number(listing.price);
  if (Number.isFinite(price) && price > 0) {
    lines.push(`Price: $${price.toFixed(2)}`);
  }

  if (listing.notes) {
    lines.push("");
    lines.push(`Description: ${listing.notes}`);
  }
  if (listing.keywords) {
    lines.push(`Keywords: ${listing.keywords}`);
  }
  if (listing.hashtags) {
    lines.push(`Hashtags: ${listing.hashtags}`);
  }

  lines.push("");
  lines.push("Prepared in Listing Lab");
  return lines.join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function exportCSV(listings) {
  if (!Array.isArray(listings) || !listings.length) return;

  const headers = [
    "itemName", "brand", "category", "condition", "status", "price", "notes", "keywords", "hashtags", "createdAt",
    "ebay_title", "ebay_category", "ebay_condition", "ebay_price", "ebay_description", "ebay_keywords", "ebay_hashtags",
    "poshmark_title", "poshmark_category", "poshmark_condition", "poshmark_price", "poshmark_description", "poshmark_keywords", "poshmark_hashtags",
    "flyp_title", "flyp_category", "flyp_condition", "flyp_price", "flyp_description", "flyp_keywords", "flyp_hashtags",
  ];
  const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rowForListing = (listing) => {
    const map = getMarketplaceMap(listing);
    const merged = {
      ...listing,
      ebay_title: map.ebay.title,
      ebay_category: map.ebay.category,
      ebay_condition: map.ebay.condition,
      ebay_price: map.ebay.price,
      ebay_description: map.ebay.description,
      ebay_keywords: map.ebay.keywords,
      ebay_hashtags: map.ebay.hashtags,
      poshmark_title: map.poshmark.title,
      poshmark_category: map.poshmark.category,
      poshmark_condition: map.poshmark.condition,
      poshmark_price: map.poshmark.listingPrice,
      poshmark_description: map.poshmark.description,
      poshmark_keywords: map.poshmark.keywords,
      poshmark_hashtags: map.poshmark.hashtags,
      flyp_title: map.flyp.title,
      flyp_category: map.flyp.category,
      flyp_condition: map.flyp.condition,
      flyp_price: map.flyp.listingPrice,
      flyp_description: map.flyp.description,
      flyp_keywords: map.flyp.keywords,
      flyp_hashtags: map.flyp.hashtags,
    };
    return headers.map((header) => escapeCsv(merged[header])).join(",");
  };

  const rows = [headers.map(escapeCsv).join(","), ...listings.map(rowForListing)];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "listing-lab-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(listings) {
  if (!Array.isArray(listings) || !listings.length) return;
  const blob = new Blob([JSON.stringify(listings, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "listing-lab-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function initNewListingPage() {
  if (!pageHas("#listingForm")) return;

  const form = $("#listingForm");
  const fields = {
    itemName: $("#itemName"),
    brand: $("#brand"),
    category: $("#category"),
    condition: $("#condition"),
    price: $("#price"),
    notes: $("#notes"),
    keywords: $("#keywords"),
    hashtags: $("#hashtags"),
  };

  const nodes = {
    formError: $("#formError"),
    formStatus: $("#formStatus"),
    completenessText: $("#completenessText"),
    completenessBar: $("#completenessBar"),
    suggestedRange: $("#suggestedRange"),
    priceCheck: $("#priceCheck"),
    exportPreview: $("#exportPreview"),
    listingPhotoPlaceholders: [
      $("#listingPhotoPlaceholder1"),
      $("#listingPhotoPlaceholder2"),
      $("#listingPhotoPlaceholder3"),
    ].filter(Boolean),
    listingCardTitle: $("#listingCardTitle"),
    listingCardMeta: $("#listingCardMeta"),
    listingCardPrice: $("#listingCardPrice"),
    listingCardNotes: $("#listingCardNotes"),
    runCompSearchBtn: $("#runCompSearchBtn"),
    applyCompPriceBtn: $("#applyCompPriceBtn"),
    compStatus: $("#compStatus"),
    compSummary: $("#compSummary"),
    compResults: $("#compResults"),
    applyFormulaPriceBtn: $("#applyFormulaPriceBtn"),
    formulaStatus: $("#formulaStatus"),
    formulaSummary: $("#formulaSummary"),
    generateDescriptionBtn: $("#generateDescriptionBtn"),
    generateKeywordsBtn: $("#generateKeywordsBtn"),
    generateHashtagsBtn: $("#generateHashtagsBtn"),
    templateSelect: $("#templateSelect"),
    templateName: $("#templateName"),
    templateTitlePattern: $("#templateTitlePattern"),
    templateDescription: $("#templateDescription"),
    templateKeywords: $("#templateKeywords"),
    templateShippingNotes: $("#templateShippingNotes"),
    templateStatus: $("#templateStatus"),
    saveTemplateBtn: $("#saveTemplateBtn"),
    applyTemplateBtn: $("#applyTemplateBtn"),
    deleteTemplateBtn: $("#deleteTemplateBtn"),
  };

  let latestCompMedian = null;

  function setError(message) {
    nodes.formError.textContent = message || "";
    if (message) nodes.formStatus.textContent = "";
  }

  function setStatus(message) {
    nodes.formStatus.textContent = message || "";
    if (message) nodes.formError.textContent = "";
  }

  function getFormState() {
    const price = Number(fields.price.value);
    return {
      itemName: fields.itemName.value.trim(),
      brand: fields.brand.value.trim(),
      category: fields.category.value,
      condition: fields.condition.value,
      price: Number.isFinite(price) ? price : NaN,
      notes: fields.notes.value.trim(),
      keywords: fields.keywords.value.trim(),
      hashtags: fields.hashtags?.value.trim() || "",
      status: "draft",
    };
  }

  function setFormState(state) {
    fields.itemName.value = state.itemName || "";
    fields.brand.value = state.brand || "";
    fields.category.value = state.category || "";
    fields.condition.value = state.condition || "";
    fields.price.value = Number.isFinite(state.price) ? String(state.price) : "";
    fields.notes.value = state.notes || "";
    fields.keywords.value = state.keywords || "";
    if (fields.hashtags) fields.hashtags.value = state.hashtags || "";
  }

  function generateKeywordsFromState(state) {
    const chunks = [
      state.brand,
      state.itemName,
      state.category ? prettyCategory(state.category) : "",
      state.condition ? prettyCondition(state.condition) : "",
    ]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);

    const seen = new Set();
    const ordered = chunks.filter((word) => {
      if (seen.has(word)) return false;
      seen.add(word);
      return true;
    });
    return ordered.slice(0, 10);
  }

  function buildHashtags(state) {
    const source = [
      state.brand,
      state.category ? prettyCategory(state.category) : "",
      state.condition ? prettyCondition(state.condition) : "",
      state.keywords,
    ]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);

    const unique = [];
    const seen = new Set();
    source.forEach((word) => {
      if (seen.has(word)) return;
      seen.add(word);
      unique.push(`#${word}`);
    });
    return unique.slice(0, 8).join(" ");
  }

  function buildGeneratedDescription(state) {
    const lines = [];
    const item = state.itemName || "Item";
    lines.push(`${item} by ${state.brand || "unbranded"} in ${prettyCondition(state.condition)} condition.`);
    if (state.category) lines.push(`Category: ${prettyCategory(state.category)}.`);
    lines.push("Includes key details in photos and notes.");
    lines.push("Ships quickly with tracking.");
    return lines.join(" ");
  }

  function fillTemplateEditor(template) {
    if (!nodes.templateName) return;
    nodes.templateName.value = template?.name || "";
    nodes.templateTitlePattern.value = template?.titlePattern || "";
    nodes.templateDescription.value = template?.description || "";
    nodes.templateKeywords.value = template?.keywords || "";
    nodes.templateShippingNotes.value = template?.shippingNotes || "";
  }

  function renderTemplateOptions(selectedId = "") {
    if (!nodes.templateSelect) return;
    const templates = getTemplates();
    nodes.templateSelect.innerHTML = '<option value="">Choose template</option>';
    templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name || "Untitled Template";
      nodes.templateSelect.appendChild(option);
    });
    nodes.templateSelect.value = selectedId || "";
  }

  function applyTemplateToForm(template) {
    if (!template) return;
    const current = getFormState();

    const replacements = {
      "{itemName}": current.itemName || "",
      "{brand}": current.brand || "",
      "{category}": prettyCategory(current.category),
      "{condition}": prettyCondition(current.condition),
    };

    const titlePattern = String(template.titlePattern || "");
    const title = Object.entries(replacements).reduce((acc, [token, value]) => acc.replaceAll(token, value), titlePattern).trim();

    if (title) fields.itemName.value = title;
    if (template.category) fields.category.value = template.category;
    if (template.condition) fields.condition.value = template.condition;
    if (template.keywords) fields.keywords.value = template.keywords;

    const descriptionParts = [template.description, template.shippingNotes]
      .map((part) => String(part || "").trim())
      .filter(Boolean);
    if (descriptionParts.length) fields.notes.value = descriptionParts.join("\n\n");

    updatePreview();
  }

  function updateCompleteness(state) {
    let score = 0;
    if (state.itemName) score += 1;
    if (state.brand) score += 1;
    if (state.category) score += 1;
    if (state.condition) score += 1;
    if (Number.isFinite(state.price) && state.price > 0) score += 1;
    nodes.completenessText.textContent = `${score}/5`;
    const pct = Math.round((score / 5) * 100);
    if (nodes.completenessBar) {
      const visiblePct = pct === 0 ? 4 : pct;
      nodes.completenessBar.style.width = `${visiblePct}%`;
      nodes.completenessBar.textContent = `${pct}%`;
    }
  }

  function updatePreview() {
    const state = getFormState();
    updateCompleteness(state);

    let suggestedRange = null;
    if (state.category && state.condition) {
      suggestedRange = getSuggestedRange(state.category, state.condition, state.brand);
      nodes.suggestedRange.textContent = `$${suggestedRange[0]} - $${suggestedRange[1]}`;
    } else {
      nodes.suggestedRange.textContent = "-";
    }

    const priceCheck = isPriceValid(state.price, suggestedRange);
    nodes.priceCheck.textContent = priceCheck.msg;

    const title = state.itemName || "Untitled item";
    const brand = state.brand || "No brand";
    const category = prettyCategory(state.category);
    const condition = prettyCondition(state.condition);
    const price = Number.isFinite(state.price) && state.price > 0 ? `$${state.price.toFixed(2)}` : "$0.00";

    nodes.listingCardTitle.textContent = title;
    nodes.listingCardMeta.textContent = `${brand} | ${category} | ${condition}`;
    nodes.listingCardPrice.textContent = price;
    nodes.listingCardNotes.textContent = state.notes || "Description preview will appear here.";
    nodes.listingPhotoPlaceholders.forEach((placeholderNode, idx) => {
      placeholderNode.setAttribute("aria-label", `Listing preview ${idx + 1} for ${title}`);
    });

    if (fields.hashtags) {
      fields.hashtags.value = buildHashtags(state);
      state.hashtags = fields.hashtags.value;
    }

    nodes.exportPreview.textContent = buildExportSummary(state);

  }

  function buildCompQuery(state) {
    return [state.brand, state.itemName, state.category ? prettyCategory(state.category) : ""]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function renderCompResults(comps) {
    nodes.compResults.innerHTML = "";
    comps.slice(0, 6).forEach((comp) => {
      const a = document.createElement("a");
      a.className = "btn btn-outline-secondary text-start";
      a.href = comp.url || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.innerHTML = `<strong>${escapeHtml(comp.title)}</strong><br><small>$${comp.price.toFixed(2)}</small>`;
      nodes.compResults.appendChild(a);
    });
  }

  function applyFormulaPricing() {
    const state = getFormState();
    if (!(state.category && state.condition)) {
      nodes.formulaStatus.textContent = "Choose category and condition to generate a formula-based price.";
      nodes.formulaSummary.textContent = "";
      return;
    }

    const [low, high] = getSuggestedRange(state.category, state.condition, state.brand);
    const suggested = Number(((low + high) / 2).toFixed(2));
    fields.price.value = suggested.toFixed(2);
    nodes.formulaSummary.textContent = `Range: $${low}-$${high} | Suggested: $${suggested.toFixed(2)}.`;
    nodes.formulaStatus.textContent = `Applied formula price: $${suggested.toFixed(2)}.`;

    if (!fields.keywords.value.trim()) {
      fields.keywords.value = [state.brand, state.itemName, prettyCategory(state.category)]
        .filter(Boolean)
        .join(", ");
    }
    updatePreview();
  }

  nodes.applyFormulaPriceBtn.addEventListener("click", applyFormulaPricing);

  if (nodes.runCompSearchBtn) {
    nodes.runCompSearchBtn.addEventListener("click", async () => {
      const state = getFormState();
      const query = buildCompQuery(state);
      nodes.compResults.innerHTML = "";
      nodes.compSummary.textContent = "";
      latestCompMedian = null;

      if (!query) {
        nodes.compStatus.textContent = "Add at least item name or brand before searching eBay comps.";
        return;
      }

      let comps = [];

      if (ENABLE_LIVE_EBAY_COMPS && EBAY_APP_ID) {
        nodes.compStatus.textContent = "Searching eBay sold comps...";
        try {
          comps = await searchEbaySoldListings(query, EBAY_APP_ID);
        } catch {
          comps = [];
        }
      }

      if (!comps.length && ENABLE_DEMO_EBAY_COMPS) {
        comps = buildDemoCompData(state);
        nodes.compStatus.textContent = "Live eBay comps are temporarily unavailable. Showing comparable estimates.";
      } else if (!comps.length) {
        nodes.compStatus.textContent = "Live eBay comps are currently unavailable.";
        return;
      } else {
        nodes.compStatus.textContent = "eBay comps loaded.";
      }

      const summary = computeCompSummary(comps);
      if (!summary) {
        nodes.compStatus.textContent = "No usable prices returned. Use formula pricing.";
        return;
      }

      latestCompMedian = summary.median;
      nodes.compSummary.textContent =
        `Comps: ${summary.count} | Min $${summary.min.toFixed(2)} | Median $${summary.median.toFixed(2)} | Avg $${summary.average.toFixed(2)} | Max $${summary.max.toFixed(2)}.`;
      renderCompResults(comps);

      const keywords = extractCompKeywords(comps.map((comp) => comp.title));
      if (keywords.length && !fields.keywords.value.trim()) {
        fields.keywords.value = keywords.join(", ");
      }
      updatePreview();
    });
  }

  if (nodes.applyCompPriceBtn) {
    nodes.applyCompPriceBtn.addEventListener("click", () => {
      if (!Number.isFinite(latestCompMedian) || latestCompMedian <= 0) {
        nodes.compStatus.textContent = "No comp price yet. Run eBay comps search first.";
        return;
      }

      fields.price.value = latestCompMedian.toFixed(2);
      nodes.compStatus.textContent = `Applied eBay comp median: $${latestCompMedian.toFixed(2)}.`;
      updatePreview();
    });
  }

  $("#saveDraftBtn").addEventListener("click", () => {
    saveDraft(getFormState());
    setStatus("Draft saved.");
  });

  $("#loadDraftBtn").addEventListener("click", () => {
    const draft = loadDraft();
    if (!draft) {
      setError("No draft found.");
      return;
    }
    setFormState(draft);
    updatePreview();
    setStatus("Draft loaded.");
  });

  $("#clearDraftBtn").addEventListener("click", () => {
    clearDraft();
    setStatus("Draft cleared.");
  });

  $("#copyBtn").addEventListener("click", async () => {
    const ok = await copyText(nodes.exportPreview.textContent || "");
    setStatus(ok ? "Summary copied." : "Copy failed. Select and copy manually.");
  });

  if (nodes.generateDescriptionBtn) {
    nodes.generateDescriptionBtn.addEventListener("click", () => {
      const state = getFormState();
      fields.notes.value = buildGeneratedDescription(state);
      setStatus("Description generated.");
      updatePreview();
    });
  }

  if (nodes.generateKeywordsBtn) {
    nodes.generateKeywordsBtn.addEventListener("click", () => {
      const state = getFormState();
      const words = generateKeywordsFromState(state);
      if (!words.length) {
        setError("Add item details first to generate keywords.");
        return;
      }
      fields.keywords.value = words.join(", ");
      setStatus("Keywords generated.");
      updatePreview();
    });
  }

  if (nodes.generateHashtagsBtn) {
    nodes.generateHashtagsBtn.addEventListener("click", () => {
      const state = getFormState();
      const tags = buildHashtags(state);
      if (!tags) {
        setError("Add item details first to generate hashtags.");
        return;
      }
      fields.hashtags.value = tags;
      setStatus("Hashtags generated.");
      updatePreview();
    });
  }

  if (nodes.templateSelect) {
    nodes.templateSelect.addEventListener("change", () => {
      fillTemplateEditor(getTemplateById(nodes.templateSelect.value));
    });
  }

  if (nodes.saveTemplateBtn) {
    nodes.saveTemplateBtn.addEventListener("click", () => {
      const name = nodes.templateName.value.trim();
      if (!name) {
        nodes.templateStatus.textContent = "Template name is required.";
        return;
      }

      const selectedId = nodes.templateSelect.value;
      const template = {
        id: selectedId || uid(),
        name,
        titlePattern: nodes.templateTitlePattern.value.trim(),
        description: nodes.templateDescription.value.trim(),
        keywords: nodes.templateKeywords.value.trim(),
        shippingNotes: nodes.templateShippingNotes.value.trim(),
        category: fields.category.value,
        condition: fields.condition.value,
        updatedAt: new Date().toISOString(),
      };

      upsertTemplate(template);
      renderTemplateOptions(template.id);
      nodes.templateStatus.textContent = "Template saved.";
    });
  }

  if (nodes.applyTemplateBtn) {
    nodes.applyTemplateBtn.addEventListener("click", () => {
      const template = getTemplateById(nodes.templateSelect.value);
      if (!template) {
        nodes.templateStatus.textContent = "Select a template to apply.";
        return;
      }
      applyTemplateToForm(template);
      nodes.templateStatus.textContent = "Template applied.";
    });
  }

  if (nodes.deleteTemplateBtn) {
    nodes.deleteTemplateBtn.addEventListener("click", () => {
      const selectedId = nodes.templateSelect.value;
      if (!selectedId) {
        nodes.templateStatus.textContent = "Select a template to delete.";
        return;
      }
      removeTemplate(selectedId);
      renderTemplateOptions();
      fillTemplateEditor(null);
      nodes.templateStatus.textContent = "Template deleted.";
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    const state = getFormState();
    if (!state.itemName) {
      setError("Item name is required.");
      return;
    }
    if (!state.brand) {
      setError("Brand is required.");
      return;
    }
    if (!state.category) {
      setError("Category is required.");
      return;
    }
    if (!state.condition) {
      setError("Condition is required.");
      return;
    }
    if (!Number.isFinite(state.price) || state.price <= 0) {
      setError("Price must be a valid number greater than zero.");
      return;
    }

    addListing({
      id: uid(),
      ...state,
      status: normalizeStatus(state.status),
      createdAt: new Date().toISOString(),
    });

    saveDraft(state);
    window.location.href = "dashboard.html";
  });

  Object.values(fields).forEach((field) => {
    if (!field) return;
    field.addEventListener("input", updatePreview);
    field.addEventListener("change", updatePreview);
  });

  renderTemplateOptions();
  updatePreview();
}

function initTemplatesPage() {
  if (!pageHas("#buildShippingTemplateBtn")) return;

  const userIdEl = $("#uspsUserId");
  const originEl = $("#shipOriginZip");
  const destEl = $("#shipDestZip");
  const weightEl = $("#shipWeightOz");
  const statusEl = $("#shippingTemplateStatus");
  const summaryEl = $("#shippingRateSummary");
  const previewEl = $("#shippingTemplatePreview");

  userIdEl.value = getUspsUserId();

  $("#saveUspsUserIdBtn").addEventListener("click", () => {
    const userId = userIdEl.value.trim();
    saveUspsUserId(userId);
    statusEl.textContent = userId ? "USPS User ID saved locally." : "USPS User ID cleared.";
  });

  $("#buildShippingTemplateBtn").addEventListener("click", async () => {
    const userId = userIdEl.value.trim() || getUspsUserId();
    const origin = originEl.value.trim();
    const destination = destEl.value.trim();
    const totalOz = Number(weightEl.value);

    previewEl.textContent = "";
    summaryEl.textContent = "";

    if (!userId) {
      statusEl.textContent = "Enter USPS User ID first.";
      return;
    }
    if (!/^\d{5}$/.test(origin) || !/^\d{5}$/.test(destination)) {
      statusEl.textContent = "Origin and destination must be 5-digit ZIP codes.";
      return;
    }
    if (!Number.isFinite(totalOz) || totalOz <= 0) {
      statusEl.textContent = "Enter a valid package weight in ounces.";
      return;
    }

    const pounds = Math.floor(totalOz / 16);
    const ounces = Math.round(totalOz % 16);

    statusEl.textContent = "Fetching USPS rates...";
    try {
      const rates = await fetchUspsRates({
        userId,
        originZip: origin,
        destinationZip: destination,
        pounds,
        ounces,
      });

      if (!rates.length) {
        statusEl.textContent = "No USPS rates returned. Try different values.";
        return;
      }

      const best = rates[0];
      summaryEl.textContent = `Lowest USPS option: ${best.service} at $${best.rate.toFixed(2)}.`;

      previewEl.textContent = [
        `Shipping: Ships from ${origin} to ${destination} via ${best.service}.`,
        `Estimated USPS postage: $${best.rate.toFixed(2)} (package weight: ${totalOz} oz).`,
        "I ship quickly with tracking included.",
      ].join("\n");

      statusEl.textContent = "Shipping template generated.";
    } catch {
      statusEl.textContent = "USPS rate lookup failed right now. Try again later.";
    }
  });

  $("#copyShippingTemplateBtn").addEventListener("click", async () => {
    const ok = await copyText(previewEl.textContent || "");
    statusEl.textContent = ok ? "Shipping template copied." : "Copy failed. Select and copy manually.";
  });
}

function initAboutPage() {
  if (!pageHas("#aboutListingCount")) return;

  const listings = getListings();
  const draft = loadDraft();
  const latest = listings[0];

  $("#aboutListingCount").textContent = String(listings.length);
  $("#aboutDraftStatus").textContent = draft ? "Draft saved" : "No draft saved";
  $("#aboutLastSaved").textContent = latest?.createdAt ? formatDate(latest.createdAt) : "No listings yet";
}

function initFeaturesPage() {
  if (!pageHas("#featureStatusList")) return;

  const items = [
    { label: "5 essential required inputs in Create Listing", ok: true },
    { label: "Formula pricing helper available", ok: typeof getSuggestedRange === "function" },
    { label: "eBay comps capability enabled", ok: ENABLE_LIVE_EBAY_COMPS || ENABLE_DEMO_EBAY_COMPS },
    { label: "USPS smart templates page available", ok: true },
    { label: "LocalStorage draft/listing persistence", ok: typeof localStorage !== "undefined" },
    { label: "Dashboard CSV export", ok: typeof exportCSV === "function" },
  ];

  const list = $("#featureStatusList");
  list.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "border rounded p-2 d-flex justify-content-between align-items-center";
    row.innerHTML = `<span>${escapeHtml(item.label)}</span><span class="${item.ok ? "text-success" : "text-danger"} fw-semibold">${item.ok ? "Active" : "Unavailable"}</span>`;
    list.appendChild(row);
  });
}

function initHowItWorksPage() {
  if (!pageHas("#howDraftSummary")) return;

  function renderDraft() {
    const draft = loadDraft();
    if (!draft) {
      $("#howDraftSummary").textContent = "No draft available.";
      return;
    }

    const essentials = [
      draft.itemName ? "Item Name" : null,
      draft.brand ? "Brand" : null,
      draft.category ? "Category" : null,
      draft.condition ? "Condition" : null,
      Number.isFinite(Number(draft.price)) && Number(draft.price) > 0 ? "Price" : null,
    ].filter(Boolean);

    $("#howDraftSummary").textContent =
      `Current draft includes ${essentials.length}/5 essentials: ${essentials.join(", ") || "none"}.`;
  }

  renderDraft();
  const refreshBtn = $("#refreshHowDraftBtn");
  if (refreshBtn) refreshBtn.addEventListener("click", renderDraft);
}

function initPricingPage() {
  if (!pageHas("#pricingEstimateBtn")) return;

  $("#pricingEstimateBtn").addEventListener("click", () => {
    const brand = ($("#pricingBrand")?.value || "").trim();
    const category = $("#pricingCategory")?.value || "";
    const condition = $("#pricingCondition")?.value || "";

    if (!category || !condition) {
      $("#pricingEstimateStatus").textContent = "Choose category and condition to estimate range.";
      $("#pricingEstimateRange").textContent = "";
      $("#pricingEstimateSuggested").textContent = "";
      return;
    }

    const [low, high] = getSuggestedRange(category, condition, brand);
    const suggested = Number(((low + high) / 2).toFixed(2));
    $("#pricingEstimateStatus").textContent = "Estimate ready.";
    $("#pricingEstimateRange").textContent = `Range: $${low} - $${high}`;
    $("#pricingEstimateSuggested").textContent = `Suggested list price: $${suggested.toFixed(2)}`;
  });

  const toNum = (id) => Number($(id)?.value || 0);
  const fmtMoney = (v) => `$${Number(v || 0).toFixed(2)}`;
  const fmtPct = (v) => `${Number(v || 0).toFixed(2)}%`;

  const calcBtn = $("#calcProfitBtn");
  if (!calcBtn) return;

  calcBtn.addEventListener("click", () => {
    const salePrice = toNum("#calcSalePrice");
    const cogs = toNum("#calcCogs");
    const shipping = toNum("#calcShippingCost");
    const packaging = toNum("#calcPackagingCost");
    const platformPct = toNum("#calcPlatformFeePct") / 100;
    const paymentPct = toNum("#calcPaymentFeePct") / 100;
    const fixedFee = toNum("#calcFixedFee");
    const adCost = toNum("#calcAdCost");
    const targetProfit = toNum("#calcTargetProfit");

    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      $("#calcStatus").textContent = "Enter a valid planned sale price to calculate profit.";
      return;
    }

    const variablePct = platformPct + paymentPct;
    const totalFixedCosts = cogs + shipping + packaging + fixedFee + adCost;
    const pctFees = salePrice * variablePct;
    const netProfit = salePrice - pctFees - totalFixedCosts;
    const marginPct = salePrice > 0 ? (netProfit / salePrice) * 100 : 0;
    const roiPct = cogs > 0 ? (netProfit / cogs) * 100 : 0;

    const breakEvenDenominator = 1 - variablePct;
    const breakEven = breakEvenDenominator > 0
      ? totalFixedCosts / breakEvenDenominator
      : NaN;

    const targetPrice = breakEvenDenominator > 0
      ? (totalFixedCosts + targetProfit) / breakEvenDenominator
      : NaN;

    $("#calcNetProfit").textContent = fmtMoney(netProfit);
    $("#calcMargin").textContent = fmtPct(marginPct);
    $("#calcRoi").textContent = Number.isFinite(roiPct) ? fmtPct(roiPct) : "n/a";
    $("#calcBreakEven").textContent = Number.isFinite(breakEven) ? fmtMoney(breakEven) : "n/a";
    $("#calcTargetPrice").textContent = Number.isFinite(targetPrice) ? fmtMoney(targetPrice) : "n/a";

    if (netProfit > 0) {
      $("#calcStatus").textContent = "Profit calculation complete.";
    } else if (netProfit === 0) {
      $("#calcStatus").textContent = "You are currently at break-even.";
    } else {
      $("#calcStatus").textContent = "Current inputs produce a loss. Adjust price or costs.";
    }
  });
}

function initIntegrationsPage() {
  if (!pageHas("#integrationChecklist")) return;

  const checklist = $("#integrationChecklist");
  const uspsSaved = Boolean(getUspsUserId());

  const rows = [
    { label: "eBay live mode", value: ENABLE_LIVE_EBAY_COMPS ? "Enabled" : "Disabled" },
    { label: "eBay fallback comps mode", value: ENABLE_DEMO_EBAY_COMPS ? "Enabled" : "Disabled" },
    { label: "USPS User ID stored locally", value: uspsSaved ? "Yes" : "No" },
  ];

  checklist.innerHTML = "";
  rows.forEach((row) => {
    const el = document.createElement("div");
    el.className = "border rounded p-2 d-flex justify-content-between align-items-center";
    el.innerHTML = `<span>${escapeHtml(row.label)}</span><span class="fw-semibold">${escapeHtml(row.value)}</span>`;
    checklist.appendChild(el);
  });

  const status = $("#integrationCheckStatus");
  const btn = $("#runIntegrationCheckBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    status.textContent = "Running basic integration checks...";
    try {
      // Lightweight availability check endpoint
      await fetch("https://api.allorigins.win/get?url=https://www.ebay.com", { method: "GET" });
      status.textContent = "Check complete. Browser can reach proxy endpoint; API behavior depends on credentials and provider limits.";
    } catch {
      status.textContent = "Check failed. Network or CORS restrictions may prevent live API behavior.";
    }
  });
}

function initDashboardPage() {
  if (!pageHas("#listingsTableBody")) return;

  const tbody = $("#listingsTableBody");
  const emptyState = $("#emptyState");
  const dashboardStatus = $("#dashboardStatus");
  const statusFilter = $("#statusFilter");
  const selectAll = $("#selectAllListings");

  function getSelectedListingIds() {
    return [...tbody.querySelectorAll("input[data-select-id]:checked")].map((el) => el.getAttribute("data-select-id"));
  }

  function getFilteredListings() {
    const listings = getListings();
    const filter = normalizeStatus(statusFilter?.value === "all" ? "" : statusFilter?.value);
    if (!statusFilter || statusFilter.value === "all") return listings;
    return listings.filter((listing) => normalizeStatus(listing.status) === filter);
  }

  function render() {
    const listings = getFilteredListings();
    tbody.innerHTML = "";
    if (selectAll) selectAll.checked = false;

    if (!listings.length) {
      emptyState.textContent = statusFilter?.value && statusFilter.value !== "all"
        ? "No listings match this status filter."
        : "No listings saved yet. Create one to get started.";
      return;
    }

    emptyState.textContent = "";

    listings.forEach((listing) => {
      const statusValue = normalizeStatus(listing.status);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input class="form-check-input" type="checkbox" data-select-id="${escapeHtml(listing.id)}" aria-label="Select listing ${escapeHtml(listing.itemName || "Untitled")}" /></td>
        <td><a href="listing.html?id=${encodeURIComponent(listing.id)}">${escapeHtml(listing.itemName || "Untitled")}</a></td>
        <td>${escapeHtml(listing.brand || "")}</td>
        <td>${escapeHtml(prettyCategory(listing.category))}</td>
        <td>${escapeHtml(prettyCondition(listing.condition))}</td>
        <td>
          <select class="form-select form-select-sm" data-status-id="${escapeHtml(listing.id)}">
            <option value="draft" ${statusValue === "draft" ? "selected" : ""}>Draft</option>
            <option value="ready" ${statusValue === "ready" ? "selected" : ""}>Ready</option>
            <option value="listed" ${statusValue === "listed" ? "selected" : ""}>Listed</option>
            <option value="sold" ${statusValue === "sold" ? "selected" : ""}>Sold</option>
          </select>
        </td>
        <td>$${Number(listing.price || 0).toFixed(2)}</td>
        <td>${escapeHtml(formatDate(listing.createdAt))}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-del="${escapeHtml(listing.id)}" type="button">Delete</button></td>
      `;

      tr.querySelector("[data-status-id]").addEventListener("change", (event) => {
        const nextStatus = normalizeStatus(event.target.value);
        updateListing(listing.id, { status: nextStatus });
        dashboardStatus.textContent = `Status updated to ${prettyStatus(nextStatus)}.`;
        render();
      });

      tr.querySelector("[data-del]").addEventListener("click", () => {
        if (!window.confirm(`Delete \"${listing.itemName || "this listing"}\"?`)) return;
        removeListing(listing.id);
        dashboardStatus.textContent = "Listing deleted.";
        render();
      });

      tbody.appendChild(tr);
    });
  }

  $("#exportBtn").addEventListener("click", () => {
    const listings = getFilteredListings();
    if (!listings.length) {
      dashboardStatus.textContent = "No listings to export.";
      return;
    }
    exportCSV(listings);
    dashboardStatus.textContent = "CSV export started.";
  });

  const exportJsonBtn = $("#exportJsonBtn");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      const listings = getFilteredListings();
      if (!listings.length) {
        dashboardStatus.textContent = "No listings to export.";
        return;
      }
      exportJSON(listings);
      dashboardStatus.textContent = "JSON export started.";
    });
  }

  const exportSelectedBtn = $("#exportSelectedBtn");
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener("click", () => {
      const selectedIds = new Set(getSelectedListingIds());
      const selected = getFilteredListings().filter((listing) => selectedIds.has(listing.id));
      if (!selected.length) {
        dashboardStatus.textContent = "Select at least one listing to export.";
        return;
      }
      exportCSV(selected);
      dashboardStatus.textContent = "Selected CSV export started.";
    });
  }

  const exportSelectedJsonBtn = $("#exportSelectedJsonBtn");
  if (exportSelectedJsonBtn) {
    exportSelectedJsonBtn.addEventListener("click", () => {
      const selectedIds = new Set(getSelectedListingIds());
      const selected = getFilteredListings().filter((listing) => selectedIds.has(listing.id));
      if (!selected.length) {
        dashboardStatus.textContent = "Select at least one listing to export.";
        return;
      }
      exportJSON(selected);
      dashboardStatus.textContent = "Selected JSON export started.";
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", render);
  }

  if (selectAll) {
    selectAll.addEventListener("change", () => {
      const checked = Boolean(selectAll.checked);
      tbody.querySelectorAll("input[data-select-id]").forEach((checkbox) => {
        checkbox.checked = checked;
      });
    });
  }

  render();
}

function initListingDetailPage() {
  if (!pageHas("#detailExport")) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const titleEl = $("#listingTitle");
  const metaEl = $("#listingMeta");
  const exportEl = $("#detailExport");
  const msgEl = $("#detailMsg");

  if (!id) {
    titleEl.textContent = "Listing not found";
    metaEl.textContent = "Missing listing id.";
    exportEl.textContent = "";
    return;
  }

  const listing = getListingById(id);
  if (!listing) {
    titleEl.textContent = "Listing not found";
    metaEl.textContent = "It may have been deleted.";
    exportEl.textContent = "";
    return;
  }

  titleEl.textContent = listing.itemName || "Listing";
  metaEl.textContent = `${listing.brand || "No brand"} | ${prettyCategory(listing.category)} | ${prettyCondition(listing.condition)} | ${prettyStatus(listing.status)} | $${Number(listing.price || 0).toFixed(2)} | ${formatDate(listing.createdAt)}`;
  exportEl.textContent = buildExportSummary(listing);

  $("#detailCopyBtn").addEventListener("click", async () => {
    const ok = await copyText(exportEl.textContent || "");
    msgEl.textContent = ok ? "Copied." : "Copy failed. Select and copy manually.";
  });

  $("#detailDeleteBtn").addEventListener("click", () => {
    if (!window.confirm(`Delete \"${listing.itemName || "this listing"}\"?`)) return;
    removeListing(listing.id);
    window.location.href = "dashboard.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (window.bootstrap?.Tooltip) {
    document.querySelectorAll("[data-bs-toggle='tooltip']").forEach((el) => {
      new window.bootstrap.Tooltip(el);
    });
  }
  initFilledFieldStates();
  initNewListingPage();
  initAboutPage();
  initFeaturesPage();
  initHowItWorksPage();
  initPricingPage();
  initIntegrationsPage();
  initTemplatesPage();
  initDashboardPage();
  initListingDetailPage();
});
