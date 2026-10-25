import io
import json
import unittest
from unittest.mock import patch

from api import market_research as market


class ResearchTests(unittest.TestCase):
    def setUp(self):
        market._cache.clear()
        market._requests.clear()

    def test_only_marketplace_listing_urls_are_accepted(self):
        rows = [{"link": url, "title": "Nike running shoes", "snippet": "Sold $45.00"} for url in (
            "https://www.ebay.com/itm/123", "https://ebay.com.evil.test/itm/123",
            "javascript:alert(1)", "https://www.ebay.com/sch/items", "http://ebay.com/itm/123")]
        items = market.normalize_results(rows, "ebay.com", "Nike shoes")
        self.assertEqual(len(items), 1)
        self.assertFalse(items[0]["soldVerified"])
        self.assertEqual(items[0]["displayedPrice"], 45)

    def test_ambiguous_prices_are_not_selected(self):
        rows = [{"link": "https://poshmark.com/listing/123", "title": "Nike shoes",
                 "snippet": "$100 original price, $35 asking"}]
        self.assertIsNone(market.normalize_results(rows, "poshmark.com", "Nike")[0]["displayedPrice"])

    def test_no_price_is_not_zero(self):
        rows = [{"link": "https://ebay.com/itm/123", "title": "Nike shoes", "snippet": "Sold"}]
        self.assertIsNone(market.normalize_results(rows, "ebay.com", "Nike")[0]["displayedPrice"])

    def test_two_searches_reused_for_terms_and_comps_and_cached(self):
        def fake_search(query, domain, key):
            return [{"title": "Nike breathable running shoes", "url": f"https://{domain}/123"}]
        with patch.object(market, "search_market", side_effect=fake_search) as search:
            result = market.research("Nike running shoes", "private-placeholder")
            self.assertEqual(search.call_count, 2)
            self.assertEqual(len(result["listings"]), 2)
            self.assertIn({"term": "breathable", "listingCount": 2}, result["terms"])
            self.assertTrue(market.research("Nike running shoes", "private-placeholder")["cached"])
            self.assertEqual(search.call_count, 2)
            self.assertNotIn("private-placeholder", json.dumps(result))

    def test_partial_failure_retains_other_results_without_caching(self):
        def fake_search(query, domain, key):
            if domain == "ebay.com":
                raise ValueError("upstream error")
            return [{"title": "Nike shoes"}]
        with patch.object(market, "search_market", side_effect=fake_search):
            result = market.research("Nike shoes", "test")
        self.assertEqual(len(result["warnings"]), 1)
        self.assertEqual(len(result["listings"]), 1)
        self.assertFalse(market._cache)

    def test_total_failure_does_not_expose_upstream_error(self):
        with patch.object(market, "search_market", side_effect=ValueError("secret-url-key")):
            with self.assertRaisesRegex(ValueError, "Live search unavailable") as error:
                market.research("Nike shoes", "test")
        self.assertNotIn("secret-url-key", str(error.exception))

    def test_rate_limit(self):
        with patch.object(market, "search_market", return_value=[]):
            for index in range(5):
                market.research(f"Nike shoes {index}", "test")
            with self.assertRaisesRegex(ValueError, "wait a minute"):
                market.research("Nike shoes sixth", "test")

    def request(self, body, environment, origin="http://localhost:8000"):
        request = object.__new__(market.handler)
        request.headers = {"Content-Length": str(len(body)), "Host": "localhost:8000", "Origin": origin}
        request.rfile = io.BytesIO(body)
        responses = []
        request.reply = lambda status, payload: responses.append((status, payload))
        with patch.dict("os.environ", environment, clear=True):
            request.do_POST()
        return responses[0]

    def test_missing_key_is_actionable(self):
        status, payload = self.request(b'{"query":"Nike shoes"}', {})
        self.assertEqual(status, 503)
        self.assertIn("SERPAPI_KEY", payload["error"])

    def test_cross_origin_rejected(self):
        status, _ = self.request(b'{}', {"SERPAPI_KEY": "test"}, "https://other.test")
        self.assertEqual(status, 403)

    def test_invalid_request_uses_no_searches(self):
        with patch.object(market, "research") as research:
            status, _ = self.request(b'{"query":"x"}', {"SERPAPI_KEY": "test"})
        self.assertEqual(status, 400)
        research.assert_not_called()


if __name__ == "__main__":
    unittest.main()
