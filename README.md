Listing Lab — Smart Resale Listing Assistant

A responsive, local-first web application designed to simplify resale listing preparation, pricing research, inventory organization, and cross-platform listing workflows.

Live Application: Listing Lab on Vercel

Static Demo: GitHub Pages

Project Status: Functional Prototype | Ongoing Development

⸻

Project Overview

Listing Lab is a web-based productivity application that helps online resellers streamline the work required before publishing products on marketplaces such as eBay and Poshmark.

Originally developed as a graduate capstone project, Listing Lab has evolved into a functional application featuring structured listing creation, assisted market research, profit calculations, reusable templates, inventory tracking, and marketplace-specific data preparation.

The application focuses on reducing repetitive manual entry, improving listing consistency, and organizing the resale workflow in a single interface.

The Problem

Resellers frequently manage inventory information across spreadsheets, marketplace listing forms, research tabs, photographs, and personal notes.

This fragmented process can result in:

* Repetitive data entry across selling platforms.
* Inconsistent product descriptions and pricing decisions.
* Difficulty tracking inventory and listing progress.
* Disorganized comparable-sales research.
* Time-consuming preparation before publishing listings.

The Solution

Listing Lab provides a centralized pre-listing workspace where sellers can research products, organize information, calculate pricing, generate listing content, and prepare data for use on multiple marketplaces.

Its primary workflow consists of four stages:

1. Enter Essentials: Record product information, condition, identifying details, and inventory data.
2. Research & Price: Review comparable listings, estimate costs, and establish pricing targets.
3. Create Listing Content: Generate descriptions, organize tags, and complete photography checklists.
4. Save & Export: Store inventory records and prepare listing information for marketplace entry.

⸻

Core Features

1. Guided Listing Creation

* Structured forms for product details, categories, condition, materials, measurements, and additional attributes.
* Automatic description and tag generation using supplied product information.
* Live listing preview with individual copy controls.
* Draft saving, retrieval, and editing.
* Listing completeness indicators.
* Inventory SKU management.

2. Assisted Market Research

* Optional server-side research powered by a Python API endpoint and SerpApi.
* Searches for potential sold-listing leads from eBay and Poshmark.
* Manual verification of comparable listings and sale prices.
* User-confirmed comparable prices and median calculations.
* Relevant product wording suggestions for listing optimization.
* Manual marketplace research available without an API connection.

Search results are research leads rather than independently verified transaction records.

3. Pricing & Profit Calculator

* Cost-of-goods tracking.
* Estimated marketplace and payment-processing fees.
* Shipping, packaging, advertising, and mileage cost inputs.
* Minimum profit and target-margin calculations.
* Return on investment and profitability estimates.
* Suggested pricing targets and room-for-offers calculations.
* Ability to apply calculated pricing directly to a listing.

Pricing results are estimates based on user-supplied assumptions.

4. Inventory Dashboard

* Centralized saved-listing management.
* Listing statuses: Draft, Ready to List, Listed, and Sold.
* Searchable and sortable inventory records.
* SKU-based inventory organization.
* Listing editing, duplication, and deletion.
* Bulk record selection and export.
* Inventory backup, import, and recovery tools.

5. Smart Listing Templates

* Reusable product description and shipping templates.
* Customizable condition disclosures and seller notes.
* Item-specific placeholders that update using listing information.
* Reusable tags and listing language.
* Custom SKU settings.

6. Product Photography Guidance

* Category-specific photography checklists.
* Recommended product angles, label photographs, measurement images, and flaw documentation.
* Customizable photography requirements.
* Photo preparation guidance for cross-platform compatibility.
* Checklist progress saved with listing drafts.

7. Marketplace Data Preparation

* Listing-form previews for Flyp, eBay, and Poshmark.
* Platform-specific field formatting.
* Copyable listing details.
* Downloadable form-field worksheets.
* CSV and JSON inventory exports.
* Excel spreadsheet export with inventory and pricing worksheets.

Marketplace-specific exports assist with manual listing preparation. They do not automatically publish products or constitute native marketplace bulk-upload integrations.

⸻

Technology Stack

Technology	Purpose
HTML5	Application structure and semantic markup
CSS3	Responsive layouts and visual styling
JavaScript	Interactive features, form logic, and data processing
Bootstrap 5.3	Responsive interface components
Bootstrap Icons	Interface iconography
Browser LocalStorage	Client-side inventory and draft persistence
Python	Backend development and API handling
SerpApi	External search service for assisted market research
Vercel	Deployment and serverless API hosting
GitHub Pages	Static application deployment
Git & GitHub	Version control and source-code management

Application Architecture

Listing Lab uses a local-first architecture with an optional backend service.

Frontend

HTML, CSS, and JavaScript provide listing management, pricing tools, templates, inventory operations, and export functionality.

Local Data Storage

Saved listings, drafts, templates, and settings are stored in the user’s browser through LocalStorage.

Backend

A Python endpoint supports optional external market research. The endpoint communicates with SerpApi without exposing the API key in client-side JavaScript.

Deployment

The application is hosted on Vercel for backend-enabled functionality. A static version is also hosted on GitHub Pages.

⸻

Getting Started

Run the Static Application Locally

1. Clone the repository:
    git clone https://github.com/Fashnlvr/listing-lab-capstone-prototype.git
2. Open the project directory:
    cd listing-lab-capstone-prototype
3. Start a local static server:
    python3 -m http.server 8000
4. Open http://localhost:8000 in your browser.

Alternatively, open the project in Visual Studio Code and run it using the Live Server extension.

Run with API-Assisted Research

To enable the optional research backend:

1. Obtain a SerpApi API key.
2. Set the SERPAPI_KEY environment variable or provide the key through the local server’s secure terminal prompt.
3. Start the Python server:
    python3 server.py
4. Visit http://127.0.0.1:8000/new-listing.html.
5. Enter a product title and select Research with API.

Never commit API keys or other credentials to GitHub.

See LIVE_SEARCH.md for detailed backend configuration and deployment instructions.

⸻

Testing & Quality Assurance

Listing Lab includes frontend and backend regression tests covering listing management, drafts, templates, research behavior, pricing calculations, exports, and other application workflows.

Run the automated tests with:

python3 -m unittest discover -s tests -v

Additional browser workflow testing and responsive layout validation are documented in FUNCTIONALITY_AUDIT.md.

Project Documentation

Additional technical documentation is available in the repository:

* Live Market Research
* Marketplace Exports
* Pricing & Spreadsheet Export
* Template Guide
* Functionality Audit

Current Limitations

* Inventory and draft data are stored locally in the browser rather than synchronized across user accounts.
* Assisted market research requires a configured backend and external API access.
* Search results must be verified before being used as comparable sales.
* Marketplace exports support manual entry and data preparation, not direct marketplace publishing.
* User authentication, cloud database storage, and production-grade API access controls are not currently included.

Future Development

Potential enhancements include:

* Secure user accounts and cloud-based inventory synchronization.
* Expanded marketplace research and pricing assistance.
* Improved marketplace-specific export compatibility.
* More advanced inventory analytics and sales reporting.
* Additional workflow automation and integration options.
* Usability testing and improvements based on real reseller feedback.

⸻

Project Background

Listing Lab originated as a graduate capstone project in the University of Florida’s Master of Arts in Mass Communication program, with a concentration in Web Design and Online Communication.

The project combines front-end development, user experience design, applied research, and digital product development to address a practical business problem.

Continued development focuses on turning the original academic prototype into a more capable, user-centered resale productivity application.

License

This project is licensed under the MIT License. See LICENSE for details.

⸻

Listing Lab — Research smarter. List faster. Stay organized.
