const STORAGE_KEYS = {
  listings: "listingLab:listings:v2",
  inventoryBackups: "listingLab:inventoryBackups:v1",
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
  "tops": [
    "tops shirts"
  ],
  "sweaters": [
    "sweaters knitwear"
  ],
  "bottoms": [
    "pants leggings"
  ],
  "jeans": [
    "jeans"
  ],
  "shorts": [
    "shorts"
  ],
  "skirts": [
    "skirts"
  ],
  "dresses": [
    "dresses"
  ],
  "jumpsuits": [
    "jumpsuits rompers"
  ],
  "outerwear": [
    "coats jackets"
  ],
  "suits": [
    "suits matching sets"
  ],
  "activewear": [
    "activewear"
  ],
  "swimwear": [
    "swimwear"
  ],
  "intimates": [
    "intimates underwear"
  ],
  "sleepwear": [
    "sleepwear loungewear"
  ],
  "shoes": [
    "shoes boots"
  ],
  "bags": [
    "bags wallets"
  ],
  "accessories": [
    "accessories"
  ],
  "jewelry": [
    "jewelry watches"
  ]
};

const CONDITION_SEARCH_TERMS = {
  new: ["new", "nwt"],
  "like-new": ["like new", "excellent condition"],
  good: ["preowned", "good condition"],
  fair: ["as is", "well loved"],
};

const DEFAULT_SKU_SETTINGS = {
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
  return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
}

function getInventoryBackups() {
  const backups = safeJsonParse(safeStorageGet(STORAGE_KEYS.inventoryBackups), []);
  return Array.isArray(backups) ? backups.filter((entry) => entry && typeof entry.raw === "string") : [];
}

function preserveInventoryBackup(raw = safeStorageGet(STORAGE_KEYS.listings)) {
  if (!raw || raw === "[]") return true;
  const backups = getInventoryBackups();
  if (backups[0]?.raw === raw) return true;
  backups.unshift({ raw, savedAt: new Date().toISOString() });
  return safeStorageSet(STORAGE_KEYS.inventoryBackups, JSON.stringify(backups.slice(0, 5)));
}

function saveListings(listings) {
  // Keep the previous records before any edit, deletion or replacement.
  if (!preserveInventoryBackup()) return false;
  return safeStorageSet(STORAGE_KEYS.listings, JSON.stringify(listings));
}

function mergeInventoryRecords(current, incoming) {
  const merged = [...current];
  const ids = new Set(current.map((item) => item.id));
  const skus = new Set(current.map((item) => normalize(getListingSku(item))));
  let added = 0;
  let skipped = 0;
  incoming.forEach((item) => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id ||
        (!item.itemName && !item.brand) || ids.has(item.id) || skus.has(normalize(getListingSku(item)))) {
      skipped++;
      return;
    }
    merged.push(item);
    ids.add(item.id);
    skus.add(normalize(getListingSku(item)));
    added++;
  });
  return { listings: merged, added, skipped };
}

function getRecoverableInventory() {
  const candidates = getInventoryBackups().flatMap((backup) => {
    const records = safeJsonParse(backup.raw, []);
    return Array.isArray(records) ? records : [];
  });
  const legacy = safeJsonParse(safeStorageGet("listingLab:listings:v1"), []);
  if (Array.isArray(legacy)) candidates.push(...legacy);
  // An editing draft may be the last surviving copy of a saved inventory item.
  getDraftQueue().filter((draft) => draft.__editingId && (draft.itemName || draft.brand)).forEach((draft) => {
    candidates.push({ ...draft, id: draft.__editingId });
  });
  return candidates;
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
  return saveListings(listings);
}

function removeListing(id) {
  const listings = getListings().filter((listing) => listing.id !== id);
  return saveListings(listings);
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
  return saveListings(listings);
}

function getListingById(id) {
  return getListings().find((listing) => listing.id === id);
}

function getSkuSettings() {
  const raw = safeStorageGet(STORAGE_KEYS.skuSettings);
  const parsed = raw ? safeJsonParse(raw, DEFAULT_SKU_SETTINGS) : DEFAULT_SKU_SETTINGS;
  return {
    nextNumber: Math.max(1, Number.parseInt(parsed?.nextNumber, 10) || DEFAULT_SKU_SETTINGS.nextNumber),
    digits: Math.min(8, Math.max(1, Number.parseInt(parsed?.digits, 10) || DEFAULT_SKU_SETTINGS.digits)),
  };
}

function saveSkuSettings(settings) {
  const next = {
    nextNumber: Math.max(1, Number.parseInt(settings?.nextNumber, 10) || DEFAULT_SKU_SETTINGS.nextNumber),
    digits: Math.min(8, Math.max(1, Number.parseInt(settings?.digits, 10) || DEFAULT_SKU_SETTINGS.digits)),
  };
  return safeStorageSet(STORAGE_KEYS.skuSettings, JSON.stringify(next)) ? next : null;
}

function formatCustomSku(number, settings = getSkuSettings()) {
  const digits = Math.min(8, Math.max(1, Number.parseInt(settings.digits, 10) || DEFAULT_SKU_SETTINGS.digits));
  const nextNumber = Math.max(1, Number.parseInt(number, 10) || 1);
  return String(nextNumber).padStart(digits, "0");
}

function allocateNextSku() {
  const settings = getSkuSettings();
  const used = new Set(getListings().map((listing) => normalize(getListingSku(listing))).filter(Boolean));
  while (used.has(normalize(formatCustomSku(settings.nextNumber, settings)))) settings.nextNumber++;
  const sku = formatCustomSku(settings.nextNumber, settings);
  const saved = saveSkuSettings({ ...settings, nextNumber: settings.nextNumber + 1 });
  return saved ? sku : null;
}

function isSkuAvailable(sku, editingId = "") {
  return !getListings().some((listing) => listing.id !== editingId && normalize(getListingSku(listing)) === normalize(sku));
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
    itemName: listing.itemName || "",
    __draftId: uid(),
    status: "draft",
    sku: allocateNextSku(),
    createdAt: now,
    updatedAt: now,
  };
  if (!duplicate.sku) return null;
  return addListing(duplicate) ? duplicate : null;
}

function getTemplates() {
  const raw = safeStorageGet(STORAGE_KEYS.templates);
  if (!raw) return [];
  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed.filter((template) => template && typeof template === "object").map((template) => buildTemplateRecord(template)) : [];
}

function saveTemplates(templates) {
  return safeStorageSet(STORAGE_KEYS.templates, JSON.stringify(templates));
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
  return saveTemplates(templates);
}

function removeTemplate(id) {
  const templates = getTemplates().filter((template) => template.id !== id);
  return saveTemplates(templates);
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
  return upsertTemplate(duplicate) ? duplicate : null;
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

  const legacyTokens = { "item name": "itemName", brand: "brand", category: "category",
    condition: "condition", price: "price", measurements: "measurements", flaws: "flaws" };
  const normalizedText = String(text || "").split(/(\{\{\s*\w+\s*\}\}|\{\w+\})/g)
    .map((part) => part.startsWith("{") ? part : part.replace(
      /\b(Item Name|Brand|Category|Condition|Price|Measurements|Flaws)\b/g,
      (match) => `{{${legacyTokens[match.toLowerCase()]}}}`
    )).join("");

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
    if (nextDraft.__draftId && item.__draftId) return item.__draftId !== nextDraft.__draftId;
    return !(normalize(item.itemName) === normalize(nextDraft.itemName)
      && normalize(item.brand) === normalize(nextDraft.brand)
      && normalize(item.category) === normalize(nextDraft.category)
      && normalize(item.condition) === normalize(nextDraft.condition)
      && String(item.price || "") === String(nextDraft.price || ""));
  });

  queue.unshift(nextDraft);
  if (!safeStorageSet(STORAGE_KEYS.draft, JSON.stringify(queue.slice(0, 10)))) return false;
  safeStorageSet(STORAGE_KEYS.draftCursor, "0");
  return true;
}

