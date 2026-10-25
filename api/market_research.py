"""Server-only Google research via SerpApi. Never return upstream credentials."""
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


def normalize_results(results, domain, query):
    """Search snippets provide leads, never verified transaction prices."""
    normalized = []
    required = set(re.findall(r"[a-z0-9]+", query.lower()))
    for result in results:
        url = result.get("link", "")
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        if parsed.scheme != "https" or not (host == domain or host.endswith("." + domain)):
            continue
        if not parsed.path.startswith("/itm/" if domain == "ebay.com" else "/listing/"):
            continue
        title = str(result.get("title", ""))[:300]
        title_words = set(re.findall(r"[a-z0-9]+", title.lower()))
        first_word = next(iter(re.findall(r"[a-z0-9]+", query.lower())), "")
        if first_word not in title_words or len(required & title_words) < min(2, len(required)):
            continue
        snippet = str(result.get("snippet", ""))[:800]
        # A displayed number may be an asking price, old price or negotiated offer.
        # Only explicit dollar amounts are displayed; nothing is treated as a sold price.
        prices = re.findall(r"(?:US\s*)?\$\s*([\d,]+(?:\.\d{2})?)(?!\d)", snippet)
        price = float(prices[0].replace(",", "")) if len(prices) == 1 else None
        normalized.append({"title": title, "url": url, "snippet": snippet,
                           "marketplace": "eBay" if domain == "ebay.com" else "Poshmark",
                           "displayedPrice": price, "soldVerified": False})
    return normalized


def search_market(query, domain, key):
    params = urlencode({"engine": "google", "q": f'site:{domain}/{"itm" if domain == "ebay.com" else "listing"}/ {query} "sold"',
                        "api_key": key, "gl": "us", "hl": "en"})
    # Never log this URL: it contains the private key.
    with urlopen("https://serpapi.com/search.json?" + params, timeout=20) as response:
        payload = json.load(response)
    if payload.get("error"):
        raise ValueError("Search provider rejected the request. Check your key and search allowance.")
    return normalize_results(payload.get("organic_results", []), domain, query)


def research(query, key):
    cache_key = query.casefold()
    with _lock:
        now = time.time()
        cached = _cache.get(cache_key)
        if cached and now - cached[0] < 86400:
            return {**cached[1], "cached": True}
        while _requests and now - _requests[0] > 60:
            _requests.popleft()
        if len(_requests) >= 5:
            raise ValueError("Please wait a minute before researching another item.")
        _requests.append(now)
    listings, warnings = [], []
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs = {domain: pool.submit(search_market, query, domain, key)
                for domain in ("ebay.com", "poshmark.com")}
        for domain, job in jobs.items():
            try:
                listings.extend(job.result())
            except (HTTPError, URLError, ValueError, TimeoutError, OSError):
                warnings.append(f"{domain} search unavailable. Check the API key and search allowance, then retry.")
    if len(warnings) == 2:
        raise ValueError("Live search unavailable. Check your SerpApi key, allowance and network connection.")
    counts = Counter()
    for listing in listings:
        words = set(re.findall(r"[a-z][a-z-]{2,}", listing["title"].lower()))
        counts.update(words - STOPWORDS)
    terms = [{"term": word, "listingCount": count} for word, count in counts.most_common(24) if count >= 2]
    result = {"query": query, "listings": listings, "terms": terms, "warnings": warnings,
              "searchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "cached": False}
    if not warnings:
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
                return self.reply(400, {"error": "Enter a specific brand and item type (4–180 characters)."})
            return self.reply(200, research(query, key))
        except (ValueError, TypeError, AttributeError) as error:
            message = str(error) if isinstance(error, ValueError) and not isinstance(error, json.JSONDecodeError) else "Invalid research request."
            return self.reply(400, {"error": message})
        except Exception:
            return self.reply(502, {"error": "Research could not complete. Please retry."})
