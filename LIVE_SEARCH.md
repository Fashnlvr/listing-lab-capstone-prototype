# Live market research

## Run locally

1. Replace any API key previously shared in chat using the SerpApi dashboard.
2. Run `python3 server.py` from this project directory.
3. Enter your replacement SerpApi key at the hidden terminal prompt. The key stays in server memory and is not written to a file. An existing `SERPAPI_KEY` environment variable also works. `.env` files are not loaded automatically.
4. Open `http://127.0.0.1:8000/new-listing.html`.
5. Enter an item Title. Click **Research with API**.

The Python server replaces Live Server or `python3 -m http.server` when using research. No third-party Python dependencies are required. Stopping the server removes the prompted key from memory.

**Open Market Search** opens eBay sold and Poshmark sold results directly in new tabs without calling the API or using search credits. Allow pop-ups for this site to open both tabs; recovery links appear only if a tab is blocked. Comp prices can always be entered manually.

## Use the results

Research uses only the Title field. It requests up to 60 eBay search results directly through SerpApi’s eBay engine, and searches indexed Poshmark listing pages through Google. If a marketplace yields fewer than 10 unique relevant leads, it supplements eBay with Google or Poshmark with Bing and merges unique listings. These are listing leads, including available items. SerpApi’s old eBay Sold/Complete filters are no longer supported. Brand, Category and Additional Details do not affect research queries, ranking or cache identity. The same results feed comparable listing cards and repeated wording suggestions. Search results are leads, not authenticated sales data, search-volume measurements or proof of a trend.

- Open a source listing and check whether it sold. Enter the verified sale price in USD, confirm the checkbox and select **Add to comps**. **Apply Comp Median** uses those verified prices and any manually entered comp values.
- Select market wording that accurately describes your item. Selected terms automatically enter Keywords and Tags; unconfirmed terms never enter item descriptions.
- Google snippets sometimes omit prices, show original prices or miss negotiated offers. The app never automatically treats a snippet price as a completed-sale price.
- Saving a draft/listing saves its research and selected terms. Results with at least 10 leads from each marketplace are reused for 24 hours; sparse results expire after five minutes. Changing the title requires new research. Server cache uses the same expiration, but is in memory and may reset on restart or serverless cold starts. Partial failures and empty results are not cached. Related listings are ranked by title/snippet overlap; they are not claimed to be exact matches or verified sales.
- A request can use two to four search credits, including when no useful listings are found. Cache reuse can reduce usage; separate serverless instances do not share a cache. Monitor the provider's dashboard for authoritative usage.

## Deploy with a backend

GitHub Pages cannot execute the Python endpoint. The rest of the static site can still run there, but live research needs a backend-enabled host.

For Vercel, import this repository as an **Other** project with the repository root as the root directory, no build command and `.` as the output directory. The `api/market_research.py` handler supplies `/api/market_research` using Vercel's Python runtime. Set `SERPAPI_KEY` under **Project Settings → Environment Variables**, then deploy/redeploy. Do not add the key to browser code, Git or a URL you share.

Keep a prototype deployment access-protected. Same-origin checks and in-memory throttling are included but are not user authentication or a distributed quota. A public commercial deployment needs access control and persistent rate/budget limits before exposing the paid search endpoint. Vercel's free Hobby plan is for personal noncommercial projects.

References: [SerpApi Google Search API](https://serpapi.com/search-api), [organic result fields](https://serpapi.com/organic-results), [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python), [environment variables](https://vercel.com/docs/environment-variables).

## Validation

Run `python3 -m unittest discover -s tests -v`. Tests mock the search provider; they consume no search credits. A live request with your replacement key is still needed to validate your account and allowance.

Supplemental searches run when fewer than 10 relevant unique listings are found, rather than stopping at the first hit. Both result sets are deduplicated by listing path or eBay item ID. Only individual listing URLs are accepted. Failure of a supplemental search preserves initial leads with a warning. Empty or partially failed results are not cached.

The response includes safe diagnostics per attempt: engine, public query, returned page count and accepted listing count. This distinguishes an empty provider response from unrelated or non-listing pages rejected by the app. No provider URLs, credentials or raw errors are exposed.

Direct eBay result prices are asking prices, not verified sale prices. Poshmark still depends on search-engine indexing, so the number of leads can be lower than results visible inside Poshmark itself. No minimum number of live results is guaranteed. See [SerpApi eBay Search](https://serpapi.com/ebay-search-api).
