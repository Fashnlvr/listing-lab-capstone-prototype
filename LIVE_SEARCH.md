# Live market research

## Run locally

1. Replace any API key previously shared in chat using the SerpApi dashboard.
2. Run `python3 server.py` from this project directory.
3. Enter your replacement SerpApi key at the hidden terminal prompt. The key stays in server memory and is not written to a file. An existing `SERPAPI_KEY` environment variable also works. `.env` files are not loaded automatically.
4. Open `http://127.0.0.1:8000/new-listing.html`.
5. Enter the brand, category, color and any known product/model details. Click **Research Market**.

The Python server replaces Live Server or `python3 -m http.server` when using research. No third-party Python dependencies are required. Stopping the server removes the prompted key from memory.

## Use the results

Each research request runs two Google queries through SerpApi: one for eBay item pages and one for Poshmark listing pages, with sold-oriented search wording. The same results feed comparable listing cards and repeated wording suggestions. Search results are leads, not authenticated sales data, search-volume measurements or proof of a trend.

- Open a source listing and check whether it sold. Enter the verified sale price in USD, confirm the checkbox and select **Add to comps**. **Apply Comp Median** uses those verified prices and any manually entered comp values.
- Select market wording that accurately describes your item. Selected terms automatically enter Keywords and Tags; unconfirmed terms never enter item descriptions.
- Google snippets sometimes omit prices, show original prices or miss negotiated offers. The app never automatically treats a snippet price as a completed-sale price.
- Saving a draft/listing saves its research and selected terms. Matching research is reused for 24 hours without a new request; changing the item query requires new research. Server cache is also 24 hours, but is in memory and may reset on restart or serverless cold starts. Partial failures are not cached.
- A request can use up to two search credits, including when no useful listings are found. Cache reuse can reduce usage; separate serverless instances do not share a cache. Monitor the provider's dashboard for authoritative usage.

## Deploy with a backend

GitHub Pages cannot execute the Python endpoint. The rest of the static site can still run there, but live research needs a backend-enabled host.

For Vercel, import this repository as an **Other** project with the repository root as the root directory, no build command and `.` as the output directory. The `api/market_research.py` handler supplies `/api/market_research` using Vercel's Python runtime. Set `SERPAPI_KEY` under **Project Settings → Environment Variables**, then deploy/redeploy. Do not add the key to browser code, Git or a URL you share.

Keep a prototype deployment access-protected. Same-origin checks and in-memory throttling are included but are not user authentication or a distributed quota. A public commercial deployment needs access control and persistent rate/budget limits before exposing the paid search endpoint. Vercel's free Hobby plan is for personal noncommercial projects.

References: [SerpApi Google Search API](https://serpapi.com/search-api), [organic result fields](https://serpapi.com/organic-results), [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python), [environment variables](https://vercel.com/docs/environment-variables).

## Validation

Run `python3 -m unittest discover -s tests -v`. Tests mock the search provider; they consume no search credits. A live request with your replacement key is still needed to validate your account and allowance.
