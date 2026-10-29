"""Server-only marketplace research via SerpApi. Never return upstream credentials."""
import json
import os
import re
import time
from collections import Counter, deque
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import urlopen

_cache = {}
_requests = deque()
_lock = Lock()
STOPWORDS = set("the and for with from this that size sold sale ebay poshmark listing listings free shipping pre owned new used women womens men mens authentic condition excellent good item items original brand pair".split())


def focused_search_query(query):
    """Keep a short product identity instead of requiring every label/size/detail."""
    clean = re.sub(r"\b(?:size|sz)\s*(?:(?:us|uk|eu)\s*)?(?:\d+(?:\.\d+)?|[xsml]{1,4})\b", " ", query, flags=re.I)
    noise = {"the", "a", "an", "and", "for", "with", "from", "mens", "womens", "men", "women", "unisex", "nwt", "nwot", "used", "condition"}
    words = []
    seen = set()
    for word in clean.split():
        token = re.sub(r"[^a-z0-9]", "", word.lower())
        if token and token not in noise and token not in seen:
            words.append(word)
            seen.add(token)
    return " ".join(words[:7]) or query


def relevance_words(text):
    aliases = {"footwear": "shoe", "sneaker": "shoe", "trainer": "shoe", "handbag": "bag"}
    words = set()
    for word in re.findall(r"[a-z]+|[0-9]+", text.lower()):
        if word in STOPWORDS or len(word) < 2:
            continue
        if len(word) > 4 and word.endswith("s") and not word.endswith(("ss", "us")):
            word = word[:-1]
        words.add(aliases.get(word, word))
    return words


def normalize_results(results, domain, query):
    """Search snippets provide leads, never verified transaction prices."""
    normalized = []
    required = relevance_words(query)
    seen = set()
    for result in results:
        url = result.get("link", "")
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        if parsed.scheme != "https" or not (host == domain or host.endswith("." + domain)):
            continue
        if not parsed.path.lower().startswith("/itm/" if domain == "ebay.com" else "/listing/"):
            continue
        title = str(result.get("title", ""))[:300]
        snippet = str(result.get("snippet", ""))[:800]
        matches = required & relevance_words(title + " " + snippet)
        if not required or len(matches) < min(2, len(required)):
            continue
        identity = parsed.path.rstrip("/")
        if domain == "ebay.com" and identity.split("/")[-1].isdigit():
            identity = "/itm/" + identity.split("/")[-1]
        if identity in seen:
            continue
        seen.add(identity)
        relevance = len(matches) / len(required)
        # A displayed number may be an asking price, old price or negotiated offer.
        # Only explicit dollar amounts are displayed; nothing is treated as a sold price.
        prices = re.findall(r"(?:US\s*)?\$\s*([\d,]+(?:\.\d{2})?)(?!\d)", snippet)
        price = float(prices[0].replace(",", "")) if len(prices) == 1 else None
        normalized.append({"title": title, "url": url, "snippet": snippet,
                           "marketplace": "eBay" if domain == "ebay.com" else "Poshmark",
                           "displayedPrice": price, "soldVerified": False,
                           "matchType": "similar" if relevance >= 0.6 else "related",
                           "relevance": relevance,
                           "soldHint": bool(re.search(r"\bsold\b", title + " " + snippet, re.I))})
    return sorted(normalized, key=lambda item: (item["relevance"], item["soldHint"]), reverse=True)


class SearchResults(list):
    """Listing leads plus safe counts, without provider URLs or credentials."""
    def __init__(self, listings=(), attempts=(), warnings=()):
        super().__init__(listings)
        self.attempts = list(attempts)
        self.warnings = list(warnings)


