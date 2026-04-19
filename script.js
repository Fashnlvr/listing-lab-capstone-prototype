const STORAGE_KEYS = {
  listings: "listingLab:listings:v2",
  draft: "listingLab:draft:v2",
  uspsUserId: "listingLab:uspsUserId:v1",
  templates: "listingLab:templates:v1",
  smartTemplates: "listingLab:smartTemplates:v1",
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

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
  const now = new Date().toISOString();
  listings.unshift({
    ...listing,
    status: normalizeStatus(listing.status),
    createdAt: listing.createdAt || now,
    updatedAt: listing.updatedAt || listing.createdAt || now,
  });
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
  listings[idx] = {
    ...listings[idx],
    ...updates,
    status: updates.status ? normalizeStatus(updates.status) : normalizeStatus(listings[idx].status),
    updatedAt: updates.updatedAt || new Date().toISOString(),
  };
  saveListings(listings);
  return true;
}

function getListingById(id) {
  return getListings().find((listing) => listing.id === id);
}

function getListingSku(listing) {
  const brand = normalize(listing?.brand).replace(/[^a-z0-9]/g, "").slice(0, 3).toUpperCase() || "LL";
  const category = normalize(listing?.category).replace(/[^a-z0-9]/g, "").slice(0, 3).toUpperCase() || "GEN";
  const idPart = String(listing?.id || "").replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "0000";
  return `${brand}-${category}-${idPart}`;
}

