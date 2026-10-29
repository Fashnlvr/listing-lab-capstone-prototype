import io
import json
import unittest
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs

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
                 "snippet": "Sold out. $100 original price, $35 asking"}]
        self.assertIsNone(market.normalize_results(rows, "poshmark.com", "Nike")[0]["displayedPrice"])

    def test_no_price_is_not_zero(self):
        rows = [{"link": "https://ebay.com/itm/123", "title": "Nike shoes", "snippet": "Sold"}]
        self.assertIsNone(market.normalize_results(rows, "ebay.com", "Nike")[0]["displayedPrice"])

    def test_related_matches_use_snippets_and_not_an_exact_first_word(self):
        rows = [{"link": "https://ebay.com/itm/123", "title": "Air Zoom Pegasus Sneakers",
                 "snippet": "Nike running trainers in navy. This listing sold."}]
        items = market.normalize_results(rows, "ebay.com", "Nike running shoes blue size 10")
        self.assertEqual(len(items), 1)
        self.assertFalse(items[0]["soldVerified"])
        self.assertIn(items[0]["matchType"], ("similar", "related"))

    def test_listing_variations_are_deduplicated(self):
        rows = [{"link": url, "title": "Nike running shoes", "snippet": "This item sold"} for url in (
            "https://ebay.com/itm/Nike-Running-Shoes/123?tracking=one",
            "https://www.ebay.com/itm/123?tracking=two")]
        self.assertEqual(len(market.normalize_results(rows, "ebay.com", "Nike shoes")), 1)

    def test_product_numbers_match_different_spacing(self):
        rows = [{"link": "https://ebay.com/itm/123", "title": "New Balance 440v2 Sneakers", "snippet": "Sold out"}]
        self.assertEqual(len(market.normalize_results(rows, "ebay.com", "New Balance Numeric 440 V2 Shoes")), 1)

    def test_queries_are_short_and_target_sold_listings(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self): return b'{"organic_results": []}'
        with patch.object(market, "urlopen", return_value=Response()) as request:
            market.search_market("New Balance Numeric 440 V2 Dark Olivine Black Skate Shoes Mens Size 11", "ebay.com", "test")
        query = parse_qs(urlparse(request.call_args.args[0]).query)["q"][0]
        self.assertIn('"sold"', query)
        self.assertNotIn("Size 11", query)
        self.assertLessEqual(len(query.split()), 8)  # site operator plus seven item words

    def test_empty_provider_success_retries_broader_title_query(self):
        empty = {"search_metadata": {"status": "Success"},
                 "search_information": {"organic_results_state": "Fully empty"},
                 "error": "Google hasn't returned any results for this query."}
        found = {"organic_results": [{"link": "https://ebay.com/itm/123",
                                     "title": "New Balance sneakers", "snippet": "Sold out"}]}
        with patch.object(market, "urlopen", side_effect=[io.BytesIO(json.dumps(empty).encode()),
                                                           io.BytesIO(json.dumps(found).encode())]) as request:
            listings = market.search_market("New Balance sneakers blue suede", "ebay.com", "test")
        self.assertEqual(len(listings), 1)
        parameters = [parse_qs(urlparse(call.args[0]).query) for call in request.call_args_list]
        self.assertEqual(parameters[0]["engine"], ["google"])
        self.assertEqual(parameters[1]["engine"], ["bing"])
        self.assertEqual(parameters[1]["q"], ['site:ebay.com/itm/ new balance sneakers "sold"'])
        self.assertEqual(listings[0]["searchEngine"], "bing")
        self.assertEqual([attempt["returned"] for attempt in listings.attempts], [0, 1])
        self.assertNotIn("api_key", json.dumps(listings.attempts))
        self.assertEqual(request.call_count, 2)

    def test_provider_credential_error_is_not_retried(self):
        with patch.object(market, "urlopen", return_value=io.BytesIO(b'{"error":"Invalid API key"}')) as request:
            with self.assertRaisesRegex(ValueError, "provider rejected"):
                market.search_market("New Balance sneakers", "ebay.com", "test")
        self.assertEqual(request.call_count, 1)

    def test_good_results_do_not_use_extra_search_credits(self):
        payload = {"organic_results": [{"link": f"https://poshmark.com/listing/abc{i}",
                                        "title": "New Balance sneakers", "snippet": "Sold out"} for i in range(10)]}
        with patch.object(market, "urlopen", return_value=io.BytesIO(json.dumps(payload).encode())) as request:
            self.assertEqual(len(market.search_market("New Balance sneakers", "poshmark.com", "test")), 10)
        self.assertEqual(request.call_count, 1)

    def test_diagnostics_distinguish_filtered_pages_from_no_pages(self):
        payloads = [{"organic_results": [{"link": "https://ebay.com/sch/search", "title": "Nike shoes"}]},
                    {"organic_results": []}]
        with patch.object(market, "urlopen", side_effect=[io.BytesIO(json.dumps(p).encode()) for p in payloads]):
            listings = market.search_market("Nike shoes", "ebay.com", "private-placeholder")
        self.assertEqual(list(listings), [])
        self.assertEqual([a["returned"] for a in listings.attempts], [1, 0])
        self.assertEqual([a["accepted"] for a in listings.attempts], [0, 0])
        self.assertNotIn("private-placeholder", json.dumps(listings.attempts))

    def test_sparse_results_are_supplemented_and_deduplicated(self):
        first = {"organic_results": [{"link": "https://poshmark.com/listing/a", "title": "New Balance sneakers", "snippet": "Sold out"}]}
        second = {"organic_results": [{"link": "https://poshmark.com/listing/a?tracking=1", "title": "New Balance sneakers", "snippet": "Sold out"},
                                      {"link": "https://poshmark.com/listing/b", "title": "New Balance sneakers", "snippet": "Sold out"}]}
        with patch.object(market, "urlopen", side_effect=[io.BytesIO(json.dumps(p).encode()) for p in (first, second)]) as request:
            listings = market.search_market("New Balance sneakers", "poshmark.com", "test")
        self.assertEqual(len(listings), 2)
        params = parse_qs(urlparse(request.call_args.args[0]).query)
        self.assertEqual(params["engine"], ["bing"])
        self.assertEqual(params["mkt"], ["en-US"])

    def test_active_listings_and_units_sold_are_excluded(self):
        snippets = ["Available listing. $45.00", "Buy it now. 120 sold", "25 sold", "Sold by a trusted seller",
                    "Sold separately", "Sold for parts", "Sold as is", "Not sold", "This listing has ended", "Out of stock", "Unsold",
                    "This listing sold on October 12. $45.00", "Sold out", "[SOLD] $45.00"]
        rows = [{"link": f"https://ebay.com/itm/{1000+i}", "title": "New Balance sneakers", "snippet": snippet}
                for i, snippet in enumerate(snippets)]
        items = market.normalize_results(rows, "ebay.com", "New Balance sneakers")
        self.assertEqual(len(items), 3)
        self.assertTrue(all(item["soldHint"] and not item["soldVerified"] for item in items))

    def test_native_active_inventory_is_never_requested(self):
        with patch.object(market, "urlopen", side_effect=[io.BytesIO(b'{"organic_results": []}'), io.BytesIO(b'{"organic_results": []}')]) as request:
            market.search_market("New Balance sneakers", "ebay.com", "test")
        for call in request.call_args_list:
            params = parse_qs(urlparse(call.args[0]).query)
            self.assertIn(params["engine"][0], ("google", "bing"))
            self.assertIn('"sold"', params["q"][0])

    def test_sparse_cache_expires_in_five_minutes(self):
        with patch.object(market, "time") as clock, patch.object(market, "search_market", return_value=[{"title": "Nike shoes"}]):
            clock.time.return_value = 1000
            first = market.research("Nike shoes", "test")
            self.assertEqual(first["cacheTtlSeconds"], 300)
            clock.time.return_value = 1301
            self.assertFalse(market.research("Nike shoes", "test")["cached"])

    def test_supplement_failure_preserves_initial_listings(self):
        payload = {"organic_results": [{"link": "https://poshmark.com/listing/a", "title": "New Balance sneakers", "snippet": "Sold out"}]}
        with patch.object(market, "urlopen", side_effect=[io.BytesIO(json.dumps(payload).encode()), OSError("private-url")]):
            listings = market.search_market("New Balance sneakers", "poshmark.com", "test")
        self.assertEqual(len(listings), 1)
        self.assertEqual(len(listings.warnings), 1)
        self.assertNotIn("private-url", listings.warnings[0])

    def test_broad_title_keeps_brand_and_product_instead_of_model(self):
        self.assertEqual(market.broad_search_query("New Balance Numeric 440 V2 Sneakers Men Size 11 Black Suede"), "new balance sneakers")
        self.assertEqual(market.broad_search_query("Nike Air Max 90 Sneakers Size 10"), "nike air sneakers")
        self.assertNotIn("Size", market.broad_search_query("Coach handbag Size M"))

    def test_item_links_use_original_view_and_reject_catalog_pages(self):
        rows = [{"link": url, "title": "New Balance sneakers", "snippet": "This listing sold. $45.00"} for url in
                ("https://ebay.com/p/17072248303", "https://ebay.com/itm/New-Balance/123?tracking=foo", "https://ebay.com/itm/not-an-item")]
        items = market.normalize_results(rows, "ebay.com", "New Balance sneakers")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["url"], "https://www.ebay.com/itm/123?nordt=true&orig_cvip=true&rt=nc")

    def test_rich_result_price_is_visible_without_snippet_price(self):
        row = {"link": "https://ebay.com/itm/123", "title": "Nike shoes", "snippet": "This listing sold.",
               "rich_snippet": {"bottom": {"detected_extensions": {"price": 45, "currency": "$"}}}}
        item = market.normalize_results([row], "ebay.com", "Nike shoes")[0]
        self.assertEqual(item["displayedPrice"], 45)
        self.assertFalse(item["soldVerified"])

    def test_explicit_sale_price_and_conflicting_amounts(self):
        self.assertEqual(market.extract_displayed_price({"snippet": "Original $100; sold for $35.00"}), 35)
        self.assertIsNone(market.extract_displayed_price({"snippet": "Sold out $35.00", "rich_snippet": {"bottom": {"detected_extensions": {"price": 100, "currency": "$"}}}}))
        self.assertIsNone(market.extract_displayed_price({"snippet": "Sold out", "rich_snippet": {"bottom": {"detected_extensions": {"price": 45, "currency": "EUR"}}}}))

    def test_empty_results_are_not_cached(self):
        with patch.object(market, "search_market", return_value=[]) as search:
            first = market.research("Nike shoes", "test")
            second = market.research("Nike shoes", "test")
        self.assertEqual(search.call_count, 4)
        self.assertFalse(first["cached"])
        self.assertFalse(second["cached"])
        self.assertFalse(market._cache)

    def test_broad_query_is_used_and_reused_for_optional_variations(self):
        with patch.object(market, "search_market", return_value=[{"title": "New Balance sneakers", "snippet": "Sold out"}]) as search:
            first = market.research("New Balance 440 suede size 11", "test", "New Balance sneakers")
            second = market.research("New Balance 420 mesh size 9", "test", "New Balance sneakers")
        self.assertEqual(search.call_count, 2)
        self.assertTrue(all(call.args[0] == "New Balance sneakers" for call in search.call_args_list))
        self.assertEqual(first["searchQuery"], "New Balance sneakers")
        self.assertEqual(second["query"], "New Balance 420 mesh size 9")
        self.assertTrue(second["cached"])

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
