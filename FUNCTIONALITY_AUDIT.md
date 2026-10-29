# Functionality audit — October 25, 2026

## Results

- **20/20 Chrome workflow checks passed.** Tests use isolated browser profiles, local fixture data and mocked research responses. No existing user records or API credits are used.
- **19/19 automated frontend and backend regression tests passed.**
- All 10 HTML pages loaded without JavaScript exceptions and without horizontal overflow at 1440px and 390px viewport widths.
- Local page links, assets and anchor targets resolved; no duplicate HTML IDs were found.
- Desktop and mobile Create Listing screenshots were inspected.
- `git diff --check` passed.

## Fixed issues

- Drafts now retain manual comp inputs, selected market terms, template keywords and description-generation metadata.
- Separate drafts with identical brand/color/price values no longer overwrite one another.
- Repeated description generation updates the generated block after item changes while preserving seller disclosures.
- Template placeholders no longer gain stray braces. Applied template keywords survive auto-generation, and editing templates retains their stored metadata.
- Editing a listing shows **Update Listing** and preserves its existing status. A deleted listing cannot be silently saved through an old edit draft.
- Dashboard search includes product types, model names and key features. Dashboard and detail titles use the composed item title.
- Saving failures are reported instead of falsely claiming success or navigating away. Template, listing, draft and SKU operations handle unavailable/full storage.
- SKU allocation skips identifiers already used by saved listings. Duplicating a listing preserves the actual color value.
- Invalid or negative calculator inputs are rejected and stale calculator results are cleared. ROI with zero item cost is shown as unavailable.
- Resetting/loading a form clears old market terms, comp cards and search links.
- CSV exports include record IDs, SKUs and update dates. Poshmark titles use its documented 80-character limit instead of being prematurely cut to 50: [Poshmark listing guidance](https://support.poshmark.com/s/article/894455911?language=en_US).
- Create Listing links consistently start a fresh form, while Dashboard Edit keeps its draft-based editing handoff.

## Chrome coverage

Page initialization and responsive layouts; fresh navigation; draft recovery; comp median and persistence; all 12 photography categories and checklist tracking; description regeneration; template substitution and keyword merge; save/edit/status preservation; dashboard product search; storage failure handling; formula pricing and profit validation; research UI/cache/reset; CSV/JSON and selected exports; template create/duplicate/delete; custom SKU settings; clipboard buttons; research errors and button recovery; sold-search URLs and tab opening; draft identity; mobile navigation; dashboard duplication, filters, selection, deletion and detail views.

## Re-run checks

Standard checks require Python 3. macOS frontend logic tests use the built-in JavaScriptCore framework; other platforms skip those checks and can use the Chrome suite instead.

```bash
python3 -m unittest discover -s tests -v
```

For browser tests, install Playwright in a virtual environment. Google Chrome must be installed:

```bash
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/python tests/browser_audit.py
```

The browser suite starts its own temporary local server and writes screenshots/results in `/tmp`.

## Still requires live verification

The rotated SerpApi key and Vercel deployment were not available to these tests. A deployed **Research with API** request is still needed to verify the account, API allowance, Vercel routing/environment and actual search-result quality. Sold-search destinations were checked for their URL filters; browsers can still block multiple tabs, and marketplaces control their own search behavior. The app keeps fallback links for blocked tabs. Search snippets are leads, not authenticated sold-price data; users must still verify prices before adding comps.
