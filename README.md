# Listing Lab

Listing Lab is a responsive web application for resellers that streamlines the work that happens before an item is posted to a marketplace. It gives sellers a browser-based workspace for organizing item details, checking pricing direction, building listing copy, saving reusable templates, and managing locally stored listing records without requiring a backend account or database.

## Overview

Listing Lab was built as a capstone project around a practical resale workflow. Instead of treating listing prep as a scattered mix of notes, pricing tabs, draft captions, and saved screenshots, the app brings those steps into 1 structured front-end experience. The current version is intentionally local-first and front-end only, with data stored in the browser through LocalStorage.

## Project Idea and Purpose

The idea behind Listing Lab is to support the pre-listing stage of resale work. Many marketplace tools begin once the listing is ready to publish, but the prep work before that point still takes time and organization. Listing Lab focuses on that earlier stage by helping users:

- gather item details
- organize pricing inputs and comp research
- build buyer-facing listing copy
- save reusable listing templates
- keep listing records organized before posting off-site

## Problem Statement

Resellers often lose time before a listing is published, not after. Important item details get scattered, pricing is inconsistent, listing copy gets rewritten from scratch, and saved records are hard to track across multiple drafts. Listing Lab addresses that problem by offering a focused, reusable workspace for pricing support, listing preparation, and local inventory organization.

## Inspiration

The project was inspired by the repetitive manual work involved in secondhand selling and resale prep. The goal was to create a polished capstone application that reflects a real seller workflow and solves a clear product problem without depending on backend infrastructure to demonstrate its value.

## Main Features

- **Create Listing**
  - Enter item details and save either a draft or a ready-to-list record
  - Use pricing support and manual comp entry for price direction
  - Generate buyer-facing listing copy, keywords, hashtags, and notes
  - Save and rotate through drafts in the browser

- **Dashboard**
  - Review saved listings in an inventory-style console
  - Filter, sort, duplicate, delete, and export records
  - Track status such as draft, ready, listed, and sold

- **Smart Templates**
  - Create reusable listing templates for repeated copy patterns
  - Store template sections such as descriptions, shipping notes, keywords, disclosures, and reminders
  - Configure a custom SKU system for new saved listings
  - Apply saved templates inside Create Listing

- **Pricing Support**
  - Use local pricing guidance
  - Open eBay sold listings and Poshmark search for manual comp research
  - Enter real comp prices and apply a comp median inside the listing workflow

- **Local-First Workflow**
  - Store listings, drafts, templates, and SKU settings in LocalStorage
  - Keep the experience fully front-end only for capstone scope

## Technology Used

- HTML5
- CSS3
- Vanilla JavaScript
- Bootstrap 5.3
- Bootstrap Icons
- Browser LocalStorage
- Git and GitHub
- GitHub Pages for deployment

## Responsive Design

Listing Lab is designed to work across:

- mobile
- tablet
- desktop

The project includes responsive navigation, mobile-friendly card layouts, stacked controls on smaller screens, and a mobile bottom navigation for key workflows.

## Live Site

- **Live Site URL:** https://fashnlvr.github.io/listing-lab-capstone/
- **Repository URL:** https://github.com/Fashnlvr/listing-lab-capstone

If either URL changes before submission, replace the links above and keep this section near the top of the README.

## How to Run Locally

This project does not require a package manager or backend server. It can be run with any simple static server.

### Option 1: Python

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Option 2: VS Code Live Server

1. Open the project folder in VS Code.
2. Install the Live Server extension if needed.
3. Right-click `index.html`.
4. Choose `Open with Live Server`.

## File Structure

```text
listing-lab-capstone-prototype/
├── index.html
├── new-listing.html
├── dashboard.html
├── templates.html
├── pricing.html
├── how-it-works.html
├── about.html
├── features.html
├── integrations.html
├── listing.html
├── styles.css
├── script.js
├── config.js
├── favicon.svg
└── README.md
```

## Screenshots

Add final screenshots before portfolio publishing or submission if available.

### Homepage

```md
![Listing Lab Homepage](path/to/homepage-screenshot.png)
```

### Create Listing

```md
![Create Listing Page](path/to/create-listing-screenshot.png)
```

### Dashboard

```md
![Dashboard Page](path/to/dashboard-screenshot.png)
```

### Smart Templates

```md
![Smart Templates Page](path/to/templates-screenshot.png)
```

## Contribution Instructions

This project is being submitted as a capstone, but the repository can still be approached with a standard contribution workflow:

1. Fork the repository.
2. Create a feature branch.
3. Make focused, documented changes.
4. Test the affected pages locally.
5. Open a pull request with a concise summary of the change.

For presentation or grading purposes, direct edits in the main repository should stay conservative and aligned with the current product concept.

## Future Improvements

- add stronger marketplace-specific pricing support through a secure backend
- support template import and export across devices
- expand inventory activity and history views
- add richer media handling for photo prep
- support optional marketplace-specific output presets

## Notes

- Listing Lab is intentionally front-end only in its current form.
- Data is stored locally in the browser.
- No authentication or backend database is required for the capstone version.
- Pricing support is honest about its data source: local guidance plus user-entered comp research where applicable.