def search_market(query, domain, key):
    focused = focused_search_query(query)
    broad = " ".join(focused.split()[:3])
    if domain == "ebay.com":
        searches = [("ebay", focused), ("google", f"site:{domain}/itm/ {broad}")]
    else:
        searches = [("google", f"site:{domain}/listing/ {focused}"),
                    ("bing", f"site:{domain}/listing/ {broad}")]
    attempts, collected, warnings = [], {}, []
    for engine, search in searches:
        params = {"engine": engine, "api_key": key}
        if engine == "ebay":
            params.update({"_nkw": search, "ebay_domain": "ebay.com", "_ipg": 60})
        else:
            params["q"] = search
            params.update({"gl": "us", "hl": "en"} if engine == "google" else {"mkt": "en-US"})
        try:
            # Never log this URL: it contains the private key.
            with urlopen("https://serpapi.com/search.json?" + urlencode(params), timeout=18) as response:
                payload = json.load(response)
            empty_success = (payload.get("search_metadata", {}).get("status") == "Success"
                             and "empty" in str(payload.get("search_information", {}).get("organic_results_state", "")).lower()
                             and not payload.get("organic_results"))
            if payload.get("error") and not empty_success:
                raise ValueError("Search provider rejected the request. Check your key and search allowance.")
        except (HTTPError, URLError, ValueError, TimeoutError, OSError):
            if not collected:
                raise
            warnings.append(f"{domain}: additional search unavailable; showing the listings already found.")
            break
        organic = payload.get("organic_results", [])
        rows = organic
        if engine == "ebay":
            rows = []
            for row in organic:
                price = row.get("price", {})
                raw_price = price.get("raw", "") if isinstance(price, dict) else ""
                snippet = " · ".join(str(value) for value in
                                     (row.get("subtitle"), row.get("condition"), raw_price) if value)
                rows.append({**row, "snippet": f"Available listing · {snippet}. Asking price; verify sale status."})
        listings = normalize_results(rows, domain, query)
        attempts.append({"marketplace": domain, "engine": engine, "query": search,
                         "returned": len(organic), "accepted": len(listings)})
        for listing in listings:
            listing["searchEngine"] = engine
            parsed = urlparse(listing["url"])
            identity = parsed.path.rstrip("/")
            if domain == "ebay.com" and identity.split("/")[-1].isdigit():
                identity = "/itm/" + identity.split("/")[-1]
            collected.setdefault(identity, listing)
        # A handful of hits is not a complete search: supplement and deduplicate.
        if len(collected) >= 10:
            break
    leads = sorted(collected.values(), key=lambda item: (item["relevance"], item["soldHint"]), reverse=True)
    return SearchResults(leads, attempts, warnings)


def research(query, key, search_query=None):
    broad_query = focused_search_query(search_query or query)
    cache_key = "marketplace-v3:" + broad_query.casefold()
    with _lock:
        now = time.time()
        cached = _cache.get(cache_key)
        if cached and now - cached[0] < cached[1].get("cacheTtlSeconds", 300):
            return {**cached[1], "query": query, "cached": True}
        while _requests and now - _requests[0] > 60:
            _requests.popleft()
        if len(_requests) >= 5:
            raise ValueError("Please wait a minute before researching another item.")
        _requests.append(now)
    listings, warnings, diagnostics = [], [], []
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs = {domain: pool.submit(search_market, broad_query, domain, key)
                for domain in ("ebay.com", "poshmark.com")}
        for domain, job in jobs.items():
            try:
                found = job.result()
                listings.extend(found)
                diagnostics.extend(getattr(found, "attempts", []))
                warnings.extend(getattr(found, "warnings", []))
            except (HTTPError, URLError, ValueError, TimeoutError, OSError):
                warnings.append(f"{domain} search unavailable. Check the API key and search allowance, then retry.")
    if len(warnings) == 2 and not listings:
        raise ValueError("Live search unavailable. Check your SerpApi key, allowance and network connection.")
    counts = Counter()
    for listing in listings:
        words = set(re.findall(r"[a-z][a-z-]{2,}", listing["title"].lower()))
        counts.update(words - STOPWORDS)
    terms = [{"term": word, "listingCount": count} for word, count in counts.most_common(24) if count >= 2]
    result = {"query": query, "searchQuery": broad_query, "listings": listings, "terms": terms, "warnings": warnings,
              "cacheTtlSeconds": 86400 if all(sum(item.get("marketplace") == name for item in listings) >= 10 for name in ("eBay", "Poshmark")) else 300,
              "diagnostics": diagnostics, "searchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "cached": False}
    if not warnings and listings:
        with _lock:
            if len(_cache) >= 128:
                _cache.pop(next(iter(_cache)))
            _cache[cache_key] = (time.time(), result)
    return result


class handler(BaseHTTPRequestHandler):
    def reply(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc != self.headers.get("Host"):
            return self.reply(403, {"error": "Use research from the Listing Lab form."})
        key = os.environ.get("SERPAPI_KEY", "").strip()
        if not key:
            return self.reply(503, {"error": "Live search needs SERPAPI_KEY on the server. Run python3 server.py locally or configure the hosting environment variable."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096:
                return self.reply(400, {"error": "Invalid research request."})
            data = json.loads(self.rfile.read(length))
            query = " ".join(str(data.get("query", "")).split())
            if not 4 <= len(query) <= 180:
                return self.reply(400, {"error": "Enter an item title (4–180 characters)."})
            search_query = data.get("searchQuery")
            if search_query is not None:
                if not isinstance(search_query, str) or not 4 <= len(search_query.strip()) <= 120:
                    return self.reply(400, {"error": "Enter an item title (4–120 characters)."})
                return self.reply(200, research(query, key, search_query.strip()))
            return self.reply(200, research(query, key))
        except (ValueError, TypeError, AttributeError) as error:
            message = str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError) else "Invalid research request."
            return self.reply(400, {"error": message})
        except Exception:
            return self.reply(502, {"error": "Research could not complete. Please retry."})