function getDraftQueue() {
  const raw = safeStorageGet(STORAGE_KEYS.draft);
  if (!raw) return [];

  const parsed = safeJsonParse(raw, null);
  if (Array.isArray(parsed)) return parsed.filter((item) => item && typeof item === "object" && !Array.isArray(item));
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
    poshmark: `https://poshmark.com/search?query=${encoded}&availability=sold_out`,
    googlePoshmark: `https://www.google.com/search?q=${encodeURIComponent(`site:poshmark.com/listing/ ${query} "sold"`)}`,
    googleEbay: `https://www.google.com/search?q=${encodeURIComponent(`site:ebay.com/itm/ ${query} "sold"`)}`,
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
  "shoes": "Shoes",
  "bags": "Handbags & Bags",
  "tops": "Tops & Sweaters",
  "bottoms": "Pants & Jeans",
  "shorts": "Shorts",
  "skirts": "Skirts",
  "dresses": "Dresses & Jumpsuits",
  "outerwear": "Jackets, Coats & Blazers",
  "activewear": "Activewear & Swimwear",
  "jewelry": "Jewelry & Watches",
  "accessories": "Accessories",
  "other": "Other / Miscellaneous",
  "sweaters": "Tops & Sweaters",
  "jeans": "Pants & Jeans",
  "jumpsuits": "Dresses & Jumpsuits",
  "swimwear": "Activewear & Swimwear",
  "suits": "Suits & Matching Sets",
  "intimates": "Intimates & Underwear",
  "sleepwear": "Sleepwear & Loungewear"
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

function additionalDetailLines(listing) {
  return [["Product type", listing.productType || listing.itemType], ["Style / model", listing.styleModel],
    ["Key features", listing.keyFeatures], ["Color", listing.color], ["Material", listing.material],
    ["Gender / department", listing.gender], ["Tagged size", listing.size]]
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`);
}

function buildListingTitle(listing) {
  const enteredTitle = String(listing.itemName || "").trim();
  if (enteredTitle) return enteredTitle;
  return [listing.brand, listing.productType || listing.itemType, listing.styleModel, listing.keyFeatures,
    listing.color, listing.gender, listing.size ? `Size ${listing.size}` : ""]
    .filter(Boolean).join(" ").trim() || "Untitled item";
}

function composeListingDescription(listing) {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const brand = clean(listing.brand);
  const product = clean(listing.productType || listing.itemType);
  const model = clean(listing.styleModel);
  const title = clean(listing.itemName);
  const color = clean(listing.color);
  const size = clean(listing.size);
  const material = clean(listing.material);
  let subject = product ? [brand, product].filter(Boolean).join(" ") : title || (brand ? `${brand} item` : "");
  if (!subject && !color && !size && !material && !listing.condition && !listing.keyFeatures) return "";
  if (!subject) subject = "This item";
  if (model && !normalize(subject).includes(normalize(model))) subject += ` (${model})`;
  if (color && !normalize(subject).includes(normalize(color))) subject += ` in ${color}`;
  const sentences = [subject.replace(/[.!?]+$/, "") + "."];
  const department = clean(listing.gender);
  if (size) sentences.push(`Tagged as size ${size}${department ? ` in ${department.toLowerCase()} sizing` : ""}.`);
  else if (department) sentences.push(`Listed in the ${department.toLowerCase()} department.`);
  if (material) sentences.push(`Made from ${material}.`);
  const features = [];
  clean(listing.keyFeatures).split(/[,;]+/).map(clean).filter(Boolean).forEach((feature) => pushUnique(features, feature));
  (listing.researchTerms || []).forEach((term) => {
    const value = clean(term);
    if (value && !normalize([subject, material, size].join(" ")).includes(normalize(value))) pushUnique(features, value);
  });
  if (features.length) {
    const joined = features.length < 2 ? features[0] : `${features.slice(0, -1).join(", ")} and ${features[features.length - 1]}`;
    sentences.push(`Features include ${joined.replace(/[.!?]+$/, "")}.`);
  }
  const conditions = {
    new: "New and unused.",
    "like-new": "In like-new condition.",
    good: "In good pre-owned condition.",
    fair: "In fair pre-owned condition.",
  };
  if (conditions[listing.condition]) sentences.push(conditions[listing.condition]);
  return sentences.join(" ");
}

function buildMarketplaceDescription(listing) {
  // The editable description is the buyer-facing copy, not an attribute dump.
  return String(listing.notes || "").trim() || composeListingDescription(listing);
}

function getMarketplaceMap(listing) {
  const title = clampTitle(buildListingTitle(listing), 80);
  const description = buildMarketplaceDescription(listing)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  const priceValue = Number(listing.price);
  const price = Number.isFinite(priceValue) && priceValue > 0 ? priceValue.toFixed(2) : "";
  const styleTags = [];
  const excluded = [listing.brand, listing.color, listing.itemName, listing.productType, listing.size, listing.gender].map(normalize);
  [listing.keyFeatures, ...(listing.researchTerms || []), listing.material, listing.hashtags || ""]
    .join(",").split(/[,;]+/).map((tag) => tag.trim().replace(/^#+/, ""))
    .filter((tag) => tag && tag.length <= 25 && /^[a-z0-9 '&-]+$/i.test(tag) && !excluded.includes(normalize(tag)))
    .forEach((tag) => pushUnique(styleTags, tag));
  const common = {
    title, description, brand: listing.brand || "", size: listing.size || "",
    color: listing.color || "", material: listing.material || "", department: listing.gender || "",
    sku: listing.sku || (listing.id ? getListingSku(listing) : ""), category: listing.category ? prettyCategory(listing.category) : "",
    condition: listing.condition ? prettyCondition(listing.condition) : "", keywords: listing.keywords || "", hashtags: listing.hashtags || "",
    listingPrice: price, price,
  };
  return {
    flyp: { ...common, tags: listing.hashtags || "" },
    ebay: { ...common, format: "Buy It Now", quantity: "1", conditionId: "", categoryId: "" },
    poshmark: {
      ...common, description: description.slice(0, 1500),
      listingPrice: price ? String(Math.max(1, Math.round(priceValue))) : "",
      originalPrice: Number(listing.originalPrice) > 0 ? String(Math.round(Number(listing.originalPrice))) : "",
      // Poshmark's condition field uses NWT/Boutique, not generic used-condition ratings.
      condition: listing.newWithTags === true ? "NWT" : "",
      styleTags: styleTags.slice(0, 3), availability: "Draft", quantity: "1",
    },
  };
}

function marketplaceFormFields(listing, platform) {
  const target = getMarketplaceMap(listing)[platform] || getMarketplaceMap(listing).flyp;
  const fields = {
    "Title": target.title,
    "Description": target.description,
    [platform === "ebay" ? "Price" : "Listing Price"]: target.listingPrice,
    [platform === "ebay" ? "Custom label (SKU)" : "SKU"]: target.sku, "Brand": target.brand, "Size": target.size,
    "Color": target.color, "Material": target.material, "Department": target.department,
    "Category reference": target.category,
  };
  if (platform === "poshmark") {
    Object.assign(fields, { "Condition": target.condition, "Original Price": target.originalPrice,
      "Quantity": target.quantity, "Availability": target.availability,
      "Style Tag 1": target.styleTags[0] || "", "Style Tag 2": target.styleTags[1] || "", "Style Tag 3": target.styleTags[2] || "" });
  } else {
    fields.Condition = target.condition;
    if (platform === "ebay") Object.assign(fields, { "Format": target.format, "Quantity": target.quantity });
    else fields.Tags = target.tags;
  }
  return fields;
}

function marketplaceFormSummary(listing, platform) {
  return Object.entries(marketplaceFormFields(listing, platform)).filter(([, value]) => value !== "")
    .map(([label, value]) => `${label}: ${value}`).join("\n\n");
}

function marketplaceExportIssues(listing, platform) {
  const full = getMarketplaceMap(listing).flyp;
  const issues = [];
  if (buildListingTitle(listing).length > 80) issues.push("Title shortened to 80 characters.");
  if (platform === "poshmark") {
    if (full.description.length > 1500) issues.push("Description shortened to 1,500 characters. Review before copying.");
    if (Number(full.listingPrice) % 1) issues.push(`Poshmark price rounded to $${getMarketplaceMap(listing).poshmark.listingPrice}.`);
    if (full.sku && !/^[a-z0-9-]+$/i.test(full.sku)) issues.push("Poshmark SKUs use letters, numbers and hyphens. Adjust this SKU in the listing form.");
  }
  if (platform === "ebay" && full.sku.length > 50) issues.push("eBay SKUs allow 50 characters. Shorten this SKU in the listing form.");
  return issues;
}

function downloadExportFile(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function marketplaceCSV(listings, platform) {
  const rows = listings.map((listing) => marketplaceFormFields(listing, platform));
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const cell = (value) => {
    const text = String(value ?? "");
    const safe = /^[=+@-]/.test(text) ? "'" + text : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [headers.map(cell).join(","), ...rows.map((row) => headers.map((header) => cell(row[header])).join(","))].join("\r\n");
}

function buildExportSummary(listing) {
  const lines = [];

  if (listing.itemName || additionalDetailLines(listing).length) lines.push(`Title: ${buildListingTitle(listing)}`);
  if (listing.brand) lines.push(`Brand: ${listing.brand}`);
  if (listing.sku) lines.push(`SKU: ${listing.sku}`);
  lines.push(...additionalDetailLines(listing));
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
    lines.push(`Tags: ${listing.hashtags}`);
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

function exportCSV(listings, platform = "inventory") {
  if (!Array.isArray(listings) || !listings.length) return;
  if (platform === "spreadsheet") {
    downloadExportFile("\ufeff" + resellerSpreadsheetCSV(listings), "listing-lab-reseller-overview.csv", "text/csv;charset=utf-8");
    return;
  }
  if (["flyp", "poshmark", "ebay"].includes(platform)) {
    downloadExportFile("\ufeff" + marketplaceCSV(listings, platform), `listing-lab-${platform}-form-fields.csv`, "text/csv;charset=utf-8");
    return;
  }

  const headers = [
    "id", "sku", "itemName", "brand", "category", "condition", "status", "price", "notes", "keywords", "hashtags", "createdAt", "updatedAt",
    "itemType", "productType", "styleModel", "keyFeatures", "color", "material", "gender", "size",
    "purchasePrice", "minSale", "targetPrice", "targetNetMargin", "minimumProfit", "targetProfit", "offerRoomPct", "mileage", "mileageCost", "estimatedNetProfit",
    "ebay_title", "ebay_category", "ebay_condition", "ebay_price", "ebay_description", "ebay_keywords", "ebay_hashtags",
    "poshmark_title", "poshmark_category", "poshmark_condition", "poshmark_price", "poshmark_description", "poshmark_keywords", "poshmark_hashtags",
    "flyp_title", "flyp_category", "flyp_condition", "flyp_price", "flyp_description", "flyp_keywords", "flyp_hashtags",
  ];
  const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rowForListing = (listing) => {
    const map = getMarketplaceMap(listing);
    const merged = {
      ...listing,
      sku: getListingSku(listing),
      purchasePrice: listing.pricingPlan?.inputs.cogs ?? listing.purchasePrice ?? "",
      minSale: listing.pricingPlan?.minSale ?? "", targetPrice: listing.pricingPlan?.targetPrice ?? "",
      targetNetMargin: listing.pricingPlan?.inputs.targetMarginPct ?? "", minimumProfit: listing.pricingPlan?.inputs.minimumProfit ?? "",
      targetProfit: listing.pricingPlan?.inputs.targetProfit ?? "", offerRoomPct: listing.pricingPlan?.inputs.offerRoomPct ?? "",
      mileage: listing.pricingPlan?.inputs.mileage ?? "", mileageCost: listing.pricingPlan?.mileageCost ?? "",
      estimatedNetProfit: listing.pricingPlan?.netProfit ?? "",
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

function exportJSON(listings, platform = "inventory") {
  if (!Array.isArray(listings) || !listings.length) return;
  if (platform === "spreadsheet") {
    downloadExportFile(JSON.stringify(listings.map(resellerSpreadsheetRow), null, 2), "listing-lab-reseller-overview.json", "application/json;charset=utf-8");
    return;
  }
  if (["flyp", "poshmark", "ebay"].includes(platform)) {
    downloadExportFile(JSON.stringify(listings.map((listing) => marketplaceFormFields(listing, platform)), null, 2),
      `listing-lab-${platform}-form-fields.json`, "application/json;charset=utf-8");
    return;
  }
  const blob = new Blob([JSON.stringify(listings, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "listing-lab-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

const PHOTOGRAPHY_CATEGORIES = {
  "shoes": {
    "label": "Shoes",
    "count": "8\u201312",
    "shots": [
      "Pair together (main/cover photo)",
      "Outer side views (both shoes)",
      "Inner side views",
      "Front/toe view",
      "Back/heel view",
      "Top view",
      "Bottom/sole and tread",
      "Brand, size, and style labels",
      "Close-ups of materials and details",
      "Any flaws or wear",
      "Original box (if included)"
    ]
  },
  "bags": {
    "label": "Handbags & Bags",
    "count": "8\u201312",
    "shots": [
      "Front (main/cover photo)",
      "Back",
      "Both sides",
      "Top and bottom",
      "Interior and compartments",
      "Handles and straps",
      "Brand logo and authenticity markings",
      "Hardware, zippers, and closures",
      "Corners and edges",
      "Material and texture",
      "Any flaws or wear",
      "Dust bag or accessories (if included)"
    ]
  },
  "tops": {
    "label": "Tops & Sweaters",
    "count": "6\u201310",
    "shots": [
      "Front (main/cover photo)",
      "Back",
      "Side or sleeve view",
      "Neckline and collar",
      "Cuffs and hem",
      "Fabric texture and details",
      "Brand and size tags",
      "Material/care label",
      "Any flaws or wear",
      "Measurements (if applicable)"
    ]
  },
  "bottoms": {
    "label": "Pants & Jeans",
    "count": "6\u201310",
    "shots": [
      "Front, full length (main/cover photo)",
      "Back, full length",
      "Waistband and closure",
      "Front and back pockets",
      "Leg openings and hems",
      "Fabric texture",
      "Brand and size tags",
      "Material/care label",
      "Any flaws or wear",
      "Measurements (waist, rise, inseam, etc.)"
    ]
  },
  "shorts": {
    "label": "Shorts",
    "count": "6\u20138",
    "shots": [
      "Front (main/cover photo)",
      "Back",
      "Waistband and closure",
      "Pockets",
      "Leg openings",
      "Fabric details",
      "Brand and size tags",
      "Any flaws or wear",
      "Measurements (waist, rise, inseam)"
    ]
  },
  "skirts": {
    "label": "Skirts",
    "count": "6\u20138",
    "shots": [
      "Front (main/cover photo)",
      "Back",
      "Side view",
      "Waistband and closure",
      "Hem and lining",
      "Fabric texture and details",
      "Brand and size tags",
      "Any flaws or wear",
      "Measurements (waist, hips, length)"
    ]
  },
  "dresses": {
    "label": "Dresses & Jumpsuits",
    "count": "6\u201310",
    "shots": [
      "Front, full length (main/cover photo)",
      "Back, full length",
      "Side view",
      "Neckline and straps/sleeves",
      "Waist and design details",
      "Zippers, buttons, and closures",
      "Fabric texture",
      "Brand and size tags",
      "Any flaws or wear",
      "Measurements (bust, waist, hips, length)"
    ]
  },
  "outerwear": {
    "label": "Jackets, Coats & Blazers",
    "count": "8\u201312",
    "shots": [
      "Front (main/cover photo)",
      "Back",
      "Side view",
      "Front open (if applicable)",
      "Interior and lining",
      "Collar, hood, and cuffs",
      "Buttons, zippers, and pockets",
      "Brand and size tags",
      "Material/care label",
      "Close-ups of features",
      "Any flaws or wear",
      "Measurements (chest, length, sleeves)"
    ]
  },
  "activewear": {
    "label": "Activewear & Swimwear",
    "count": "6\u201310",
    "shots": [
      "Front (main/cover photo)",
      "Back",
      "Side view",
      "Waistband, straps, or closures",
      "Lining and padding (if applicable)",
      "Stretch/material details",
      "Brand and size tags",
      "Hygiene liner (if applicable)",
      "Any flaws or wear",
      "Measurements (if applicable)"
    ]
  },
  "jewelry": {
    "label": "Jewelry & Watches",
    "count": "6\u201310",
    "shots": [
      "Front/main view (cover photo)",
      "Back",
      "Side/profile view",
      "Clasps, fasteners, or closures",
      "Brand markings and hallmarks",
      "Material and decorative details",
      "Watch face and caseback (if applicable)",
      "Size/length reference",
      "Any flaws or wear",
      "Original box or accessories (if included)"
    ]
  },
  "accessories": {
    "label": "Accessories",
    "count": "6\u201310",
    "shots": [
      "Front/main view (cover photo)",
      "Back",
      "Side/profile view (if applicable)",
      "Interior (if applicable)",
      "Closures and hardware",
      "Brand logo and labels",
      "Material and texture",
      "Size/measurement reference",
      "Any flaws or wear",
      "Packaging or accessories (if included)"
    ]
  },
  "other": {
    "label": "Other / Miscellaneous",
    "count": "6\u201310",
    "shots": [
      "Front/main view (cover photo)",
      "Back",
      "Left and right sides",
      "Top and bottom (if applicable)",
      "Important features and details",
      "Brand/manufacturer label",
      "Model number, size, or specifications",
      "Material and texture",
      "Any flaws, wear, or damage",
      "Packaging and included accessories"
    ]
  }
};
const LEGACY_PHOTO_CATEGORIES = {
  sweaters: "tops", jeans: "bottoms", jumpsuits: "dresses", swimwear: "activewear",
  suits: "other", intimates: "other", sleepwear: "other",
};

function updatePhotoGuidance(category, preparation) {
  const guide = PHOTOGRAPHY_CATEGORIES[category];
  const summary = $("#photoGuidanceSummary");
  const summaryText = guide ? `${guide.label}: ${guide.count} photos recommended.` : "Choose a photography category to build your shot list.";
  if (summary.textContent !== summaryText) summary.textContent = summaryText;
  const container = $("#photoRequirementList");
  const custom = preparation.additionalShots || [];
  const shots = guide ? [...guide.shots, ...custom] : [];
  const renderKey = JSON.stringify([category, custom]);
  const updateProgress = () => {
    const done = shots.filter((shot, index) => preparation.completed[`${category}:${index}:${shot}`]).length;
    $("#photoCompletion").textContent = guide ? `${done} of ${shots.length} requirements complete` : "No category selected";
  };
  if (container.dataset.renderKey !== renderKey) {
    container.replaceChildren();
    shots.forEach((shot, index) => {
      const key = `${category}:${index}:${shot}`;
      const label = document.createElement("label");
      label.className = "photo-requirement";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "form-check-input";
      checkbox.checked = Boolean(preparation.completed[key]);
      checkbox.addEventListener("change", () => {
        preparation.completed[key] = checkbox.checked;
        updateProgress();
      });
      const text = document.createElement("span");
      text.textContent = index >= guide.shots.length ? `Additional: ${shot}` : shot;
      label.append(checkbox, text);
      container.append(label);
    });
    container.dataset.renderKey = renderKey;
  }
  updateProgress();
  $("#customItemTypeGroup").hidden = category !== "other";
  $("#addPhotoShotBtn").disabled = !guide;
}

// Suggestions use seller-confirmed attributes, not inferred trends or search volumes.
function buildSearchSuggestions(state) {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const brand = clean(state.brand);
  const categoryProducts = {
    shoes: "shoes", bags: "bag", tops: "top", bottoms: "pants", shorts: "shorts",
    skirts: "skirt", dresses: "dress", outerwear: "outerwear", activewear: "activewear",
    jewelry: "jewelry", accessories: "accessory",
  };
  const product = clean(state.productType || state.itemType || categoryProducts[state.category]);
  const model = clean(state.styleModel);
  const color = clean(state.color);
  const material = clean(state.material);
  const gender = clean(state.gender);
  const size = clean(state.size);
  const features = clean(state.keyFeatures).split(/[,;]+/).map(clean).filter(Boolean);
  const keywords = [];
  const seen = new Set();
  const add = (...parts) => {
    const phrase = parts.filter(Boolean).join(" ");
    const key = phrase.toLowerCase();
    if (!phrase || seen.has(key)) return;
    seen.add(key);
    keywords.push(phrase);
  };
  (state.researchTerms || []).forEach((term) => add(term));
  add(clean(state.itemName));
  add(brand, product, model);
  if (product) {
    if (gender || size) add(gender, product, size ? `size ${size}` : "");
    if (color) add(color, product);
    if (material) add(material, product);
    features.forEach((feature) => add(feature, product));
    add(brand, product);
    if (model) add(model, product);
    if (color) add(brand, color, product);
    if (material) add(brand, material, product);
    if (gender) add(brand, gender, product);
    if (size) add(brand, product, `size ${size}`);
    if (color && material) add(color, material, product);
    if (color && gender) add(gender, color, product);
    features.forEach((feature) => {
      add(brand, feature, product);
      if (color) add(color, feature, product);
      if (material) add(material, feature, product);
      if (gender) add(gender, feature, product);
    });
    const attributes = [color, material, gender, model, ...features].filter(Boolean);
    attributes.forEach((attribute, index) => {
      if (size) add(attribute, product, `size ${size}`);
      attributes.slice(index + 1).forEach((other) => add(attribute, other, product));
    });
    if (model && size) add(brand, model, product, `size ${size}`);
    add(product);
  }
  [brand, model, material, ...features].forEach((value) => add(value));
  const tags = [];
  [brand, product, model, color, material, gender, ...(state.researchTerms || []), ...features,
    size ? `size ${size}` : "",
    ...keywords,
  ].forEach((value) => {
    const tag = clean(value).replace(/^#+/, "");
    if (tag && !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  });
  return { keywords: keywords.slice(0, 60), hashtags: tags.slice(0, 36).join(", ") };
}

function buildGeneralResearchQuery(state) {
  const defaults = { shoes: "shoes", bags: "bag", tops: "top", bottoms: "pants", shorts: "shorts", skirts: "skirt",
    dresses: "dress", outerwear: "jacket", activewear: "activewear", jewelry: "jewelry", accessories: "accessories" };
  const types = {
    shoes: /\b(sneakers?|trainers?|boots?|sandals?|heels?|loafers?|flats?|shoes?)\b/i,
    bags: /\b(handbags?|backpacks?|totes?|satchels?|bags?)\b/i,
    tops: /\b(sweaters?|cardigans?|hoodies?|sweatshirts?|blouses?|t-shirts?|shirts?|tops?)\b/i,
    bottoms: /\b(jeans|leggings|trousers|pants)\b/i,
    shorts: /\bshorts\b/i, skirts: /\bskirts?\b/i,
    dresses: /\b(dresses|dress|jumpsuits?|rompers?)\b/i,
    outerwear: /\b(jackets?|coats?|blazers?|vests?)\b/i,
    activewear: /\b(leggings|swimsuits?|bikinis?|swimwear|activewear|sports bras?)\b/i,
    jewelry: /\b(watches|watch|necklaces?|bracelets?|earrings?|rings?|jewelry)\b/i,
    accessories: /\b(belts?|scarves|scarf|hats?|sunglasses|wallets?|accessories)\b/i,
  };
  const title = String(state.itemName || "").trim();
  const brand = String(state.brand || "").trim();
  // Exact model, material, fit, color and size are ranking hints, never mandatory search terms.
  const match = state.category && types[state.category]
    ? title.match(types[state.category]) : Object.values(types).map((pattern) => title.match(pattern)).find(Boolean);
  const product = match?.[0] || defaults[state.category] || "";
  if (brand && product) return `${brand} ${product}`.slice(0, 120);
  const words = [brand, title || product].filter(Boolean).join(" ").split(/\s+/);
  const seen = new Set();
  return words.filter((word) => {
    const key = normalize(word);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 7).join(" ").slice(0, 120);
}

function rankResearchListings(listings, state) {
  const hints = [state.styleModel, state.keyFeatures, state.material, state.color, state.gender, state.size]
    .filter(Boolean).join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  return [...listings].sort((a, b) => {
    const score = (item) => {
      const text = `${item.title} ${item.snippet || ""}`.toLowerCase();
      return hints.filter((term) => text.includes(term)).length;
    };
    return score(b) - score(a);
  });
}

function initNewListingPage() {
  if (!pageHas("#listingForm")) return;

  const form = $("#listingForm");
  let photoPreparation = { completed: {}, additionalShots: [] };
  let marketResearch = null;
  let selectedResearchTerms = [];
  let researchRequestId = 0;
  let displayedResearchQuery = "";
  let currentDraftId = uid();
  let generatedDescription = "";
  let descriptionIsCustom = false;
  let templateKeywords = "";
  let pricingPlan = null;
  $("#addPhotoShotBtn").addEventListener("click", () => {
    const input = $("#additionalPhotoShot");
    const shot = input.value.trim();
    if (!shot || !fields.category.value) return;
    photoPreparation.additionalShots.push(shot);
    input.value = "";
    updatePreview();
  });
  const fields = {
    itemType: $("#customItemType"),
    productType: $("#productType"),
    styleModel: $("#styleModel"),
    keyFeatures: $("#keyFeatures"),
    material: $("#material"),
    gender: $("#gender"),
    size: $("#size"),
    sku: $("#itemSku"),

    itemName: $("#itemName"),
    color: $("#color"),
    brand: $("#brand"),
    category: $("#category"),
    condition: $("#condition"),
    price: $("#price"),
    notes: $("#notes"),
    keywords: $("#keywords"),
    hashtags: $("#hashtags"),
  };

  const nodes = {
    form,
    formError: $("#formError"),
    formStatus: $("#formStatus"),
    completenessText: $("#completenessText"),
    completenessBarTrack: $("#completenessBarTrack"),
    completenessBar: $("#completenessBar"),
    exportPreview: $("#exportPreview"),
    exportTitle: $("#exportTitle"),
    exportPrice: $("#exportPrice"),
    exportDescription: $("#exportDescription"),
    exportSellerNotes: $("#exportSellerNotes"),
    exportHashtags: $("#exportHashtags"),
    exportKeywords: $("#exportKeywords"),
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
    runApiResearchBtn: $("#runApiResearchBtn"),
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
    const state = {
      itemType: fields.itemType.value.trim(),
      productType: fields.productType.value.trim(),
      styleModel: fields.styleModel.value.trim(),
      keyFeatures: fields.keyFeatures.value.trim(),
      material: fields.material.value.trim(),
      gender: fields.gender.value.trim(),
      size: fields.size.value.trim(),
      sku: fields.sku.value.trim(),

      photoPreparation,
      manualComps: nodes.manualCompInputs.map((input) => input.value),
      generatedDescription,
      descriptionIsCustom,
      __draftId: currentDraftId,
      templateKeywords,
      pricingPlan,
      itemName: fields.itemName.value.trim(),
      color: fields.color.value.trim(),
      brand: fields.brand.value.trim(),
      category: fields.category.value,
      condition: fields.condition.value,
      price: Number.isFinite(price) ? price : NaN,
      notes: fields.notes.value.trim(),
      keywords: fields.keywords.value.trim(),
      hashtags: fields.hashtags?.value.trim() || "",
      status: "draft",
    };
    if (pricingPlan?.inputs) {
      try { state.pricingPlan = calculateResalePricing(pricingPlan.inputs, state.price); } catch { state.pricingPlan = null; }
    }
    const researchMatches = marketResearch && marketResearch.query === buildCompQuery(state);
    state.marketResearch = researchMatches ? marketResearch : null;
    state.researchTerms = researchMatches ? selectedResearchTerms : [];
    const suggestions = buildSearchSuggestions(state);
    state.keywords = mergeTemplateKeywords(suggestions.keywords.join(", "), templateKeywords);
    state.hashtags = suggestions.hashtags;
    return state;
  }

  function setFormState(state) {
    marketResearch = state.marketResearch || null;
    selectedResearchTerms = Array.isArray(state.researchTerms) ? [...state.researchTerms] : [];
    displayedResearchQuery = "";
    researchRequestId++;
    currentDraftId = state.__draftId || uid();
    generatedDescription = state.generatedDescription || "";
    descriptionIsCustom = state.descriptionIsCustom === true;
    templateKeywords = state.templateKeywords || "";
    pricingPlan = state.pricingPlan || null;
    latestCompQuery = "";
    latestCompSource = "none";
    nodes.manualCompInputs.forEach((input, index) => { input.value = String(state.manualComps?.[index] || ""); });
    if (getManualCompValues(nodes.manualCompInputs).length) {
      latestCompQuery = buildCompQuery({ ...state, category: LEGACY_PHOTO_CATEGORIES[state.category] || state.category });
      latestCompSource = "manual";
    }
    nodes.compResults.replaceChildren();
    $("#marketTermSuggestions").replaceChildren();
    $("#marketSearchLinks").replaceChildren();
    $("#marketSearchLinks").hidden = true;
    $("#marketSearchStatus").textContent = "";
    nodes.runCompSearchBtn.setAttribute("aria-expanded", "false");
    fields.itemName.value = state.itemName || "";
    fields.color.value = state.color || "";
    fields.brand.value = state.brand || "";
    fields.category.value = LEGACY_PHOTO_CATEGORIES[state.category] || state.category || "";
    fields.itemType.value = state.itemType || "";
    fields.productType.value = state.productType || "";
    fields.styleModel.value = state.styleModel || "";
    fields.keyFeatures.value = state.keyFeatures || "";
    fields.material.value = state.material || "";
    fields.gender.value = state.gender || "";
    fields.size.value = state.size || "";
    fields.sku.value = state.sku || (state.__editingId ? getListingSku(state) : "");

    photoPreparation = {
      completed: { ...(state.photoPreparation?.completed || {}) },
      additionalShots: [...(state.photoPreparation?.additionalShots || [])],
    };
    delete $("#photoRequirementList").dataset.renderKey;
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
    return buildSearchSuggestions(state).keywords;
  }

  function buildHashtags(state) {
    return buildSearchSuggestions(state).hashtags;
  }

  function buildGeneratedDescription(state) {
    const existing = String(state.notes || "").trim();
    const sellerNotes = generatedDescription && existing.startsWith(generatedDescription)
      ? existing.slice(generatedDescription.length).replace(/^\s*Seller notes:\n/, "").trim()
      : existing;
    generatedDescription = composeListingDescription(state);
    return [generatedDescription, sellerNotes].filter(Boolean).join("\n\n");
  }

  function fillTemplateEditor(template) {
    if (!nodes.templateName) return;
    nodes.templateName.value = template?.name || "";
    if (nodes.templateTitlePattern) nodes.templateTitlePattern.value = template?.titlePattern || "";
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
    if (!fields.category.value && template.category) fields.category.value = LEGACY_PHOTO_CATEGORIES[template.category] || template.category;
    if (!fields.condition.value && template.condition) fields.condition.value = template.condition;

    const renderedKeywords = renderTemplateTokens(template.keywords, tokenValues, TEMPLATE_TOKEN_SAMPLES);
    if (renderedKeywords) {
      templateKeywords = mergeTemplateKeywords(templateKeywords, renderedKeywords);
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

  function updatePreview(event) {
    const editingDescription = event?.target === fields.notes;
    if (editingDescription) {
      const text = fields.notes.value.trim();
      if (!text) { generatedDescription = ""; descriptionIsCustom = false; }
      else if (generatedDescription) descriptionIsCustom = !text.startsWith(generatedDescription);
    }
    let state = getFormState();
    if (!editingDescription && !descriptionIsCustom) {
      fields.notes.value = buildGeneratedDescription(state);
      syncFilledState(fields.notes);
      state = getFormState();
    }
    document.querySelectorAll("[data-condition]").forEach((button) => {
      const selected = button.dataset.condition === state.condition;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("text-bg-light", !selected);
      button.classList.toggle("text-bg-dark", selected);
    });
    updateCompleteness(state);
    const skuSettings = getSkuSettings();
    fields.sku.placeholder = `Auto: ${formatCustomSku(skuSettings.nextNumber, skuSettings)}`;
    const currentResearchQuery = buildCompQuery(state);
    if (displayedResearchQuery && displayedResearchQuery !== currentResearchQuery) {
      nodes.compResults.replaceChildren();
      $("#marketTermSuggestions").replaceChildren();
      nodes.compStatus.textContent = "";
      nodes.compSummary.textContent = "";
      displayedResearchQuery = "";
    }
    if (state.marketResearch && !displayedResearchQuery) renderMarketResearch(state.marketResearch);

    const pricingGuide = getPricingGuide(state);
    const suggestedRange = pricingGuide.range;
    const plan = state.pricingPlan;
    $("#listingPricingSummary").hidden = !plan;
    $("#listingPricingSummary").textContent = plan
      ? `Min Sale: $${plan.minSale.toFixed(2)} · Target: $${plan.targetPrice.toFixed(2)} · Net Margin at Price: ${plan.marginPct === null ? "—" : plan.marginPct.toFixed(1) + "%"}` : "";
    const priceCheck = isPriceValid(state.price, suggestedRange);

    const title = buildListingTitle(state);
    const condition = prettyCondition(state.condition);
    const price = Number.isFinite(state.price) && state.price > 0 ? `$${state.price.toFixed(2)}` : "$0.00";
    const rangeText = suggestedRange
      ? `${`$${suggestedRange[0]} - $${suggestedRange[1]}`} ${pricingGuide.source === "manual" ? "(manual comps)" : pricingGuide.source === "live" ? "(live comps)" : "(estimated)"}`
      : "Add category + condition";
    const priceCheckText = priceCheck.msg || "Waiting for price";
    const conditionText = state.condition
      ? `${condition} condition${state.brand ? ` for this ${state.brand} item.` : "."}`
      : "No condition selected yet.";
    const descriptionText = buildMarketplaceDescription(state) || "Add notes for flaws, measurements, materials, and shipping details.";
    const sellerNotesText = [
      state.condition ? `Condition is listed as ${condition.toLowerCase()}.` : "Condition details can be added once reviewed.",
      state.notes
        ? "Please review the photos and description for measurements, materials, and any noted wear."
        : "Please review the photos for overall item details and condition.",
      "Message with any questions before purchase.",
    ].join("\n");
    fields.keywords.value = state.keywords;
    state.keywords = fields.keywords.value;

    if (nodes.listingCardTitle) nodes.listingCardTitle.textContent = title;
    if (nodes.listingCardPrice) nodes.listingCardPrice.textContent = price;
    if (nodes.listingSnapshotRange) nodes.listingSnapshotRange.textContent = rangeText;
    if (nodes.listingSnapshotPriceCheck) nodes.listingSnapshotPriceCheck.textContent = priceCheckText;
    if (nodes.listingCardCondition) nodes.listingCardCondition.textContent = conditionText;
    if (nodes.listingCardNotes) nodes.listingCardNotes.textContent = descriptionText;
    updatePhotoGuidance(state.category, photoPreparation);

    if (fields.hashtags) {
      fields.hashtags.value = buildHashtags(state);
      state.hashtags = fields.hashtags.value;
    }

    const platform = $("#exportPlatform").value;
    const target = getMarketplaceMap(state)[platform];
    const hasItemData = [state.itemName, state.brand, state.category, state.condition, state.color, state.productType,
      state.itemType, state.styleModel, state.keyFeatures, state.material, state.gender, state.size, state.sku, state.notes]
      .some((value) => String(value || "").trim()) || state.price > 0;
    nodes.exportPreview.textContent = hasItemData ? marketplaceFormSummary(state, platform) : "";
    if (nodes.exportTitle) nodes.exportTitle.textContent = target.title === "Untitled item" ? "" : target.title;
    if (nodes.exportPrice) nodes.exportPrice.textContent = target.listingPrice;
    if (nodes.exportDescription) nodes.exportDescription.textContent = target.description;
    if (nodes.exportSellerNotes) nodes.exportSellerNotes.textContent = hasItemData ? Object.entries(marketplaceFormFields(state, platform))
      .filter(([key, value]) => !["Title", "Description", "Price", "Listing Price"].includes(key) && value !== "")
      .map(([key, value]) => `${key}: ${value}`).join("\n") : "";
    if (nodes.exportKeywords) nodes.exportKeywords.textContent = state.keywords;
    const isPoshmark = platform === "poshmark";
    $("#exportTagsLabel").textContent = isPoshmark ? "Style Tags" : platform === "ebay" ? "Tags (reference)" : "Tags";
    if (nodes.exportHashtags) nodes.exportHashtags.textContent = isPoshmark ? target.styleTags.join(", ") : state.hashtags;
    $("#exportCompatibilityStatus").textContent = marketplaceExportIssues(state, platform).join(" ");
    document.querySelectorAll(".export-copy-btn").forEach((button) => {
      button.disabled = !document.getElementById(button.getAttribute("data-copy-target"))?.textContent.trim();
    });
    $("#copyBtn").disabled = !nodes.exportPreview.textContent.trim();
    $("#downloadFormFieldsBtn").disabled = !hasItemData;

  }

  function buildCompQuery(state) {
    const titleWords = String(state.itemName || "").trim().split(/\s+/).filter(Boolean);
    const product = state.productType || state.itemType || (titleWords.length < 2 && state.category ? prettyCategory(state.category).split(/[&,/]/)[0].trim() : "");
    const identity = state.itemName || product;
    const words = [state.brand, identity, product, state.styleModel, state.color, state.keyFeatures, state.material, state.gender, state.size]
      .filter(Boolean).join(" ").trim().split(/\s+/);
    const seen = new Set();
    return words.filter((word) => {
      const token = word.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!token || seen.has(token)) return false;
      seen.add(token);
      return true;
    }).join(" ").slice(0, 180);
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

  function renderMarketResearch(research) {
    displayedResearchQuery = research.query;
    nodes.compResults.replaceChildren();
    rankResearchListings(research.listings, getFormState()).forEach((comp) => {
      const card = document.createElement("div");
      card.className = "border rounded p-2 small";
      const link = document.createElement("a");
      // The server allows only HTTPS eBay/Poshmark listing URLs.
      let parsed;
      try { parsed = new URL(comp.url); } catch { return; }
      if (parsed.protocol !== "https:" || !/(^|\.)(ebay\.com|poshmark\.com)$/.test(parsed.hostname)) return;
      link.href = parsed.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${comp.marketplace}${comp.matchType ? ` · ${comp.matchType === "similar" ? "Similar" : "Related"} listing` : ""}: ${comp.title}`;
      const snippet = document.createElement("p");
      snippet.className = "mb-2";
      snippet.textContent = comp.snippet;
      const priceLabel = document.createElement("label");
      priceLabel.className = "d-block";
      priceLabel.textContent = "Verified sold price (USD)";
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0.01";
      input.step = "0.01";
      input.className = "form-control form-control-sm mb-2";
      input.placeholder = comp.displayedPrice ? `Search shows $${Number(comp.displayedPrice).toFixed(2)} — verify first` : "Check the original listing";
      priceLabel.append(input);
      const confirm = document.createElement("label");
      confirm.className = "d-flex gap-2 align-items-start mb-2";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "form-check-input";
      confirm.append(check, document.createTextNode("I verified this item sold and this is its sale price."));
      const use = document.createElement("button");
      use.type = "button";
      use.className = "btn btn-outline-secondary btn-sm";
      use.textContent = "Add to comps";
      use.addEventListener("click", () => {
        if (!check.checked || !Number.isFinite(Number(input.value)) || Number(input.value) <= 0) {
          nodes.compStatus.textContent = "Enter the verified sale price and confirm the item sold first.";
          return;
        }
        const slot = nodes.manualCompInputs.find((field) => !field.value.trim());
        if (!slot) { nodes.compStatus.textContent = "All five comp slots are filled."; return; }
        slot.value = input.value;
        slot.dispatchEvent(new Event("input", { bubbles: true }));
        use.disabled = true;
        use.textContent = "Added to comps";
        nodes.compStatus.textContent = "";
      });
      card.append(link, snippet, priceLabel, confirm, use);
      nodes.compResults.append(card);
    });
    const termBox = $("#marketTermSuggestions");
    termBox.replaceChildren();
    if (research.terms.length) {
      const caption = document.createElement("p");
      caption.className = "small mb-2";
      caption.textContent = "Market wording: select terms that describe your item to add them to Keywords and Tags.";
      termBox.append(caption);
      research.terms.forEach(({ term, listingCount }) => {
        const label = document.createElement("label");
        label.className = "small d-inline-flex gap-1 me-3 mb-2";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "form-check-input";
        input.checked = selectedResearchTerms.includes(term);
        input.addEventListener("change", () => {
          selectedResearchTerms = selectedResearchTerms.filter((entry) => entry !== term);
          if (input.checked) selectedResearchTerms.push(term);
          updatePreview();
        });
        label.append(input, document.createTextNode(`${term} (${listingCount} listings)`));
        termBox.append(label);
      });
    }
    nodes.compSummary.textContent = "";
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
    nodes.formulaSummary.textContent = "";
    nodes.formulaStatus.textContent = "";

    if (!fields.keywords.value.trim()) {
      fields.keywords.value = generateKeywordsFromState(state).join(", ");
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
  const pageParams = new URLSearchParams(window.location.search);
  const incomingPricing = readPricingSession("listingLab:pricingTransfer:v1");
  const hasPricingTransfer = pageParams.has("pricing");
  const validTransfer = hasPricingTransfer && incomingPricing?.token === pageParams.get("pricing") && incomingPricing.draft;
  const startFresh = pageParams.get("new") === "1" || hasPricingTransfer;
  const activeDraft = validTransfer ? incomingPricing.draft : startFresh ? null : loadDraft({ advance: true });
  if (startFresh && !validTransfer) resetListingForm();
  if (activeDraft) loadDraftIntoForm(activeDraft, validTransfer ? "Calculated pricing applied. Save the listing to keep it." : activeDraft.__editingId ? "Loaded latest draft for editing." : "Loaded latest saved draft.");
  if (hasPricingTransfer && !validTransfer) setError("The calculator handoff is unavailable. Load your saved draft to continue.");

  document.querySelectorAll('a[href="pricing.html"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const draft = { ...getFormState(), ...(currentEditingId ? { __editingId: currentEditingId } : {}) };
      const token = uid();
      if (!saveDraft(draft) || !writePricingSession("listingLab:pricingContext:v1", { token, draft })) {
        event.preventDefault();
        setError("Could not preserve your listing for the calculator. Check browser storage before leaving.");
        return;
      }
      link.href = `pricing.html?context=${encodeURIComponent(token)}`;
    });
  });

  if (nodes.runCompSearchBtn) {
    nodes.runCompSearchBtn.addEventListener("click", () => {
      const query = buildCompQuery(getFormState());
      const status = $("#marketSearchStatus");
      if (!query) {
        status.textContent = "Add item details before opening market searches.";
        return;
      }
      const links = buildResearchLinks(query);
      const container = $("#marketSearchLinks");
      container.replaceChildren();
      const blocked = [];
      [["eBay Sold Listings", links.ebaySold], ["Poshmark Sold Listings", links.poshmark]].forEach(([label, url]) => {
        const tab = window.open("", "_blank");
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else {
          blocked.push([label, url]);
        }
      });
      // Keep a recovery link only when the browser blocks a new tab.
      blocked.forEach(([label, url]) => {
        const link = document.createElement("a");
        link.className = "btn btn-outline-secondary btn-sm me-2 mb-2";
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;
        container.append(link);
      });
      container.hidden = blocked.length === 0;
      nodes.runCompSearchBtn.setAttribute("aria-expanded", String(blocked.length > 0));
      status.textContent = blocked.length
        ? "Allow pop-ups for Listing Lab to open both sold searches automatically, or use the blocked search links below."
        : "";
    });
  }

  if (nodes.runApiResearchBtn) {
    nodes.runApiResearchBtn.addEventListener("click", async () => {
      const state = getFormState();
      const query = buildCompQuery(state);
      const hasDescriptiveTitle = state.itemName.trim().split(/\s+/).filter(Boolean).length >= 2;
      if (!hasDescriptiveTitle && !(state.brand && (state.category || state.productType || state.itemType))) {
        nodes.compStatus.textContent = "Enter a descriptive title, or add a brand and category, before researching.";
        return;
      }
      if (marketResearch?.query === query && marketResearch.listings?.length > 0 && Date.now() - Date.parse(marketResearch.searchedAt) < 86400000 && !marketResearch.warnings?.length) {
        renderMarketResearch(marketResearch);
        nodes.compStatus.textContent = marketResearch.listings.length ? "" : "No indexed listing leads found. Try a shorter title with the brand and product or model.";
        return;
      }
      const requestId = ++researchRequestId;
      nodes.runApiResearchBtn.disabled = true;
      nodes.runApiResearchBtn.textContent = "Researching…";
      nodes.compStatus.textContent = "";
      try {
        const response = await fetch("/api/market_research", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, searchQuery: buildGeneralResearchQuery(state) }), signal: AbortSignal.timeout(45000),
        });
        if (!(response.headers.get("content-type") || "").includes("application/json")) {
          const host = window.location.hostname;
          throw new Error(host.endsWith("github.io")
            ? "GitHub Pages cannot run API research. Open your deployed Vercel site and try Research with API there."
            : ["localhost", "127.0.0.1"].includes(host)
              ? "This preview cannot run API research. Start python3 server.py and open http://127.0.0.1:8000/new-listing.html, or use your deployed Vercel site."
              : "The research backend is unavailable on this deployment. Deploy the api folder to Vercel and add SERPAPI_KEY, then redeploy.");
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Research unavailable.");
        if (requestId !== researchRequestId || buildCompQuery(getFormState()) !== query) return;
        if (!Array.isArray(data.listings) || !Array.isArray(data.terms) || data.query !== query) throw new Error("Invalid research response.");
        marketResearch = data;
        selectedResearchTerms = [];
        renderMarketResearch(data);
        nodes.compStatus.textContent = data.warnings?.join(" ") || (data.listings.length ? "" : "No indexed listing leads found. Try a shorter title with the brand and product or model.");
        updatePreview();
      } catch (error) {
        if (requestId === researchRequestId) nodes.compStatus.textContent = error.message || "Research unavailable. Please retry.";
      } finally {
        nodes.runApiResearchBtn.disabled = false;
        nodes.runApiResearchBtn.textContent = "Research with API";
      }
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
      nodes.compSummary.textContent = "";
      nodes.compStatus.textContent = "";
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
    const saved = saveDraft({
      ...draftState,
      status: "draft",
      ...(currentEditingId ? { __editingId: currentEditingId } : {}),
    });
    if (!saved) { setError("Draft could not be saved. Browser storage may be full or unavailable. Your form is still here."); return; }
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
        titlePattern: nodes.templateTitlePattern?.value.trim() || getTemplateById(selectedId)?.titlePattern || "",
        description: nodes.templateDescription.value.trim(),
        keywords: nodes.templateKeywords.value.trim(),
        shippingNotes: nodes.templateShippingNotes.value.trim(),
        conditionDisclosure: nodes.templateConditionDisclosure?.value.trim() || "",
        measurementsReminder: nodes.templateMeasurementsReminder?.value.trim() || "",
        category: fields.category.value,
        condition: fields.condition.value,
        updatedAt: new Date().toISOString(),
      });

      if (!upsertTemplate(template)) { nodes.templateStatus.textContent = "Template could not be saved. Browser storage may be full or unavailable."; return; }
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
      if (!removeTemplate(selectedId)) { nodes.templateStatus.textContent = "Template could not be deleted. Browser storage is unavailable."; return; }
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
      setError("Title is required.");
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

    if (state.sku && !isSkuAvailable(state.sku, currentEditingId)) {
      setError("That SKU is already assigned to another item. Enter a unique SKU.");
      fields.sku.focus();
      return;
    }
    let saved;
    if (currentEditingId) {
      const existingListing = getListingById(currentEditingId);
      if (!existingListing) { setError("This listing no longer exists. Save a draft or start a new listing."); return; }
      const sku = state.sku || allocateNextSku();
      if (!sku) { setError("SKU could not be saved. Browser storage may be full or unavailable."); return; }
      saved = updateListing(currentEditingId, {
        ...state,
        status: normalizeStatus(existingListing.status),
        sku,
      });
    } else {
      const sku = state.sku || allocateNextSku();
      if (!sku) { setError("Listing could not be saved. Browser storage may be full or unavailable."); return; }
      saved = addListing({
        id: uid(),
        ...state,
        status: "ready",
        sku,
        createdAt: new Date().toISOString(),
      });
    }
    if (!saved) { setError("Listing could not be saved. Browser storage may be full or unavailable. Save or export your work before clearing storage."); return; }
    window.location.href = "dashboard.html";
  });

  document.querySelectorAll("[data-condition]").forEach((button) => {
    button.addEventListener("click", () => {
      fields.condition.value = button.dataset.condition;
      fields.condition.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  Object.values(fields).forEach((field) => {
    if (!field) return;
    field.addEventListener("input", updatePreview);
    field.addEventListener("change", updatePreview);
  });

  $("#exportPlatform").addEventListener("change", updatePreview);
  $("#downloadFormFieldsBtn").addEventListener("click", () => {
    const platform = $("#exportPlatform").value;
    downloadExportFile(marketplaceFormSummary(getFormState(), platform), `listing-lab-${platform}-form-fields.txt`, "text/plain;charset=utf-8");
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
      ...getTemplateById(selectedTemplateId),
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
    if (skuFields.nextNumber) skuFields.nextNumber.value = String(settings.nextNumber);
    if (skuFields.digits) skuFields.digits.value = String(settings.digits);
    if (skuFields.preview) skuFields.preview.textContent = formatCustomSku(settings.nextNumber, settings);
  }

  function getSkuSettingsFromForm() {
    return saveSkuSettings({
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
      libraryList.innerHTML = `
        <div class="saved-template-empty-state">
          <div class="saved-template-empty">
            <p class="mb-0">No templates saved yet. Create one here, then apply it when you start a new item.</p>
          </div>
          <a class="btn btn-dark" href="new-listing.html">Create Listing</a>
        </div>
      `;
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
        if (!removeTemplate(template.id)) { libraryStatus.textContent = "Template could not be deleted. Browser storage is unavailable."; return; }
        if (selectedTemplateId === template.id) clearEditor();
        renderLibrary();
        libraryStatus.textContent = "Template deleted.";
      });

      libraryList.appendChild(card);
    });
  }

  Object.values(fields).filter(Boolean).forEach((field) => {
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
    const isUpdate = Boolean(selectedTemplateId && getTemplateById(selectedTemplateId));
    if (!upsertTemplate(template)) { editorStatus.textContent = "Template could not be saved. Browser storage may be full or unavailable."; return; }
    selectedTemplateId = template.id;
    renderLibrary();
    editorStatus.textContent = isUpdate ? "Template updated." : "New template saved.";
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
    if (!upsertTemplate(draftTemplate)) { editorStatus.textContent = "Template could not be saved. Browser storage may be full or unavailable."; return; }
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
    if (!removeTemplate(selectedTemplateId)) { editorStatus.textContent = "Template could not be deleted. Browser storage is unavailable."; return; }
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
      if (!settings) { skuFields.status.textContent = "SKU settings could not be saved. Browser storage is unavailable."; return; }
      renderSkuSettings();
      skuFields.status.textContent = `SKU settings saved. Next SKU: ${formatCustomSku(settings.nextNumber, settings)}.`;
    });
  }

  if (skuFields.resetBtn) {
    skuFields.resetBtn.addEventListener("click", () => {
      if (!saveSkuSettings(DEFAULT_SKU_SETTINGS)) { skuFields.status.textContent = "SKU settings could not be reset. Browser storage is unavailable."; return; }
      renderSkuSettings();
      skuFields.status.textContent = "SKU settings reset to the Listing Lab default sequence.";
    });
  }

  [skuFields.nextNumber, skuFields.digits].forEach((field) => {
    if (!field) return;
    field.addEventListener("input", () => {
      const previewSettings = {
          nextNumber: skuFields.nextNumber?.value || DEFAULT_SKU_SETTINGS.nextNumber,
        digits: skuFields.digits?.value || DEFAULT_SKU_SETTINGS.digits,
      };
      if (skuFields.preview) skuFields.preview.textContent = formatCustomSku(previewSettings.nextNumber, previewSettings);
    });
  });

  clearEditor();
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
    { label: "Market search and manual comps", ok: typeof buildResearchLinks === "function" },
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
      draft.itemName ? "Title" : null,
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

function calculateResalePricing(values, analysisOverride) {
  const keys = ["salePrice", "cogs", "shipping", "packaging", "platformFeePct", "paymentFeePct", "fixedFee",
    "adCost", "targetProfit", "minimumProfit", "targetMarginPct", "offerRoomPct", "mileage", "mileageRate"];
  const inputs = Object.fromEntries(keys.map((key) => [key, Number(values[key] ?? 0)]));
  if (Object.values(inputs).some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Enter valid nonnegative prices, costs and percentages.");
  const feeRate = (inputs.platformFeePct + inputs.paymentFeePct) / 100;
  const marginRate = inputs.targetMarginPct / 100;
  const offerRate = inputs.offerRoomPct / 100;
  if (feeRate >= 1 || marginRate >= 1 || feeRate + marginRate >= 1) throw new Error("Fees plus target net margin must total less than 100%.");
  if (offerRate >= 1) throw new Error("Offer room must be less than 100%.");
  const ceilMoney = (amount) => Math.ceil((amount - 1e-9) * 100) / 100;
  const mileageCost = inputs.mileage * inputs.mileageRate;
  const totalFixedCosts = inputs.cogs + inputs.shipping + inputs.packaging + inputs.fixedFee + inputs.adCost + mileageCost;
  if (!Number.isFinite(totalFixedCosts)) throw new Error("The entered costs are too large to calculate.");
  const breakEven = ceilMoney(totalFixedCosts / (1 - feeRate));
  const minSale = ceilMoney((totalFixedCosts + inputs.minimumProfit) / (1 - feeRate));
  const targetPrice = ceilMoney(Math.max(minSale, inputs.salePrice,
    (totalFixedCosts + inputs.targetProfit) / (1 - feeRate), totalFixedCosts / (1 - feeRate - marginRate)));
  const listPrice = ceilMoney(targetPrice / (1 - offerRate));
  const analysisPrice = analysisOverride > 0 ? analysisOverride : inputs.salePrice || targetPrice;
  const estimatedFees = analysisPrice * feeRate + inputs.fixedFee;
  const estimatedTotalCost = totalFixedCosts + analysisPrice * feeRate;
  const netProfit = analysisPrice - estimatedTotalCost;
  if (![breakEven, minSale, targetPrice, listPrice, analysisPrice, estimatedTotalCost, netProfit].every(Number.isFinite)) {
    throw new Error("The entered values are too large to calculate a valid price.");
  }
  return { inputs, feeRate, mileageCost, totalFixedCosts, breakEven, minSale, targetPrice, listPrice, analysisPrice,
    estimatedFees, estimatedTotalCost, netProfit,
    marginPct: analysisPrice > 0 ? netProfit / analysisPrice * 100 : null,
    roiPct: inputs.cogs > 0 ? netProfit / inputs.cogs * 100 : null };
}

function readPricingSession(key) {
  try { return safeJsonParse(sessionStorage.getItem(key), null); } catch { return null; }
}

function writePricingSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

const RESELLER_OVERVIEW_HEADERS = ["SKU #", "Location", "QR Code", "Photo", "Date Added", "Status", "Item Name", "Brand", "Size",
  "Category", "Color", "Condition", "Material", "Purchase Price", "List Price", "Min Sale", "Target Price", "Sold Price", "Date Sold",
  "Platform Sold On", "Shipping Cost", "Platform Fee", "Mileage", "Mileage Cost", "Total Cost", "Profit", "Receipts", "Notes"];

function resellerSpreadsheetRow(listing) {
  const plan = listing.pricingPlan;
  const inputs = plan?.inputs || {};
  const sale = Number(listing.soldPrice);
  const hasSale = Number.isFinite(sale) && sale > 0;
  const fees = hasSale ? (listing.platformFee ?? (plan ? sale * plan.feeRate + inputs.fixedFee : "")) : "";
  const totalCost = hasSale && plan ? plan.totalFixedCosts - inputs.fixedFee + Number(fees) : "";
  return {
    "SKU #": listing.sku || getListingSku(listing), "Location": listing.location || "", "QR Code": listing.qrCode || "", "Photo": listing.photoUrl || "",
    "Date Added": String(listing.createdAt || "").slice(0, 10), "Status": prettyStatus(listing.status), "Item Name": buildListingTitle(listing),
    "Brand": listing.brand || "", "Size": listing.size || "", "Category": listing.category ? prettyCategory(listing.category) : "",
    "Color": listing.color || "", "Condition": listing.condition ? prettyCondition(listing.condition) : "", "Material": listing.material || "",
    "Purchase Price": inputs.cogs ?? listing.purchasePrice ?? "", "List Price": Number(listing.price) > 0 ? Number(listing.price) : "",
    "Min Sale": plan?.minSale ?? "", "Target Price": plan?.targetPrice ?? "", "Sold Price": hasSale ? sale : "",
    "Date Sold": listing.soldAt ? String(listing.soldAt).slice(0, 10) : "", "Platform Sold On": listing.platformSoldOn || "",
    "Shipping Cost": inputs.shipping ?? listing.shippingCost ?? "", "Platform Fee": fees, "Mileage": inputs.mileage ?? "",
    "Mileage Cost": plan?.mileageCost ?? "", "Total Cost": totalCost, "Profit": hasSale && totalCost !== "" ? sale - totalCost : "",
    "Receipts": listing.receipts || listing.receiptUrl || "", "Notes": listing.notes || "",
  };
}

function resellerSpreadsheetCSV(listings) {
  const cell = (value) => {
    const text = String(value ?? "");
    return `"${(/^[=+@-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  return [RESELLER_OVERVIEW_HEADERS.map(cell).join(","), ...listings.map((listing) => {
    const row = resellerSpreadsheetRow(listing);
    return RESELLER_OVERVIEW_HEADERS.map((header) => cell(row[header])).join(",");
  })].join("\r\n");
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

  const inputIds = {
    salePrice: "calcSalePrice", cogs: "calcCogs", shipping: "calcShippingCost", packaging: "calcPackagingCost",
    platformFeePct: "calcPlatformFeePct", paymentFeePct: "calcPaymentFeePct", fixedFee: "calcFixedFee", adCost: "calcAdCost",
    targetProfit: "calcTargetProfit", minimumProfit: "calcMinimumProfit", targetMarginPct: "calcTargetMargin",
    offerRoomPct: "calcOfferRoom", mileage: "calcMileage", mileageRate: "calcMileageRate",
  };
  const context = readPricingSession("listingLab:pricingContext:v1");
  const contextToken = new URLSearchParams(window.location.search).get("context");
  const sourceDraft = contextToken && context?.token === contextToken ? context.draft : null;
  if (sourceDraft) {
    $("#pricingBrand").value = sourceDraft.brand || "";
    $("#pricingCategory").value = sourceDraft.category || "";
    $("#pricingCondition").value = sourceDraft.condition || "";
    const inputs = sourceDraft.pricingPlan?.inputs || { salePrice: sourceDraft.price || "" };
    Object.entries(inputIds).forEach(([key, id]) => { if (inputs[key] !== undefined) $("#" + id).value = String(inputs[key]); });
    $("#pricingItemContext").textContent = `Pricing: ${sourceDraft.itemName || sourceDraft.brand || "current listing"}`;
  }
  let result = null;
  const fmtMoney = (value) => `$${Number(value).toFixed(2)}`;
  const outputIds = ["calcNetProfit", "calcMargin", "calcRoi", "calcBreakEven", "calcTargetPrice", "calcListingPrice", "calcMinSale"];
  const invalidate = () => {
    result = null;
    $("#applyPricingToListingBtn").disabled = true;
    outputIds.forEach((id) => { $("#" + id).textContent = "—"; });
    $("#calcStatus").textContent = "";
  };
  Object.values(inputIds).forEach((id) => $("#" + id).addEventListener("input", invalidate));
  $("#calcProfitBtn").addEventListener("click", () => {
    try {
      const values = Object.fromEntries(Object.entries(inputIds).map(([key, id]) => [key, $("#" + id).value || 0]));
      result = calculateResalePricing(values);
      if (!(result.listPrice > 0)) throw new Error("Enter item costs, an expected sale price or a target profit to calculate pricing.");
      $("#calcNetProfit").textContent = fmtMoney(result.netProfit);
      $("#calcMargin").textContent = result.marginPct === null ? "n/a" : `${result.marginPct.toFixed(2)}%`;
      $("#calcRoi").textContent = result.roiPct === null ? "n/a" : `${result.roiPct.toFixed(2)}%`;
      $("#calcBreakEven").textContent = fmtMoney(result.breakEven);
      $("#calcTargetPrice").textContent = fmtMoney(result.targetPrice);
      $("#calcListingPrice").textContent = fmtMoney(result.listPrice);
      $("#calcMinSale").textContent = fmtMoney(result.minSale);
      $("#calcStatus").textContent = result.analysisPrice < result.minSale
        ? "Your planned sale price is below the minimum sale price." : `Profit and margin shown at a sale price of ${fmtMoney(result.analysisPrice)}.`;
      $("#applyPricingToListingBtn").disabled = false;
    } catch (error) { invalidate(); $("#calcStatus").textContent = error.message; }
  });
  $("#applyPricingToListingBtn").addEventListener("click", () => {
    if (!result) return;
    const token = uid();
    const draft = {
      ...(sourceDraft || { __draftId: uid(), brand: $("#pricingBrand").value.trim(), category: $("#pricingCategory").value,
        condition: $("#pricingCondition").value, status: "draft" }),
      price: result.listPrice, pricingPlan: result,
    };
    if (!saveDraft(draft) || !writePricingSession("listingLab:pricingTransfer:v1", { token, draft })) {
      $("#calcStatus").textContent = "Could not transfer pricing. Your calculator results are still here; check browser storage.";
      return;
    }
    window.location.href = `new-listing.html?pricing=${encodeURIComponent(token)}`;
  });
  if (sourceDraft?.pricingPlan) $("#calcProfitBtn").click();
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
          buildListingTitle(listing), listing.styleModel, listing.productType, listing.itemType, listing.keyFeatures,
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
        <td><input class="form-check-input" type="checkbox" data-select-id="${escapeHtml(listing.id)}" aria-label="Select listing ${escapeHtml(buildListingTitle(listing))}" /></td>
        <td>
          <div class="dashboard-item-cell">
            <a class="dashboard-item-title" href="listing.html?id=${encodeURIComponent(listing.id)}">${escapeHtml(buildListingTitle(listing))}</a>
            <div class="dashboard-item-meta">${escapeHtml(listing.brand || "No brand")} · ${escapeHtml(prettyCondition(listing.condition))}</div>
            <div class="dashboard-item-note">${escapeHtml(notePreview || "No notes yet.")}</div>
          </div>
        </td>
        <td><span class="dashboard-sku">${escapeHtml(sku)}</span></td>
        <td>${escapeHtml(prettyCategory(listing.category))}</td>
        <td>
          <div class="dashboard-status-cell">
            ${getStatusBadge(statusValue)}
            <select class="form-select form-select-sm" data-status-id="${escapeHtml(listing.id)}" aria-label="Quick status change for ${escapeHtml(buildListingTitle(listing))}">
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
            <button class="btn btn-sm btn-outline-danger" data-del="${escapeHtml(listing.id)}" type="button" aria-label="Delete ${escapeHtml(buildListingTitle(listing))}">Delete</button>
          </div>
        </td>
      `;

      tr.querySelector("[data-select-id]").addEventListener("change", syncSelectionMeta);

      tr.querySelector("[data-status-id]").addEventListener("change", (event) => {
        const nextStatus = normalizeStatus(event.target.value);
        const saved = updateListing(listing.id, { status: nextStatus });
        dashboardStatus.textContent = saved ? `Status updated to ${prettyStatus(nextStatus)}.` : "Status could not be saved. Browser storage is unavailable.";
        render();
      });

      tr.querySelector("[data-edit]").addEventListener("click", () => {
        const saved = saveDraft({
          ...listing,
          __editingId: listing.id,
        });
        if (!saved) { dashboardStatus.textContent = "Could not open this listing for editing. Browser storage is unavailable."; return; }
        window.location.href = "new-listing.html";
      });

      tr.querySelector("[data-dup]").addEventListener("click", () => {
        const duplicate = duplicateListing(listing.id);
        dashboardStatus.textContent = duplicate ? "Listing duplicated as a draft." : "Could not duplicate listing.";
        render();
      });

      tr.querySelector("[data-del]").addEventListener("click", () => {
        if (!window.confirm(`Delete \"${listing.itemName || "this listing"}\"?`)) return;
        const saved = removeListing(listing.id);
        dashboardStatus.textContent = saved ? "Listing deleted." : "Listing could not be deleted. Browser storage is unavailable.";
        render();
      });

      tbody.appendChild(tr);
    });

    syncSelectionMeta();
  }

  $("#inventoryStorageOrigin").textContent = `Saved in this browser at ${window.location.origin}.`;
  // An additive snapshot protects existing records when this dashboard first opens.
  preserveInventoryBackup();
  $("#saveInventoryBackupBtn").addEventListener("click", () => {
    const listings = getListings();
    if (!listings.length) { dashboardStatus.textContent = "No saved listings at this address to back up."; return; }
    exportJSON(listings);
  });
  $("#importInventoryBackupBtn").addEventListener("click", () => $("#inventoryBackupFile").click());
  $("#inventoryBackupFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Choose an inventory JSON backup smaller than 5 MB.");
      const incoming = JSON.parse(await file.text());
      if (!Array.isArray(incoming) || !incoming.length || incoming.some((item) => !item || typeof item.id !== "string" || (!item.itemName && !item.brand))) {
        throw new Error("Choose an Inventory Backup JSON file, rather than a platform form export.");
      }
      const merged = mergeInventoryRecords(getListings(), incoming);
      if (merged.added && !saveListings(merged.listings)) throw new Error("Backup could not be imported. Existing inventory was kept unchanged.");
      render();
      dashboardStatus.textContent = `${merged.added} listings imported. ${merged.skipped} existing or conflicting records skipped. Current records were preserved.`;
    } catch (error) {
      dashboardStatus.textContent = error instanceof SyntaxError ? "This file is not valid JSON. Existing inventory was kept unchanged." : error.message;
    } finally { event.target.value = ""; }
  });
  $("#recoverInventoryBtn").addEventListener("click", () => {
    const merged = mergeInventoryRecords(getListings(), getRecoverableInventory());
    if (!merged.added) {
      dashboardStatus.textContent = "No additional saved listings found at this address. Open your original site address to export its Inventory Backup.";
      return;
    }
    if (!saveListings(merged.listings)) { dashboardStatus.textContent = "Recovery could not be saved. Existing inventory was kept unchanged."; return; }
    render();
    dashboardStatus.textContent = `${merged.added} listings recovered. Existing records were preserved.`;
  });

  $("#dashboardExportPlatform").addEventListener("change", () => {
    $("#exportSpreadsheetBtn").hidden = $("#dashboardExportPlatform").value !== "spreadsheet";
  });
  $("#exportSpreadsheetBtn").addEventListener("click", () => {
    const selectedIds = new Set(getSelectedListingIds());
    const listings = selectedIds.size ? getAllListings().filter((item) => selectedIds.has(item.id)) : getAllListings();
    if (!listings.length) { dashboardStatus.textContent = "No saved inventory to export."; return; }
    exportResellerSpreadsheet(listings);
    dashboardStatus.textContent = "Spreadsheet exported with Overview and Pricing Inputs. Sold amounts remain blank until recorded.";
  });

  $("#exportBtn").addEventListener("click", () => {
    const listings = getAllListings();
    if (!listings.length) {
      dashboardStatus.textContent = "No saved inventory to export.";
      return;
    }
    exportCSV(listings, $("#dashboardExportPlatform").value);
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
      exportJSON(listings, $("#dashboardExportPlatform").value);
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
      exportCSV(selected, $("#dashboardExportPlatform").value);
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
      exportJSON(selected, $("#dashboardExportPlatform").value);
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

  titleEl.textContent = buildListingTitle(listing);
  metaEl.textContent = `${listing.brand || "No brand"} | ${prettyCategory(listing.category)} | ${prettyCondition(listing.condition)} | ${prettyStatus(listing.status)} | $${Number(listing.price || 0).toFixed(2)} | ${formatDate(listing.createdAt)}`;
  exportEl.textContent = buildExportSummary(listing);

  $("#detailCopyBtn").addEventListener("click", async () => {
    const ok = await copyText(exportEl.textContent || "");
    msgEl.textContent = ok ? "Copied." : "Copy failed. Select and copy manually.";
  });

  $("#detailDeleteBtn").addEventListener("click", () => {
    if (!window.confirm(`Delete \"${listing.itemName || "this listing"}\"?`)) return;
    if (!removeListing(listing.id)) { msgEl.textContent = "Listing could not be deleted. Browser storage is unavailable."; return; }
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