function duplicateListing(id) {
  const listing = getListingById(id);
  if (!listing) return null;
  const now = new Date().toISOString();
  const duplicate = {
    ...listing,
    id: uid(),
    itemName: `${listing.itemName || "Untitled item"} Copy`,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  addListing(duplicate);
  return duplicate;
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

function getSmartTemplates() {
  const raw = safeStorageGet(STORAGE_KEYS.smartTemplates);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveSmartTemplates(templates) {
  safeStorageSet(STORAGE_KEYS.smartTemplates, JSON.stringify(templates));
}

function upsertSmartTemplate(template) {
  const templates = getSmartTemplates();
  const idx = templates.findIndex((item) => item.id === template.id);
  if (idx >= 0) {
    templates[idx] = template;
  } else {
    templates.unshift(template);
  }
  saveSmartTemplates(templates);
}

function removeSmartTemplate(id) {
  const templates = getSmartTemplates().filter((template) => template.id !== id);
  saveSmartTemplates(templates);
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

function estimateUspsRates({ originZip, destinationZip, pounds, ounces, packageProfile }) {
  const profileConfig = getShippingProfileConfig(packageProfile);
  const normalized = normalizeShipmentWeightForEstimate(pounds, ounces);
  const totalOunces = (normalized.pounds * 16) + normalized.ounces + profileConfig.extraOunces;
  const originPrefix = Number(String(originZip || "").slice(0, 3));
  const destinationPrefix = Number(String(destinationZip || "").slice(0, 3));
  const zoneDistance = Number.isFinite(originPrefix) && Number.isFinite(destinationPrefix)
    ? Math.abs(originPrefix - destinationPrefix)
    : 0;

  let zoneMultiplier = 1;
  if (zoneDistance >= 600) zoneMultiplier = 1.26;
  else if (zoneDistance >= 300) zoneMultiplier = 1.14;
  else if (zoneDistance >= 120) zoneMultiplier = 1.07;

  const roundedWeight = Math.max(4, Math.ceil(totalOunces));

  const ground = Number((estimateRate(4.95, roundedWeight, 0.17, zoneMultiplier) * profileConfig.multipliers.ground).toFixed(2));
  const priority = Number((estimateRate(8.4, roundedWeight, 0.22, zoneMultiplier) * profileConfig.multipliers.priority).toFixed(2));
  const priorityPadded = Number((estimateRate(9.15, roundedWeight, 0.18, zoneMultiplier) * profileConfig.multipliers.padded).toFixed(2));
  const express = Number((estimateRate(28.5, roundedWeight, 0.35, zoneMultiplier) * profileConfig.multipliers.express).toFixed(2));

  return [
    { service: "USPS Ground Advantage", rate: ground, source: "Local estimate" },
    { service: "USPS Priority Mail", rate: priority, source: "Local estimate" },
    { service: "USPS Priority Mail Flat Rate / Padded", rate: priorityPadded, source: "Local estimate" },
    { service: "USPS Priority Mail Express", rate: express, source: "Local estimate" },
  ].sort((a, b) => a.rate - b.rate);
}

function normalizeShipmentWeightForEstimate(pounds, ounces) {
  const totalOunces = Math.max(0, (Number.isFinite(pounds) ? pounds * 16 : 0) + (Number.isFinite(ounces) ? ounces : 0));
  const normalizedPounds = Math.floor(totalOunces / 16);
  const normalizedOunces = Number((totalOunces - (normalizedPounds * 16)).toFixed(1));
  return { pounds: normalizedPounds, ounces: normalizedOunces };
}

function estimateRate(base, ounces, perOunce, zoneMultiplier) {
  return Number((base + (Math.max(0, ounces - 4) * perOunce * zoneMultiplier)).toFixed(2));
}

const SHIPPING_PROFILE_CONFIG = {
  "lightweight-apparel": {
    label: "Lightweight apparel",
    extraOunces: 2,
    multipliers: { ground: 1, priority: 0.98, padded: 0.97, express: 1 },
  },
  shoes: {
    label: "Shoes",
    extraOunces: 6,
    multipliers: { ground: 1.08, priority: 1.04, padded: 1.02, express: 1.03 },
  },
  handbag: {
    label: "Handbag",
    extraOunces: 8,
    multipliers: { ground: 1.12, priority: 1.08, padded: 1.05, express: 1.03 },
  },
  bulky: {
    label: "Bulky item",
    extraOunces: 14,
    multipliers: { ground: 1.18, priority: 1.14, padded: 1.1, express: 1.06 },
  },
};

function getShippingProfileConfig(profileKey) {
  return SHIPPING_PROFILE_CONFIG[profileKey] || SHIPPING_PROFILE_CONFIG["lightweight-apparel"];
}

function getRecommendedMarketplaceRate(rates, shippingSpeed) {
  if (!rates.length) return null;
  const preferredService = {
    "next-business-day": "USPS Priority Mail Express",
    "two-business-days": "USPS Priority Mail",
    "three-business-days": "USPS Ground Advantage",
  }[shippingSpeed] || "USPS Ground Advantage";

  return rates.find((rate) => rate.service === preferredService) || rates[0];
}

function getSuggestedBuyerCharge(rate) {
  if (!Number.isFinite(rate)) return null;
  const buffered = rate + 0.75;
  return Number((Math.ceil(buffered * 2) / 2).toFixed(2));
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
    ready: "Ready to List",
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
    completenessBarTrack: $("#completenessBarTrack"),
    completenessBar: $("#completenessBar"),
    suggestedRange: $("#suggestedRange"),
    priceCheck: $("#priceCheck"),
    exportPreview: $("#exportPreview"),
    exportTitle: $("#exportTitle"),
    exportPrice: $("#exportPrice"),
    exportDescription: $("#exportDescription"),
    exportSellerNotes: $("#exportSellerNotes"),
    exportHashtags: $("#exportHashtags"),
    listingPhotoPlaceholders: [
      $("#listingPhotoPlaceholder1"),
      $("#listingPhotoPlaceholder2"),
      $("#listingPhotoPlaceholder3"),
    ].filter(Boolean),
    listingCardTitle: $("#listingCardTitle"),
    listingSnapshotBrand: $("#listingSnapshotBrand"),
    listingSnapshotCategory: $("#listingSnapshotCategory"),
    listingSnapshotStatus: $("#listingSnapshotStatus"),
    listingCardPrice: $("#listingCardPrice"),
    listingSnapshotRange: $("#listingSnapshotRange"),
    listingSnapshotPriceCheck: $("#listingSnapshotPriceCheck"),
    listingCardCondition: $("#listingCardCondition"),
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
    if (nodes.completenessBarTrack) {
      nodes.completenessBarTrack.setAttribute("aria-valuenow", String(pct));
      nodes.completenessBarTrack.setAttribute("aria-valuetext", `${score} of 5 required fields complete`);
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
    const condition = prettyCondition(state.condition);
    const price = Number.isFinite(state.price) && state.price > 0 ? `$${state.price.toFixed(2)}` : "$0.00";
    const rangeText = suggestedRange ? `$${suggestedRange[0]} - $${suggestedRange[1]}` : "Add category + condition";
    const priceCheckText = priceCheck.msg || "Waiting for price";
    const conditionText = state.condition
      ? `${condition} condition${state.brand ? ` for this ${state.brand} item.` : "."}`
      : "No condition selected yet.";
    const descriptionText = state.notes || "Add notes for flaws, measurements, materials, and shipping details.";
    const sellerNotesText = [
      state.brand ? `Brand: ${state.brand}` : "",
      state.category ? `Category: ${prettyCategory(state.category)}` : "",
      `Condition: ${condition}`,
      `Range: ${rangeText}`,
      `Price Check: ${priceCheckText}`,
    ].filter(Boolean).join("\n");
    const hashtagsText = state.hashtags || "Generate hashtags from the form details.";

    if (nodes.listingCardTitle) nodes.listingCardTitle.textContent = title;
    if (nodes.listingCardPrice) nodes.listingCardPrice.textContent = price;
    if (nodes.listingSnapshotRange) nodes.listingSnapshotRange.textContent = rangeText;
    if (nodes.listingSnapshotPriceCheck) nodes.listingSnapshotPriceCheck.textContent = priceCheckText;
    if (nodes.listingCardCondition) nodes.listingCardCondition.textContent = conditionText;
    if (nodes.listingCardNotes) nodes.listingCardNotes.textContent = descriptionText;
    nodes.listingPhotoPlaceholders.forEach((placeholderNode, idx) => {
      placeholderNode.setAttribute("aria-label", `Listing preview ${idx + 1} for ${title}`);
    });

    if (fields.hashtags) {
      fields.hashtags.value = buildHashtags(state);
      state.hashtags = fields.hashtags.value;
    }

    nodes.exportPreview.textContent = buildExportSummary(state);
    if (nodes.exportTitle) nodes.exportTitle.textContent = title;
    if (nodes.exportPrice) nodes.exportPrice.textContent = price;
    if (nodes.exportDescription) nodes.exportDescription.textContent = descriptionText;
    if (nodes.exportSellerNotes) nodes.exportSellerNotes.textContent = sellerNotesText;
    if (nodes.exportHashtags) nodes.exportHashtags.textContent = hashtagsText;

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

  const activeDraft = loadDraft();
  let currentEditingId = activeDraft?.__editingId || "";
  if (currentEditingId && activeDraft) {
    setFormState(activeDraft);
    updatePreview();
    const submitBtn = nodes.form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = "Update Listing";
    nodes.formStatus.textContent = "Editing saved listing from inventory.";
  }

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
    const draftState = getFormState();
    saveDraft(currentEditingId ? { ...draftState, __editingId: currentEditingId } : draftState);
    setStatus("Draft saved.");
  });

  $("#loadDraftBtn").addEventListener("click", () => {
    const draft = loadDraft();
    if (!draft) {
      setError("No draft found.");
      return;
    }
    currentEditingId = draft.__editingId || "";
    setFormState(draft);
    updatePreview();
    setStatus("Draft loaded.");
  });

  $("#clearDraftBtn").addEventListener("click", () => {
    clearDraft();
    currentEditingId = "";
    setStatus("Draft cleared.");
  });

  $("#copyBtn").addEventListener("click", async () => {
    const ok = await copyText(nodes.exportPreview.textContent || "");
    setStatus(ok ? "Summary copied." : "Copy failed. Select and copy manually.");
  });

  document.querySelectorAll(".export-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = button.getAttribute("data-copy-target");
      const target = targetId ? document.getElementById(targetId) : null;
      const ok = await copyText(target?.textContent || "");
      const label = button.closest(".export-copy-card")?.querySelector(".preview-section-label")?.textContent || "Section";
      setStatus(ok ? `${label} copied.` : "Copy failed. Select and copy manually.");
    });
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

    if (currentEditingId) {
      const existingListing = getListingById(currentEditingId);
      updateListing(currentEditingId, {
        ...state,
        status: normalizeStatus(existingListing?.status || state.status),
      });
      saveDraft(state);
    } else {
      addListing({
        id: uid(),
        ...state,
        status: normalizeStatus(state.status),
        createdAt: new Date().toISOString(),
      });
      saveDraft(state);
    }
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
  if (!pageHas("#templatesWorkspace")) return;

  const fields = {
    originZip: $("#shipOriginZip"),
    destinationZip: $("#shipDestZip"),
    pounds: $("#shipWeightPounds"),
    ounces: $("#shipWeightOz"),
    packageProfile: $("#shipPackageProfile"),
    shippingSpeed: $("#templateShippingSpeed"),
    handlingTime: $("#templateHandlingTime"),
    packagingStyle: $("#templatePackagingStyle"),
    disclosureStyle: $("#templateDisclosureStyle"),
    combinedShipping: $("#templateCombinedShipping"),
    thankYouTone: $("#templateThankYouTone"),
  };

  const outputs = {
    shipping: $("#shippingTemplatePreview"),
    condition: $("#templateConditionOutput"),
    bundle: $("#templateBundleOutput"),
    thanks: $("#templateThankYouOutput"),
    listingNotes: $("#templateListingNotesOutput"),
  };

  const statusEl = $("#templateWorkspaceStatus");
  const shippingStatusEl = $("#templateShippingStatus");
  const savedStatusEl = $("#savedTemplateStatus");
  const savedListEl = $("#savedTemplateList");
  const rateSummaryEl = $("#templateRateSummary");
  const buildShippingTemplateBtn = $("#buildShippingTemplateBtn");
  const copyShippingTemplateBtn = $("#copyShippingTemplateBtn");
  const buildTemplateWorkspaceBtn = $("#buildTemplateWorkspaceBtn");
  const resetTemplateWorkspaceBtn = $("#resetTemplateWorkspaceBtn");

  const defaultState = {
    shippingSpeed: "next-business-day",
    handlingTime: "one-day",
    packagingStyle: "clean-folded",
    disclosureStyle: "standard",
    combinedShipping: "encouraged",
    thankYouTone: "warm",
  };

  const labelMaps = {
    shippingSpeed: {
      "next-business-day": "next business day",
      "two-business-days": "within 2 business days",
      "three-business-days": "within 3 business days",
    },
    handlingTime: {
      "same-day": "same-day handling when possible",
      "one-day": "1 business day handling",
      "two-days": "2 business day handling",
    },
    packagingStyle: {
      "clean-folded": "cleanly folded in a fresh mailer",
      boxed: "carefully boxed for safer transit",
      wrapped: "wrapped with tissue and protective layers",
    },
    disclosureStyle: {
      standard: "Please review all photos closely and read the item notes before purchasing. Any visible wear, measurements, or standout details should be called out in the listing.",
      detailed: "Please review all photos closely before purchasing. The final listing should note fabric, measurements, closure details, and any visible wear or flaws so the buyer has a complete picture before checkout.",
      concise: "Please review photos and notes carefully. Add any visible wear or flaw details directly to the listing before posting.",
    },
    combinedShipping: {
      encouraged: "Bundles are welcome and combined shipping is encouraged when it lowers total shipping cost.",
      available: "Combined shipping is available when package size and weight make it practical.",
      offers: "Reasonable offers are welcome, and bundle requests can be reviewed case by case.",
    },
    thankYouTone: {
      warm: "Thank you so much for shopping secondhand with me. I appreciate your order and your support.",
      professional: "Thank you for your order. Your package is being prepared with care and will be sent with tracking.",
      boutique: "Thank you for your order. Your package is wrapped with care and ready for a polished unboxing experience.",
    },
  };

  let latestRates = [];

  function getReusableState() {
    return {
      shippingSpeed: fields.shippingSpeed.value || defaultState.shippingSpeed,
      handlingTime: fields.handlingTime.value || defaultState.handlingTime,
      packagingStyle: fields.packagingStyle.value || defaultState.packagingStyle,
      disclosureStyle: fields.disclosureStyle.value || defaultState.disclosureStyle,
      combinedShipping: fields.combinedShipping.value || defaultState.combinedShipping,
      thankYouTone: fields.thankYouTone.value || defaultState.thankYouTone,
    };
  }

  function applyReusableState(state = defaultState) {
    fields.shippingSpeed.value = state.shippingSpeed || defaultState.shippingSpeed;
    fields.handlingTime.value = state.handlingTime || defaultState.handlingTime;
    fields.packagingStyle.value = state.packagingStyle || defaultState.packagingStyle;
    fields.disclosureStyle.value = state.disclosureStyle || defaultState.disclosureStyle;
    fields.combinedShipping.value = state.combinedShipping || defaultState.combinedShipping;
    fields.thankYouTone.value = state.thankYouTone || defaultState.thankYouTone;
  }

  function getUspsState() {
    return {
      originZip: String(fields.originZip?.value || "").replace(/\D/g, "").slice(0, 5),
      destinationZip: String(fields.destinationZip?.value || "").replace(/\D/g, "").slice(0, 5),
      pounds: Number(fields.pounds?.value || 0),
      ounces: Number(fields.ounces?.value || 0),
      packageProfile: fields.packageProfile?.value || "lightweight-apparel",
    };
  }

  function normalizeShipmentWeight(pounds, ounces) {
    const totalOunces = Math.max(0, (Number.isFinite(pounds) ? pounds * 16 : 0) + (Number.isFinite(ounces) ? ounces : 0));
    const normalizedPounds = Math.floor(totalOunces / 16);
    const normalizedOunces = Number((totalOunces - (normalizedPounds * 16)).toFixed(1));
    return { pounds: normalizedPounds, ounces: normalizedOunces };
  }

  function formatShipmentWeight(pounds, ounces) {
    const parts = [];
    if (pounds > 0) parts.push(`${pounds} lb`);
    parts.push(`${ounces} oz`);
    return parts.join(" ");
  }

  function renderRateSummary(rates) {
    if (!rateSummaryEl) return;
    rateSummaryEl.innerHTML = "";

    if (!rates.length) {
      rateSummaryEl.innerHTML = `<div class="border rounded p-3 small text-secondary text-center">No USPS estimate generated yet. Enter shipment details and run the builder to see local USPS-style shipping options.</div>`;
      return;
    }

    const uspsState = getUspsState();
    const cheapest = rates[0];
    const recommended = getRecommendedMarketplaceRate(rates, getReusableState().shippingSpeed);
    const buyerCharge = getSuggestedBuyerCharge(recommended?.rate ?? cheapest?.rate ?? null);
    const profile = getShippingProfileConfig(uspsState.packageProfile).label;

    const summary = document.createElement("div");
    summary.className = "border rounded p-3";
    summary.innerHTML = `
      <div class="small text-secondary mb-2">Marketplace Estimate</div>
      <div class="fw-semibold mb-1">Recommended for eBay-style pricing</div>
      <div class="small mb-1">Profile: ${escapeHtml(profile)}</div>
      <div class="small mb-1">Cheapest USPS estimate: $${Number(cheapest.rate).toFixed(2)} via ${escapeHtml(cheapest.service)}</div>
      <div class="small mb-1">Recommended service: $${Number(recommended.rate).toFixed(2)} via ${escapeHtml(recommended.service)}</div>
      <div class="small mb-0">Suggested buyer-paid shipping: ${buyerCharge !== null ? `$${buyerCharge.toFixed(2)}` : "Not available"}</div>
    `;
    rateSummaryEl.appendChild(summary);

    rates.slice(0, 4).forEach((rate) => {
      const row = document.createElement("div");
      row.className = "border rounded p-2 d-flex justify-content-between align-items-center";
      row.innerHTML = `<span>${escapeHtml(rate.service)}</span><span class="fw-semibold">$${Number(rate.rate).toFixed(2)}</span>`;
      rateSummaryEl.appendChild(row);
    });
  }

  function buildOutputs(state, uspsState = getUspsState(), rates = latestRates) {
    const shippingSpeed = labelMaps.shippingSpeed[state.shippingSpeed] || labelMaps.shippingSpeed["next-business-day"];
    const handlingTime = labelMaps.handlingTime[state.handlingTime] || labelMaps.handlingTime["one-day"];
    const packagingStyle = labelMaps.packagingStyle[state.packagingStyle] || labelMaps.packagingStyle["clean-folded"];
    const disclosure = labelMaps.disclosureStyle[state.disclosureStyle] || labelMaps.disclosureStyle.standard;
    const bundle = labelMaps.combinedShipping[state.combinedShipping] || labelMaps.combinedShipping.encouraged;
    const thankYou = labelMaps.thankYouTone[state.thankYouTone] || labelMaps.thankYouTone.warm;
    const weight = normalizeShipmentWeight(uspsState.pounds, uspsState.ounces);
    const weightLabel = formatShipmentWeight(weight.pounds, weight.ounces);
    const packageProfile = getShippingProfileConfig(uspsState.packageProfile).label;
    const cheapestRate = rates[0] || null;
    const recommendedRate = getRecommendedMarketplaceRate(rates, state.shippingSpeed);
    const buyerCharge = getSuggestedBuyerCharge(recommendedRate?.rate ?? cheapestRate?.rate ?? null);

    const laneText = uspsState.originZip && uspsState.destinationZip
      ? `from ZIP ${uspsState.originZip} to ZIP ${uspsState.destinationZip}`
      : "for the shipment lane entered";

    const uspsRateLine = cheapestRate
      ? `For a ${weightLabel} package ${laneText}, estimated USPS options start at $${Number(cheapestRate.rate).toFixed(2)} via ${cheapestRate.service}.`
      : `Add shipment details to generate a local USPS-style estimate for a ${weightLabel} package ${laneText}.`;

    const recommendedLine = recommendedRate
      ? `Recommended service for marketplace use: ${recommendedRate.service} at about $${Number(recommendedRate.rate).toFixed(2)}. Suggested buyer-paid shipping: ${buyerCharge !== null ? `$${buyerCharge.toFixed(2)}` : "not available"}.`
      : "";

    return {
      shipping: `Shipping estimate and template:\nPackage profile: ${packageProfile}\nShipment weight: ${weightLabel}\nThis order ships ${shippingSpeed} with ${handlingTime}. It will be ${packagingStyle}, sent with tracking, and prepared using USPS service options.\n\n${uspsRateLine}\n${recommendedLine}\n\nPaste-ready note:\nShips ${shippingSpeed}. Packed ${packagingStyle}. Estimated USPS shipping is built into the listing plan, and tracking updates once USPS accepts the shipment.`,
      condition: `Condition disclosure template:\n${disclosure}\n\nPaste-ready note:\nPre-owned item. Please review all photos closely. Add specific flaw details here: [insert flaw details].`,
      bundle: `Bundle / offer template:\n${bundle}\n\nPaste-ready note:\nBundle requests and reasonable offers are welcome. Combined shipping can be reviewed before purchase when it reduces total shipping cost.`,
      thanks: `Thank-you / packaging template:\n${thankYou}\n\nPaste-ready note:\nThank you for your order. Your package is being ${packagingStyle} and will ship ${shippingSpeed}. Tracking will update once USPS accepts the shipment.`,
      listingNotes: `Marketplace-neutral listing notes:\nPlease review photos, measurements, and condition notes before purchasing. Color may vary slightly by screen. Ships ${shippingSpeed} with ${handlingTime}. Add item-specific details here: [insert measurements, materials, flaws, or fit notes].`,
    };
  }

  function renderOutputs() {
    const built = buildOutputs(getReusableState(), getUspsState(), latestRates);
    outputs.shipping.textContent = built.shipping;
    outputs.condition.textContent = built.condition;
    outputs.bundle.textContent = built.bundle;
    outputs.thanks.textContent = built.thanks;
    outputs.listingNotes.textContent = built.listingNotes;
    return built;
  }

  function renderSavedTemplates() {
    const templates = getSmartTemplates();
    savedListEl.innerHTML = "";

    if (!templates.length) {
      savedListEl.innerHTML = `<div class="saved-template-empty">Save the copy blocks you use most so they are ready the next time you prep listings.</div>`;
      return;
    }

    templates.forEach((template) => {
      const kindLabel = {
        shipping: "USPS Shipping Template",
        condition: "Condition Disclosure",
        bundle: "Bundle / Offer Language",
        thanks: "Thank-You Note",
        "listing-notes": "Listing Notes",
      }[template.kind] || "Template";

      const card = document.createElement("article");
      card.className = "saved-template-card";
      card.innerHTML = `
        <div class="saved-template-card__header">
          <div>
            <p class="saved-template-card__name mb-1">${escapeHtml(template.name || "Untitled Template")}</p>
            <p class="saved-template-card__meta mb-0">${escapeHtml(kindLabel)} · Updated ${escapeHtml(formatDate(template.updatedAt))}</p>
          </div>
          <span class="dashboard-sku">${escapeHtml(kindLabel)}</span>
        </div>
        <pre class="saved-template-card__preview">${escapeHtml(template.text || "")}</pre>
        <div class="saved-template-card__actions">
          <button class="btn btn-outline-secondary btn-sm" type="button" data-apply-template="${escapeHtml(template.id)}">Apply Inputs</button>
          <button class="btn btn-outline-secondary btn-sm" type="button" data-copy-template="${escapeHtml(template.id)}">Copy</button>
          <button class="btn btn-outline-danger btn-sm" type="button" data-delete-template="${escapeHtml(template.id)}">Delete</button>
        </div>
      `;

      card.querySelector("[data-apply-template]").addEventListener("click", () => {
        applyReusableState(template.variables || defaultState);
        renderOutputs();
        savedStatusEl.textContent = `${template.name || "Template"} applied to the workspace.`;
      });

      card.querySelector("[data-copy-template]").addEventListener("click", async () => {
        const ok = await copyText(template.text || "");
        savedStatusEl.textContent = ok ? `${template.name || "Template"} copied.` : "Copy failed. Select and copy manually.";
      });

      card.querySelector("[data-delete-template]").addEventListener("click", () => {
        removeSmartTemplate(template.id);
        renderSavedTemplates();
        savedStatusEl.textContent = "Saved template deleted.";
      });

      savedListEl.appendChild(card);
    });
  }

  buildTemplateWorkspaceBtn.addEventListener("click", () => {
    renderOutputs();
    statusEl.textContent = "Templates updated.";
  });

  resetTemplateWorkspaceBtn.addEventListener("click", () => {
    applyReusableState(defaultState);
    latestRates = [];
    renderRateSummary(latestRates);
    renderOutputs();
    statusEl.textContent = "Inputs reset.";
  });

  [
    fields.shippingSpeed,
    fields.handlingTime,
    fields.packagingStyle,
    fields.disclosureStyle,
    fields.combinedShipping,
    fields.thankYouTone,
    fields.originZip,
    fields.destinationZip,
    fields.pounds,
    fields.ounces,
    fields.packageProfile,
  ].forEach((field) => {
    if (!field) return;
    field.addEventListener("input", renderOutputs);
    field.addEventListener("change", renderOutputs);
  });

  if (buildShippingTemplateBtn) {
    buildShippingTemplateBtn.addEventListener("click", () => {
      const uspsState = getUspsState();
      const { pounds, ounces } = normalizeShipmentWeight(uspsState.pounds, uspsState.ounces);

      if (uspsState.originZip.length !== 5 || uspsState.destinationZip.length !== 5) {
        shippingStatusEl.textContent = "Enter valid 5-digit origin and destination ZIP codes.";
        renderOutputs();
        return;
      }
      if ((pounds * 16) + ounces <= 0) {
        shippingStatusEl.textContent = "Enter a shipment weight greater than 0 oz.";
        renderOutputs();
        return;
      }

      latestRates = estimateUspsRates({
        originZip: uspsState.originZip,
        destinationZip: uspsState.destinationZip,
        pounds,
        ounces,
        packageProfile: uspsState.packageProfile,
      });
      renderRateSummary(latestRates);
      renderOutputs();
      shippingStatusEl.textContent = "Shipping estimate updated.";
    });
  }

  if (copyShippingTemplateBtn) {
    copyShippingTemplateBtn.addEventListener("click", async () => {
      const ok = await copyText(outputs.shipping?.textContent || "");
      shippingStatusEl.textContent = ok ? "Shipping template copied." : "Copy failed. Select and copy manually.";
    });
  }

  document.querySelectorAll(".template-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.getAttribute("data-copy-target"));
      const ok = await copyText(target?.textContent || "");
      statusEl.textContent = ok ? "Template copied." : "Copy failed. Select and copy manually.";
    });
  });

  document.querySelectorAll(".template-save-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.getAttribute("data-save-target"));
      const kind = button.getAttribute("data-save-kind") || "template";
      const text = String(target?.textContent || "").trim();
      if (!text) {
        statusEl.textContent = "Generate template text before saving.";
        return;
      }
      const name = window.prompt("Name this reusable template:");
      if (!name) return;

      upsertSmartTemplate({
        id: uid(),
        name: name.trim(),
        kind,
        text,
        variables: getReusableState(),
        updatedAt: new Date().toISOString(),
      });
      renderSavedTemplates();
      savedStatusEl.textContent = `${name.trim()} saved to LocalStorage.`;
    });
  });

  applyReusableState(defaultState);
  renderRateSummary(latestRates);
  renderOutputs();
  renderSavedTemplates();
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
    { label: "eBay comps support available", ok: ENABLE_LIVE_EBAY_COMPS || ENABLE_DEMO_EBAY_COMPS },
    { label: "Smart templates workspace available", ok: true },
    { label: "Local draft and listing storage", ok: typeof localStorage !== "undefined" },
    { label: "Dashboard export tools", ok: typeof exportCSV === "function" },
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
      $("#howDraftSummary").textContent = "No active draft yet. Start a listing to see progress here.";
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
  function renderChecklist() {
    const rows = [
      { label: "Saved listings in this browser", value: String(getListings().length) },
      { label: "Draft recovery", value: loadDraft() ? "Available" : "No active draft" },
      { label: "Smart templates saved locally", value: String(getSmartTemplates().length) },
      { label: "Optional live eBay comps", value: ENABLE_LIVE_EBAY_COMPS ? "Enabled" : "Off" },
      { label: "Demo comps fallback", value: ENABLE_DEMO_EBAY_COMPS ? "Available" : "Off" },
    ];

    checklist.innerHTML = "";
    rows.forEach((row) => {
      const el = document.createElement("div");
      el.className = "border rounded p-2 d-flex justify-content-between align-items-center";
      el.innerHTML = `<span>${escapeHtml(row.label)}</span><span class="fw-semibold">${escapeHtml(row.value)}</span>`;
      checklist.appendChild(el);
    });
  }

  renderChecklist();

  const status = $("#integrationCheckStatus");
  const btn = $("#runIntegrationCheckBtn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    renderChecklist();
    status.textContent = "Readiness check complete. Local saving, templates, and dashboard tools are available in this browser.";
  });
}

