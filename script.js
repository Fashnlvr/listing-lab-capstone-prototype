const STORAGE_KEYS = {
  listings: "listingLab:listings:v2",
  draft: "listingLab:draft:v2",
  draftCursor: "listingLab:draftCursor:v1",
  uspsUserId: "listingLab:uspsUserId:v1",
  templates: "listingLab:templates:v1",
  skuSettings: "listingLab:skuSettings:v1",
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

const SEO_STOPWORDS = new Set([
  "the", "and", "with", "for", "from", "size", "style", "item", "this", "that", "womens", "women", "mens", "men",
]);

const CATEGORY_SEARCH_TERMS = {
  tops: ["top", "shirt", "blouse", "tee"],
  bottoms: ["pants", "jeans", "trousers", "bottoms"],
  dresses: ["dress", "midi dress", "maxi dress", "mini dress"],
  shoes: ["shoes", "sneakers", "boots", "heels"],
  bags: ["bag", "handbag", "purse", "tote"],
  outerwear: ["jacket", "coat", "blazer", "outerwear"],
};

const CONDITION_SEARCH_TERMS = {
  new: ["new", "nwt"],
  "like-new": ["like new", "excellent condition"],
  good: ["preowned", "good condition"],
  fair: ["as is", "well loved"],
};

const DEFAULT_SKU_SETTINGS = {
  prefix: "LL",
  nextNumber: 1,
  digits: 4,
};

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

function getSkuSettings() {
  const raw = safeStorageGet(STORAGE_KEYS.skuSettings);
  const parsed = raw ? safeJsonParse(raw, DEFAULT_SKU_SETTINGS) : DEFAULT_SKU_SETTINGS;
  return {
    prefix: String(parsed?.prefix || DEFAULT_SKU_SETTINGS.prefix).trim() || DEFAULT_SKU_SETTINGS.prefix,
    nextNumber: Math.max(1, Number.parseInt(parsed?.nextNumber, 10) || DEFAULT_SKU_SETTINGS.nextNumber),
    digits: Math.min(8, Math.max(1, Number.parseInt(parsed?.digits, 10) || DEFAULT_SKU_SETTINGS.digits)),
  };
}

function saveSkuSettings(settings) {
  const next = {
    prefix: String(settings?.prefix || DEFAULT_SKU_SETTINGS.prefix).trim() || DEFAULT_SKU_SETTINGS.prefix,
    nextNumber: Math.max(1, Number.parseInt(settings?.nextNumber, 10) || DEFAULT_SKU_SETTINGS.nextNumber),
    digits: Math.min(8, Math.max(1, Number.parseInt(settings?.digits, 10) || DEFAULT_SKU_SETTINGS.digits)),
  };
  safeStorageSet(STORAGE_KEYS.skuSettings, JSON.stringify(next));
  return next;
}

function formatCustomSku(number, settings = getSkuSettings()) {
  const prefix = String(settings.prefix || DEFAULT_SKU_SETTINGS.prefix).trim();
  const digits = Math.min(8, Math.max(1, Number.parseInt(settings.digits, 10) || DEFAULT_SKU_SETTINGS.digits));
  const nextNumber = Math.max(1, Number.parseInt(number, 10) || 1);
  return `${prefix}-${String(nextNumber).padStart(digits, "0")}`;
}

function allocateNextSku() {
  const settings = getSkuSettings();
  const sku = formatCustomSku(settings.nextNumber, settings);
  saveSkuSettings({
    ...settings,
    nextNumber: settings.nextNumber + 1,
  });
  return sku;
}

function getListingSku(listing) {
  if (listing?.sku) return listing.sku;
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
    sku: allocateNextSku(),
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
  return Array.isArray(parsed) ? parsed.map((template) => buildTemplateRecord(template)) : [];
}

function saveTemplates(templates) {
  safeStorageSet(STORAGE_KEYS.templates, JSON.stringify(templates));
}

function upsertTemplate(template) {
  const normalizedTemplate = buildTemplateRecord(template);
  const templates = getTemplates();
  const idx = templates.findIndex((item) => item.id === normalizedTemplate.id);
  if (idx >= 0) {
    templates[idx] = normalizedTemplate;
  } else {
    templates.unshift(normalizedTemplate);
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

function buildTemplateRecord(template = {}) {
  return {
    id: template.id || uid(),
    name: String(template.name || "").trim(),
    titlePattern: String(template.titlePattern || "").trim(),
    description: String(template.description || "").trim(),
    shippingNotes: String(template.shippingNotes || "").trim(),
    keywords: String(template.keywords || "").trim(),
    conditionDisclosure: String(template.conditionDisclosure || "").trim(),
    measurementsReminder: String(template.measurementsReminder || "").trim(),
    category: String(template.category || "").trim(),
    condition: String(template.condition || "").trim(),
    updatedAt: template.updatedAt || new Date().toISOString(),
  };
}

function duplicateTemplate(id) {
  const source = getTemplateById(id);
  if (!source) return null;

  const duplicate = buildTemplateRecord({
    ...source,
    id: uid(),
    name: `${source.name || "Untitled Template"} Copy`,
    updatedAt: new Date().toISOString(),
  });
  upsertTemplate(duplicate);
  return duplicate;
}

const TEMPLATE_TOKEN_SAMPLES = {
  itemName: "Structured Blazer",
  brand: "Madewell",
  category: "Outerwear",
  condition: "Good",
  price: "$48.00",
  measurements: "Pit to pit 19 in, length 26 in",
  flaws: "light sleeve wear noted in photos",
};

function getTemplateTokenValues(values = {}) {
  return {
    itemName: String(values.itemName || "").trim(),
    brand: String(values.brand || "").trim(),
    category: String(values.category || "").trim(),
    condition: String(values.condition || "").trim(),
    price: String(values.price || "").trim(),
    measurements: String(values.measurements || "").trim(),
    flaws: String(values.flaws || "").trim(),
  };
}

function renderTemplateTokens(text, values = {}, fallbackValues = {}) {
  const tokenValues = {
    ...fallbackValues,
    ...getTemplateTokenValues(values),
  };

  const normalizedText = String(text || "")
    .replace(/\bItem Name\b/gi, "{{itemName}}")
    .replace(/\bBrand\b/gi, "{{brand}}")
    .replace(/\bCategory\b/gi, "{{category}}")
    .replace(/\bCondition\b/gi, "{{condition}}")
    .replace(/\bPrice\b/gi, "{{price}}")
    .replace(/\bMeasurements\b/gi, "{{measurements}}")
    .replace(/\bFlaws\b/gi, "{{flaws}}");

  return normalizedText.replace(/\{\{\s*(\w+)\s*\}\}|\{(\w+)\}/g, (_, modernToken, legacyToken) => {
    const key = modernToken || legacyToken;
    return Object.prototype.hasOwnProperty.call(tokenValues, key) ? tokenValues[key] : "";
  }).trim();
}

function mergeTemplateKeywords(existingKeywords, incomingKeywords) {
  const parts = [existingKeywords, incomingKeywords]
    .join(",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const seen = new Set();
  return parts.filter((part) => {
    const normalized = normalize(part);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).join(", ");
}

function appendUniqueNoteSections(existingText, sections) {
  let next = String(existingText || "").trim();
  const normalizedExisting = () => normalize(next);

  sections.forEach(({ label, content }) => {
    const cleanContent = String(content || "").trim();
    if (!cleanContent) return;
    const block = `${label}:\n${cleanContent}`;
    const existing = normalizedExisting();
    if (existing.includes(normalize(block)) || existing.includes(normalize(cleanContent))) return;
    next = next ? `${next}\n\n${block}` : block;
  });

  return next;
}

function saveDraft(draft) {
  const nextDraft = draft ? { ...draft, savedAt: new Date().toISOString() } : null;
  if (!nextDraft) return;

  const queue = getDraftQueue().filter((item) => {
    if (nextDraft.__editingId && item.__editingId) {
      return item.__editingId !== nextDraft.__editingId;
    }
    return !(normalize(item.itemName) === normalize(nextDraft.itemName)
      && normalize(item.brand) === normalize(nextDraft.brand)
      && normalize(item.category) === normalize(nextDraft.category)
      && normalize(item.condition) === normalize(nextDraft.condition)
      && String(item.price || "") === String(nextDraft.price || ""));
  });

  queue.unshift(nextDraft);
  safeStorageSet(STORAGE_KEYS.draft, JSON.stringify(queue.slice(0, 10)));
  safeStorageSet(STORAGE_KEYS.draftCursor, "0");
}

function getDraftQueue() {
  const raw = safeStorageGet(STORAGE_KEYS.draft);
  if (!raw) return [];

  const parsed = safeJsonParse(raw, null);
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  if (parsed && typeof parsed === "object") return [parsed];
  return [];
}

function getDraftCursor(queueLength = getDraftQueue().length) {
  if (!queueLength) return 0;
  const raw = safeStorageGet(STORAGE_KEYS.draftCursor);
  const value = Number.parseInt(String(raw || "0"), 10);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value % queueLength;
}

function setDraftCursor(index) {
  safeStorageSet(STORAGE_KEYS.draftCursor, String(Math.max(0, index)));
}

function loadDraft({ advance = false } = {}) {
  const queue = getDraftQueue();
  if (!queue.length) return null;

  const cursor = getDraftCursor(queue.length);
  const draft = queue[cursor] || queue[0] || null;
  if (advance && draft) {
    setDraftCursor((cursor + 1) % queue.length);
  }
  return draft;
}

function clearDraft() {
  safeStorageRemove(STORAGE_KEYS.draft);
  safeStorageRemove(STORAGE_KEYS.draftCursor);
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

function getManualCompValues(inputs) {
  return inputs
    .map((input) => Number(input?.value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function buildResearchLinks(query) {
  const encoded = encodeURIComponent(query);
  return {
    ebaySold: `https://www.ebay.com/sch/i.html?_nkw=${encoded}&LH_Sold=1&LH_Complete=1`,
    poshmark: `https://poshmark.com/search?query=${encoded}`,
  };
}

function pushUnique(list, value) {
  const clean = String(value || "").trim();
  if (!clean) return;
  if (!list.some((entry) => normalize(entry) === normalize(clean))) {
    list.push(clean);
  }
}

function tokenizeSearchWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !SEO_STOPWORDS.has(word));
}

function toHashtagToken(value) {
  return String(value || "")
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
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
    manualCompInputs: [
      $("#manualComp1"),
      $("#manualComp2"),
      $("#manualComp3"),
      $("#manualComp4"),
      $("#manualComp5"),
    ].filter(Boolean),
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
    templateConditionDisclosure: $("#templateConditionDisclosure"),
    templateMeasurementsReminder: $("#templateMeasurementsReminder"),
    templateStatus: $("#templateStatus"),
    saveTemplateBtn: $("#saveTemplateBtn"),
    applyTemplateBtn: $("#applyTemplateBtn"),
    deleteTemplateBtn: $("#deleteTemplateBtn"),
  };

  let latestCompMedian = null;
  let latestCompSummary = null;
  let latestCompQuery = "";
  let latestCompSource = "none";

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

  function resetListingForm() {
    setFormState({});
    currentEditingId = "";
    latestCompMedian = null;
    latestCompSummary = null;
    latestCompQuery = "";
    latestCompSource = "none";
    (nodes.manualCompInputs || []).forEach((input) => {
      input.value = "";
    });
    if (nodes.compResults) nodes.compResults.innerHTML = "";
    if (nodes.compSummary) nodes.compSummary.textContent = "";
    if (nodes.compStatus) nodes.compStatus.textContent = "";
    if (nodes.formulaSummary) nodes.formulaSummary.textContent = "";
    if (nodes.formulaStatus) nodes.formulaStatus.textContent = "";
    if (nodes.templateSelect) nodes.templateSelect.value = "";
    fillTemplateEditor(null);
    const submitBtn = nodes.form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = "Save Listing";
    setError("");
    setStatus("");
    updatePreview();
    document.querySelectorAll(".form-control, .form-select").forEach((field) => syncFilledState(field));
  }

  function generateKeywordsFromState(state) {
    const keywords = [];
    const categoryLabel = state.category ? prettyCategory(state.category) : "";
    const itemWords = tokenizeSearchWords(state.itemName);

    pushUnique(keywords, state.brand);
    pushUnique(keywords, state.itemName);
    pushUnique(keywords, [state.brand, state.itemName].filter(Boolean).join(" "));
    pushUnique(keywords, categoryLabel);
    pushUnique(keywords, [state.brand, categoryLabel].filter(Boolean).join(" "));

    (CATEGORY_SEARCH_TERMS[state.category] || []).forEach((term) => pushUnique(keywords, term));
    (CONDITION_SEARCH_TERMS[state.condition] || []).forEach((term) => pushUnique(keywords, term));

    itemWords.forEach((word) => pushUnique(keywords, word));

    if (state.brand && itemWords.length) {
      pushUnique(keywords, `${state.brand} ${itemWords[0]}`);
    }

    return keywords.slice(0, 12);
  }

  function buildHashtags(state) {
    const hashtags = [];
    const categoryLabel = state.category ? prettyCategory(state.category) : "";
    const generatedKeywords = generateKeywordsFromState(state);
    const itemWords = tokenizeSearchWords(state.itemName);

    [
      state.brand,
      categoryLabel,
      state.itemName,
      [state.brand, categoryLabel].filter(Boolean).join(" "),
      (CONDITION_SEARCH_TERMS[state.condition] || [])[0] || "",
      itemWords[0] || "",
      itemWords.slice(0, 2).join(" "),
      ...generatedKeywords.slice(0, 4),
    ].forEach((value) => {
      const token = toHashtagToken(value);
      if (!token) return;
      if (!hashtags.includes(`#${token}`)) hashtags.push(`#${token}`);
    });

    return hashtags.slice(0, 8).join(" ");
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
    if (nodes.templateConditionDisclosure) nodes.templateConditionDisclosure.value = template?.conditionDisclosure || "";
    if (nodes.templateMeasurementsReminder) nodes.templateMeasurementsReminder.value = template?.measurementsReminder || "";
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

    const tokenValues = {
      itemName: current.itemName,
      brand: current.brand,
      category: prettyCategory(current.category || template.category),
      condition: prettyCondition(current.condition || template.condition),
      price: Number.isFinite(current.price) && current.price > 0 ? `$${current.price.toFixed(2)}` : "",
      measurements: "[add measurements]",
      flaws: "[add flaws]",
    };

    const title = renderTemplateTokens(template.titlePattern, tokenValues, TEMPLATE_TOKEN_SAMPLES);
    if (!fields.itemName.value.trim() && title) fields.itemName.value = title;
    if (!fields.category.value && template.category) fields.category.value = template.category;
    if (!fields.condition.value && template.condition) fields.condition.value = template.condition;

    const renderedKeywords = renderTemplateTokens(template.keywords, tokenValues, TEMPLATE_TOKEN_SAMPLES);
    if (renderedKeywords) {
      fields.keywords.value = mergeTemplateKeywords(fields.keywords.value, renderedKeywords);
    }

    fields.notes.value = appendUniqueNoteSections(fields.notes.value, [
      { label: "Description", content: renderTemplateTokens(template.description, tokenValues, TEMPLATE_TOKEN_SAMPLES) },
      { label: "Condition Disclosure", content: renderTemplateTokens(template.conditionDisclosure, tokenValues, TEMPLATE_TOKEN_SAMPLES) },
      { label: "Measurements Reminder", content: renderTemplateTokens(template.measurementsReminder, tokenValues, TEMPLATE_TOKEN_SAMPLES) },
      { label: "Shipping Notes", content: renderTemplateTokens(template.shippingNotes, tokenValues, TEMPLATE_TOKEN_SAMPLES) },
    ]);

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

    const pricingGuide = getPricingGuide(state);
    const suggestedRange = pricingGuide.range;
    if (suggestedRange) {
      const rangeLabel = `$${suggestedRange[0]} - $${suggestedRange[1]}`;
      nodes.suggestedRange.textContent = pricingGuide.source === "manual"
        ? `${rangeLabel} (manual comps)`
        : pricingGuide.source === "live"
          ? `${rangeLabel} (live comps)`
          : `${rangeLabel} (estimated)`;
    } else {
      nodes.suggestedRange.textContent = "-";
    }

    const priceCheck = isPriceValid(state.price, suggestedRange);
    nodes.priceCheck.textContent = priceCheck.msg;

    const title = state.itemName || "Untitled item";
    const condition = prettyCondition(state.condition);
    const price = Number.isFinite(state.price) && state.price > 0 ? `$${state.price.toFixed(2)}` : "$0.00";
    const rangeText = suggestedRange
      ? `${`$${suggestedRange[0]} - $${suggestedRange[1]}`} ${pricingGuide.source === "manual" ? "(manual comps)" : pricingGuide.source === "live" ? "(live comps)" : "(estimated)"}`
      : "Add category + condition";
    const priceCheckText = priceCheck.msg || "Waiting for price";
    const conditionText = state.condition
      ? `${condition} condition${state.brand ? ` for this ${state.brand} item.` : "."}`
      : "No condition selected yet.";
    const descriptionText = state.notes || "Add notes for flaws, measurements, materials, and shipping details.";
    const sellerNotesText = [
      state.condition ? `Condition is listed as ${condition.toLowerCase()}.` : "Condition details can be added once reviewed.",
      state.notes
        ? "Please review the photos and description for measurements, materials, and any noted wear."
        : "Please review the photos for overall item details and condition.",
      "Message with any questions before purchase.",
    ].join("\n");
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

  function getPricingGuide(state) {
    const query = buildCompQuery(state);
    const manualCompValues = getManualCompValues(nodes.manualCompInputs || []);
    const manualCompSummary = manualCompValues.length
      ? computeCompSummary(manualCompValues.map((price, idx) => ({ title: `Manual comp ${idx + 1}`, price })))
      : null;
    const hasManualCompGuide = manualCompSummary && normalize(latestCompQuery) === normalize(query);
    const hasLiveCompGuide = latestCompSource === "live"
      && latestCompSummary
      && normalize(latestCompQuery) === normalize(query);

    if (hasManualCompGuide) {
      return {
        range: [Number(manualCompSummary.min.toFixed(2)), Number(manualCompSummary.max.toFixed(2))],
        suggested: Number(manualCompSummary.median.toFixed(2)),
        source: "manual",
      };
    }

    if (hasLiveCompGuide) {
      return {
        range: [Number(latestCompSummary.min.toFixed(2)), Number(latestCompSummary.max.toFixed(2))],
        suggested: Number(latestCompSummary.median.toFixed(2)),
        source: "live",
      };
    }

    if (!(state.category && state.condition)) {
      return { range: null, suggested: null, source: "none" };
    }

    const [low, high] = getSuggestedRange(state.category, state.condition, state.brand);
    return {
      range: [low, high],
      suggested: Number((((low + high) / 2)).toFixed(2)),
      source: "estimated",
    };
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
    const pricingGuide = getPricingGuide(state);
    if (!pricingGuide.range || !Number.isFinite(pricingGuide.suggested)) {
      nodes.formulaStatus.textContent = "Choose category and condition to generate a formula-based price.";
      nodes.formulaSummary.textContent = "";
      return;
    }

    const [low, high] = pricingGuide.range;
    const suggested = pricingGuide.suggested;
    fields.price.value = suggested.toFixed(2);
    nodes.formulaSummary.textContent = `Range: $${low}-$${high} | Suggested: $${suggested.toFixed(2)} | Source: ${pricingGuide.source === "manual" ? "manual comps" : pricingGuide.source === "live" ? "live sold comps" : "local estimate"}.`;
    nodes.formulaStatus.textContent = pricingGuide.source === "manual"
      ? `Applied price from manual comps: $${suggested.toFixed(2)}.`
      : pricingGuide.source === "live"
        ? `Applied price from live sold comps: $${suggested.toFixed(2)}.`
        : `Applied estimated price: $${suggested.toFixed(2)}.`;

    if (!fields.keywords.value.trim()) {
      fields.keywords.value = [state.brand, state.itemName, prettyCategory(state.category)]
        .filter(Boolean)
        .join(", ");
    }
    updatePreview();
  }

  nodes.applyFormulaPriceBtn.addEventListener("click", applyFormulaPricing);

  function loadDraftIntoForm(draft, statusMessage) {
    if (!draft) return false;
    currentEditingId = draft.__editingId || "";
    setFormState(draft);
    updatePreview();
    const submitBtn = nodes.form?.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = currentEditingId ? "Update Listing" : "Save Listing";
    nodes.formStatus.textContent = statusMessage || (currentEditingId ? "Loaded draft for editing." : "Loaded saved draft.");
    return true;
  }

  let currentEditingId = "";
  const activeDraft = loadDraft({ advance: true });
  if (activeDraft) {
    loadDraftIntoForm(
      activeDraft,
      activeDraft.__editingId ? "Loaded latest draft for editing." : "Loaded latest saved draft."
    );
  }

  if (nodes.runCompSearchBtn) {
    nodes.runCompSearchBtn.addEventListener("click", () => {
      const state = getFormState();
      const query = buildCompQuery(state);
      nodes.compResults.innerHTML = "";
      nodes.compSummary.textContent = "";
      latestCompMedian = null;
      latestCompSummary = null;
      latestCompQuery = query;
      latestCompSource = "none";

      if (!query) {
        nodes.compStatus.textContent = "Add at least item name or brand before opening market research.";
        return;
      }

      const links = buildResearchLinks(query);
      window.open(links.ebaySold, "_blank", "noopener,noreferrer");
      window.open(links.poshmark, "_blank", "noopener,noreferrer");
      nodes.compStatus.textContent = "Opened eBay sold results and Poshmark search in new tabs. Enter the real comp prices you find below.";
      nodes.compSummary.textContent = "Use sold listings first when possible, then compare against current Poshmark pricing before entering comp values.";
    });
  }

  if (nodes.applyCompPriceBtn) {
    nodes.applyCompPriceBtn.addEventListener("click", () => {
      const manualCompValues = getManualCompValues(nodes.manualCompInputs || []);
      const summary = manualCompValues.length
        ? computeCompSummary(manualCompValues.map((price, idx) => ({ title: `Manual comp ${idx + 1}`, price })))
        : null;

      if (!summary) {
        nodes.compStatus.textContent = "Enter at least 1 real comp price before applying a comp median.";
        return;
      }

      latestCompMedian = summary.median;
      latestCompSummary = summary;
      latestCompQuery = buildCompQuery(getFormState());
      latestCompSource = "manual";
      fields.price.value = latestCompMedian.toFixed(2);
      nodes.compSummary.textContent = `Comps: ${summary.count} | Min $${summary.min.toFixed(2)} | Median $${summary.median.toFixed(2)} | Avg $${summary.average.toFixed(2)} | Max $${summary.max.toFixed(2)} | Source: manual comps.`;
      nodes.compStatus.textContent = `Applied manual comp median: $${latestCompMedian.toFixed(2)}.`;
      updatePreview();
    });
  }

  (nodes.manualCompInputs || []).forEach((input) => {
    input.addEventListener("input", () => {
      latestCompQuery = buildCompQuery(getFormState());
      latestCompSource = "manual";
      updatePreview();
    });
  });

  $("#saveDraftBtn").addEventListener("click", () => {
    const draftState = getFormState();
    saveDraft({
      ...draftState,
      status: "draft",
      ...(currentEditingId ? { __editingId: currentEditingId } : {}),
    });
    setStatus("Draft saved with Draft status.");
  });

  $("#loadDraftBtn").addEventListener("click", () => {
    const draft = loadDraft({ advance: true });
    if (!draft) {
      window.alert("No saved drafts were found.");
      return;
    }
    loadDraftIntoForm(draft, draft.__editingId ? "Loaded next draft for editing." : "Loaded next saved draft.");
  });

  $("#clearDraftBtn").addEventListener("click", () => {
    resetListingForm();
    setStatus("Form reset. Load Draft to open the next saved draft.");
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
      const template = buildTemplateRecord({
        id: selectedId || uid(),
        name,
        titlePattern: nodes.templateTitlePattern.value.trim(),
        description: nodes.templateDescription.value.trim(),
        keywords: nodes.templateKeywords.value.trim(),
        shippingNotes: nodes.templateShippingNotes.value.trim(),
        conditionDisclosure: nodes.templateConditionDisclosure?.value.trim() || "",
        measurementsReminder: nodes.templateMeasurementsReminder?.value.trim() || "",
        category: fields.category.value,
        condition: fields.condition.value,
        updatedAt: new Date().toISOString(),
      });

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
        status: "ready",
        sku: existingListing?.sku || allocateNextSku(),
      });
    } else {
      addListing({
        id: uid(),
        ...state,
        status: "ready",
        sku: allocateNextSku(),
        createdAt: new Date().toISOString(),
      });
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
    name: $("#libraryTemplateName"),
    titlePattern: $("#libraryTemplateTitlePattern"),
    description: $("#libraryTemplateDescription"),
    shippingNotes: $("#libraryTemplateShippingNotes"),
    keywords: $("#libraryTemplateKeywords"),
    conditionDisclosure: $("#libraryTemplateConditionDisclosure"),
    measurementsReminder: $("#libraryTemplateMeasurementsReminder"),
  };

  const previewNodes = {
    description: $("#templatePreviewDescription"),
    shipping: $("#templatePreviewShipping"),
    keywords: $("#templatePreviewKeywords"),
    condition: $("#templatePreviewCondition"),
    measurements: $("#templatePreviewMeasurements"),
  };

  const createBtn = $("#createTemplateBtn");
  const saveBtn = $("#saveLibraryTemplateBtn");
  const duplicateBtn = $("#duplicateLibraryTemplateBtn");
  const clearBtn = $("#clearLibraryTemplateBtn");
  const deleteBtn = $("#deleteLibraryTemplateBtn");
  const skuFields = {
    prefix: $("#skuPrefix"),
    nextNumber: $("#skuStartNumber"),
    digits: $("#skuDigits"),
    preview: $("#skuPreviewBadge"),
    status: $("#skuSettingsStatus"),
    saveBtn: $("#saveSkuSettingsBtn"),
    resetBtn: $("#resetSkuSettingsBtn"),
  };
  const libraryStatus = $("#templateLibraryStatus");
  const editorStatus = $("#templateEditorStatus");
  const libraryList = $("#templateLibraryList");
  let selectedTemplateId = "";

  function getEditorTemplate() {
    return buildTemplateRecord({
      id: selectedTemplateId || uid(),
      name: fields.name.value.trim(),
      titlePattern: fields.titlePattern?.value.trim() || "",
      description: fields.description.value.trim(),
      shippingNotes: fields.shippingNotes.value.trim(),
      keywords: fields.keywords.value.trim(),
      conditionDisclosure: fields.conditionDisclosure.value.trim(),
      measurementsReminder: fields.measurementsReminder.value.trim(),
      updatedAt: new Date().toISOString(),
    });
  }

  function fillEditor(template) {
    selectedTemplateId = template?.id || "";
    fields.name.value = template?.name || "";
    if (fields.titlePattern) fields.titlePattern.value = template?.titlePattern || "";
    fields.description.value = template?.description || "";
    fields.shippingNotes.value = template?.shippingNotes || "";
    fields.keywords.value = template?.keywords || "";
    fields.conditionDisclosure.value = template?.conditionDisclosure || "";
    fields.measurementsReminder.value = template?.measurementsReminder || "";
    renderPreview();
  }

  function clearEditor(statusMessage = "") {
    fillEditor(null);
    editorStatus.textContent = statusMessage;
  }

  function renderSkuSettings() {
    const settings = getSkuSettings();
    if (skuFields.prefix) skuFields.prefix.value = settings.prefix;
    if (skuFields.nextNumber) skuFields.nextNumber.value = String(settings.nextNumber);
    if (skuFields.digits) skuFields.digits.value = String(settings.digits);
    if (skuFields.preview) skuFields.preview.textContent = formatCustomSku(settings.nextNumber, settings);
  }

  function getSkuSettingsFromForm() {
    return saveSkuSettings({
      prefix: skuFields.prefix?.value || DEFAULT_SKU_SETTINGS.prefix,
      nextNumber: skuFields.nextNumber?.value || DEFAULT_SKU_SETTINGS.nextNumber,
      digits: skuFields.digits?.value || DEFAULT_SKU_SETTINGS.digits,
    });
  }

  function renderPreview() {
    const template = getEditorTemplate();
    previewNodes.description.textContent = renderTemplateTokens(template.description, TEMPLATE_TOKEN_SAMPLES) || "Add a reusable description block.";
    previewNodes.shipping.textContent = renderTemplateTokens(template.shippingNotes, TEMPLATE_TOKEN_SAMPLES) || "Add reusable shipping notes.";
    previewNodes.keywords.textContent = renderTemplateTokens(template.keywords, TEMPLATE_TOKEN_SAMPLES) || "Add a reusable keyword block.";
    previewNodes.condition.textContent = renderTemplateTokens(template.conditionDisclosure, TEMPLATE_TOKEN_SAMPLES) || "Optional condition disclosure appears here.";
    previewNodes.measurements.textContent = renderTemplateTokens(template.measurementsReminder, TEMPLATE_TOKEN_SAMPLES) || "Optional measurements reminder appears here.";
  }

  function renderLibrary() {
    const templates = getTemplates();
    libraryList.innerHTML = "";

    if (!templates.length) {
      libraryList.innerHTML = `<div class="saved-template-empty">No templates saved yet. Create 1 here, then use Apply Template on <a href="new-listing.html">Create Listing</a> when you start a new item.</div>`;
      return;
    }

    templates.forEach((template) => {
      const card = document.createElement("article");
      card.className = `saved-template-card template-library-card${template.id === selectedTemplateId ? " is-active" : ""}`;
      card.innerHTML = `
        <div class="saved-template-card__header">
          <div>
            <p class="saved-template-card__name mb-1">${escapeHtml(template.name || "Untitled Template")}</p>
            <p class="saved-template-card__meta mb-0">Updated ${escapeHtml(formatDate(template.updatedAt))}</p>
          </div>
          <span class="dashboard-sku">Template</span>
        </div>
        <pre class="saved-template-card__preview">${escapeHtml(renderTemplateTokens(template.titlePattern || template.description, TEMPLATE_TOKEN_SAMPLES) || "No preview yet.")}</pre>
        <div class="saved-template-card__actions">
          <button class="btn btn-outline-secondary btn-sm" type="button" data-edit-template="${escapeHtml(template.id)}">Edit</button>
          <button class="btn btn-outline-secondary btn-sm" type="button" data-duplicate-template="${escapeHtml(template.id)}">Duplicate</button>
          <button class="btn btn-outline-danger btn-sm" type="button" data-delete-template="${escapeHtml(template.id)}">Delete</button>
        </div>
      `;

      card.querySelector("[data-edit-template]").addEventListener("click", () => {
        fillEditor(template);
        renderLibrary();
        libraryStatus.textContent = `${template.name || "Template"} loaded into the editor.`;
      });

      card.querySelector("[data-duplicate-template]").addEventListener("click", () => {
        const duplicate = duplicateTemplate(template.id);
        renderLibrary();
        if (duplicate) {
          fillEditor(duplicate);
          renderLibrary();
          libraryStatus.textContent = `${duplicate.name} created.`;
        }
      });

      card.querySelector("[data-delete-template]").addEventListener("click", () => {
        removeTemplate(template.id);
        if (selectedTemplateId === template.id) clearEditor();
        renderLibrary();
        libraryStatus.textContent = "Template deleted.";
      });

      libraryList.appendChild(card);
    });
  }

  Object.values(fields).forEach((field) => {
    field.addEventListener("input", renderPreview);
    field.addEventListener("change", renderPreview);
  });

  createBtn?.addEventListener("click", () => {
    clearEditor("New template started.");
    libraryStatus.textContent = "";
  });

  saveBtn?.addEventListener("click", () => {
    const template = getEditorTemplate();
    if (!template.name) {
      editorStatus.textContent = "Template name is required.";
      return;
    }
    upsertTemplate(template);
    selectedTemplateId = template.id;
    renderLibrary();
    editorStatus.textContent = "Template saved.";
  });

  duplicateBtn?.addEventListener("click", () => {
    if (selectedTemplateId) {
      const duplicate = duplicateTemplate(selectedTemplateId);
      renderLibrary();
      if (duplicate) {
        fillEditor(duplicate);
        renderLibrary();
        editorStatus.textContent = "Template duplicated.";
      }
      return;
    }

    const draftTemplate = getEditorTemplate();
    if (!draftTemplate.name) {
      editorStatus.textContent = "Save or name the template before duplicating it.";
      return;
    }
    draftTemplate.id = uid();
    draftTemplate.name = `${draftTemplate.name} Copy`;
    upsertTemplate(draftTemplate);
    fillEditor(draftTemplate);
    renderLibrary();
    editorStatus.textContent = "Template duplicated.";
  });

  clearBtn?.addEventListener("click", () => {
    clearEditor("Editor cleared.");
  });

  deleteBtn?.addEventListener("click", () => {
    if (!selectedTemplateId) {
      editorStatus.textContent = "Select a saved template before deleting it.";
      return;
    }
    removeTemplate(selectedTemplateId);
    clearEditor("Template deleted.");
    renderLibrary();
  });

  document.querySelectorAll(".template-preview-copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.getAttribute("data-copy-target"));
      const ok = await copyText(target?.textContent || "");
      editorStatus.textContent = ok ? "Preview block copied." : "Copy failed. Select and copy manually.";
    });
  });

  if (skuFields.saveBtn) {
    skuFields.saveBtn.addEventListener("click", () => {
      const settings = getSkuSettingsFromForm();
      renderSkuSettings();
      skuFields.status.textContent = `SKU settings saved. Next SKU: ${formatCustomSku(settings.nextNumber, settings)}.`;
    });
  }

  if (skuFields.resetBtn) {
    skuFields.resetBtn.addEventListener("click", () => {
      saveSkuSettings(DEFAULT_SKU_SETTINGS);
      renderSkuSettings();
      skuFields.status.textContent = "SKU settings reset to the Listing Lab default sequence.";
    });
  }

  [skuFields.prefix, skuFields.nextNumber, skuFields.digits].forEach((field) => {
    if (!field) return;
    field.addEventListener("input", () => {
      const previewSettings = {
        prefix: skuFields.prefix?.value || DEFAULT_SKU_SETTINGS.prefix,
        nextNumber: skuFields.nextNumber?.value || DEFAULT_SKU_SETTINGS.nextNumber,
        digits: skuFields.digits?.value || DEFAULT_SKU_SETTINGS.digits,
      };
      if (skuFields.preview) skuFields.preview.textContent = formatCustomSku(previewSettings.nextNumber, previewSettings);
    });
  });

  const initialTemplates = getTemplates();
  if (initialTemplates.length) {
    fillEditor(initialTemplates[0]);
  } else {
    clearEditor();
  }
  renderSkuSettings();
  renderLibrary();
  renderPreview();
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
    { label: "Formula pricing helper", ok: typeof getSuggestedRange === "function" },
    { label: "eBay comps support", ok: ENABLE_LIVE_EBAY_COMPS || ENABLE_DEMO_EBAY_COMPS },
    { label: "Smart templates workspace", ok: true },
    { label: "Local draft and listing storage", ok: typeof localStorage !== "undefined" },
    { label: "Dashboard export tools", ok: typeof exportCSV === "function" },
  ];

  const list = $("#featureStatusList");
  list.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "border rounded p-2 d-flex justify-content-between align-items-center";
    row.innerHTML = `<span>${escapeHtml(item.label)}</span><span class="${item.ok ? "text-success" : "text-danger"} fw-semibold">${item.ok ? "Active" : "Off"}</span>`;
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
    const templateCount = getTemplates().length;
    const draft = loadDraft();
    const listings = getListings();
    const rows = [
      { label: "Create Listing -> Dashboard", value: listings.length ? `${listings.length} saved listing${listings.length === 1 ? "" : "s"}` : "No saved listings yet" },
      { label: "Draft recovery in Create Listing", value: draft ? "Draft found" : "No active draft" },
      { label: "Smart Templates -> Create Listing", value: templateCount ? `${templateCount} saved template${templateCount === 1 ? "" : "s"}` : "No saved templates yet" },
      { label: "Pricing helper in Create Listing", value: "Included" },
      { label: "Dashboard export tools", value: listings.length ? "Included" : "Shown once listings are saved" },
      { label: "Local browser storage", value: typeof localStorage !== "undefined" ? "Active" : "Off" },
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
    status.textContent = "Integrations refreshed. Local saving, templates, pricing, and dashboard handoff are active in this browser.";
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
      : `<p class="mb-1">This dashboard is your local resale workspace.</p><p class="mb-0">Use it to track drafts, organize listings, and export prep-ready inventory.</p><a class="btn btn-dark mt-2" href="new-listing.html">Create a Listing</a>`;
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