function initDashboardPage() {
  if (!pageHas("#listingsTableBody")) return;

  const tbody = $("#listingsTableBody");
  const emptyState = $("#emptyState");
  const dashboardStatus = $("#dashboardStatus");
  const dashboardSearch = $("#dashboardSearch");
  const statusFilter = $("#statusFilter");
  const categoryFilter = $("#categoryFilter");
  const sortFilter = $("#sortFilter");
  const selectAll = $("#selectAllListings");
  const selectionCount = $("#selectionCount");
  const summaryTotal = $("#summaryTotal");
  const summaryDrafts = $("#summaryDrafts");
  const summaryReady = $("#summaryReady");
  const summaryListed = $("#summaryListed");
  const summarySold = $("#summarySold");

  function normalizeListingRecord(listing) {
    return {
      ...listing,
      status: normalizeStatus(listing.status),
      createdAt: listing.createdAt || listing.updatedAt || new Date().toISOString(),
      updatedAt: listing.updatedAt || listing.createdAt || new Date().toISOString(),
    };
  }

  function getAllListings() {
    return getListings().map(normalizeListingRecord);
  }

  function getSelectedListingIds() {
    return [...tbody.querySelectorAll("input[data-select-id]:checked")].map((el) => el.getAttribute("data-select-id"));
  }

  function syncSelectionMeta() {
    const count = getSelectedListingIds().length;
    if (selectionCount) selectionCount.textContent = `${count} selected`;
    if (selectAll) {
      const checkboxes = [...tbody.querySelectorAll("input[data-select-id]")];
      const checked = checkboxes.filter((checkbox) => checkbox.checked).length;
      selectAll.checked = Boolean(checkboxes.length) && checked === checkboxes.length;
      selectAll.indeterminate = checked > 0 && checked < checkboxes.length;
    }
  }

  function updateSummary(listings) {
    const total = listings.length;
    const counts = listings.reduce((acc, listing) => {
      acc[normalizeStatus(listing.status)] = (acc[normalizeStatus(listing.status)] || 0) + 1;
      return acc;
    }, {});
    if (summaryTotal) summaryTotal.textContent = String(total);
    if (summaryDrafts) summaryDrafts.textContent = String(counts.draft || 0);
    if (summaryReady) summaryReady.textContent = String(counts.ready || 0);
    if (summaryListed) summaryListed.textContent = String(counts.listed || 0);
    if (summarySold) summarySold.textContent = String(counts.sold || 0);
  }

  function renderCategoryOptions(listings) {
    if (!categoryFilter) return;
    const categories = [...new Set(
      listings
        .map((listing) => listing.category)
        .filter(Boolean)
    )].sort((a, b) => prettyCategory(a).localeCompare(prettyCategory(b)));
    const previous = categoryFilter.value || "all";
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = prettyCategory(category);
      categoryFilter.appendChild(option);
    });
    categoryFilter.value = categories.includes(previous) || previous === "all" ? previous : "all";
  }

  function getVisibleListings() {
    const statusValue = statusFilter?.value || "all";
    const categoryValue = categoryFilter?.value || "all";
    const searchTerm = normalize(dashboardSearch?.value);
    const sortValue = sortFilter?.value || "newest";

    let listings = getAllListings();

    if (statusValue !== "all") {
      listings = listings.filter((listing) => normalizeStatus(listing.status) === normalizeStatus(statusValue));
    }

    if (categoryValue !== "all") {
      listings = listings.filter((listing) => listing.category === categoryValue);
    }

    if (searchTerm) {
      listings = listings.filter((listing) => {
        const haystack = [
          listing.itemName,
          listing.brand,
          prettyCategory(listing.category),
          getListingSku(listing),
        ].map(normalize).join(" ");
        return haystack.includes(searchTerm);
      });
    }

    listings.sort((a, b) => {
      if (sortValue === "oldest") {
        return new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf();
      }
      if (sortValue === "priceHigh") {
        return Number(b.price || 0) - Number(a.price || 0);
      }
      if (sortValue === "priceLow") {
        return Number(a.price || 0) - Number(b.price || 0);
      }
      if (sortValue === "status") {
        return prettyStatus(a.status).localeCompare(prettyStatus(b.status))
          || new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf();
      }
      return new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf();
    });

    return listings;
  }

  function getStatusBadge(status) {
    const clean = normalizeStatus(status);
    const label = prettyStatus(clean);
    return `<span class="dashboard-status-badge dashboard-status-badge--${clean}">${escapeHtml(label)}</span>`;
  }

  function renderEmptyState() {
    const hasFilters = Boolean(
      normalize(dashboardSearch?.value)
      || (statusFilter && statusFilter.value !== "all")
      || (categoryFilter && categoryFilter.value !== "all")
    );
    emptyState.innerHTML = hasFilters
      ? `<p class="mb-1">No listings match the current search or filters.</p><p class="mb-0">Try clearing filters or adjusting your search terms.</p>`
      : `<p class="mb-1">This dashboard is your local resale workspace.</p><p class="mb-0">Use it to track drafts, organize listings, and export prep-ready inventory.</p><a class="btn btn-dark mt-2" href="new-listing.html">Start a Listing</a>`;
  }

  function render() {
    const allListings = getAllListings();
    updateSummary(allListings);
    renderCategoryOptions(allListings);

    const listings = getVisibleListings();
    tbody.innerHTML = "";
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }

    if (!listings.length) {
      renderEmptyState();
      syncSelectionMeta();
      return;
    }

    emptyState.innerHTML = "";

    listings.forEach((listing) => {
      const statusValue = normalizeStatus(listing.status);
      const sku = getListingSku(listing);
      const updated = listing.updatedAt || listing.createdAt;
      const notePreview = String(listing.notes || "").trim().slice(0, 92);
      const tr = document.createElement("tr");
      tr.className = "dashboard-row";
      tr.innerHTML = `
        <td><input class="form-check-input" type="checkbox" data-select-id="${escapeHtml(listing.id)}" aria-label="Select listing ${escapeHtml(listing.itemName || "Untitled")}" /></td>
        <td>
          <div class="dashboard-item-cell">
            <a class="dashboard-item-title" href="listing.html?id=${encodeURIComponent(listing.id)}">${escapeHtml(listing.itemName || "Untitled")}</a>
            <div class="dashboard-item-meta">${escapeHtml(listing.brand || "No brand")} · ${escapeHtml(prettyCondition(listing.condition))}</div>
            <div class="dashboard-item-note">${escapeHtml(notePreview || "No notes yet.")}</div>
          </div>
        </td>
        <td><span class="dashboard-sku">${escapeHtml(sku)}</span></td>
        <td>${escapeHtml(prettyCategory(listing.category))}</td>
        <td>
          <div class="dashboard-status-cell">
            ${getStatusBadge(statusValue)}
            <select class="form-select form-select-sm" data-status-id="${escapeHtml(listing.id)}" aria-label="Quick status change for ${escapeHtml(listing.itemName || "Untitled")}">
              <option value="draft" ${statusValue === "draft" ? "selected" : ""}>Draft</option>
              <option value="ready" ${statusValue === "ready" ? "selected" : ""}>Ready to List</option>
              <option value="listed" ${statusValue === "listed" ? "selected" : ""}>Listed</option>
              <option value="sold" ${statusValue === "sold" ? "selected" : ""}>Sold</option>
            </select>
          </div>
        </td>
        <td><span class="dashboard-price">$${Number(listing.price || 0).toFixed(2)}</span></td>
        <td><span title="${escapeHtml(formatDateTime(listing.createdAt))}">${escapeHtml(formatDate(listing.createdAt))}</span></td>
        <td><span title="${escapeHtml(formatDateTime(updated))}">${escapeHtml(formatDate(updated))}</span></td>
        <td>
          <div class="dashboard-actions">
            <a class="btn btn-sm btn-outline-secondary" href="listing.html?id=${encodeURIComponent(listing.id)}">View</a>
            <button class="btn btn-sm btn-outline-secondary" data-edit="${escapeHtml(listing.id)}" type="button">Edit</button>
            <button class="btn btn-sm btn-outline-secondary" data-dup="${escapeHtml(listing.id)}" type="button">Duplicate</button>
            <button class="btn btn-sm btn-outline-danger" data-del="${escapeHtml(listing.id)}" type="button" aria-label="Delete ${escapeHtml(listing.itemName || "Untitled")}">Delete</button>
          </div>
        </td>
      `;

      tr.querySelector("[data-select-id]").addEventListener("change", syncSelectionMeta);

      tr.querySelector("[data-status-id]").addEventListener("change", (event) => {
        const nextStatus = normalizeStatus(event.target.value);
        updateListing(listing.id, { status: nextStatus });
        dashboardStatus.textContent = `Status updated to ${prettyStatus(nextStatus)}.`;
        render();
      });

      tr.querySelector("[data-edit]").addEventListener("click", () => {
        saveDraft({
          ...listing,
          __editingId: listing.id,
        });
        window.location.href = "new-listing.html";
      });

      tr.querySelector("[data-dup]").addEventListener("click", () => {
        const duplicate = duplicateListing(listing.id);
        dashboardStatus.textContent = duplicate ? "Listing duplicated as a draft." : "Could not duplicate listing.";
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

    syncSelectionMeta();
  }

  $("#exportBtn").addEventListener("click", () => {
    const listings = getAllListings();
    if (!listings.length) {
      dashboardStatus.textContent = "No saved inventory to export.";
      return;
    }
    exportCSV(listings);
    dashboardStatus.textContent = "All inventory exported as CSV.";
  });

  const exportJsonBtn = $("#exportJsonBtn");
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      const listings = getAllListings();
      if (!listings.length) {
        dashboardStatus.textContent = "No saved inventory to export.";
        return;
      }
      exportJSON(listings);
      dashboardStatus.textContent = "All inventory exported as JSON.";
    });
  }

  const exportSelectedBtn = $("#exportSelectedBtn");
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener("click", () => {
      const selectedIds = new Set(getSelectedListingIds());
      const selected = getVisibleListings().filter((listing) => selectedIds.has(listing.id));
      if (!selected.length) {
        dashboardStatus.textContent = "Select at least 1 visible listing to export.";
        return;
      }
      exportCSV(selected);
      dashboardStatus.textContent = "Selected inventory exported as CSV.";
    });
  }

  const exportSelectedJsonBtn = $("#exportSelectedJsonBtn");
  if (exportSelectedJsonBtn) {
    exportSelectedJsonBtn.addEventListener("click", () => {
      const selectedIds = new Set(getSelectedListingIds());
      const selected = getVisibleListings().filter((listing) => selectedIds.has(listing.id));
      if (!selected.length) {
        dashboardStatus.textContent = "Select at least 1 visible listing to export.";
        return;
      }
      exportJSON(selected);
      dashboardStatus.textContent = "Selected inventory exported as JSON.";
    });
  }

  if (dashboardSearch) {
    dashboardSearch.addEventListener("input", render);
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", render);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener("change", render);
  }

  if (sortFilter) {
    sortFilter.addEventListener("change", render);
  }

  if (selectAll) {
    selectAll.addEventListener("change", () => {
      const checked = Boolean(selectAll.checked);
      tbody.querySelectorAll("input[data-select-id]").forEach((checkbox) => {
        checkbox.checked = checked;
      });
      syncSelectionMeta();
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
