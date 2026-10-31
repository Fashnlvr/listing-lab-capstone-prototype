
# Listing Lab — Smart Resale Listing Assistant

**A responsive, local-first web application designed to simplify resale listing preparation, pricing research, inventory management, and cross-platform listing workflows.**

[![Live Application](https://img.shields.io/badge/Live_App-Vercel-black?logo=vercel)](https://listing-lab-capstone-prototype.vercel.app/)
[![Static Demo](https://img.shields.io/badge/Static_Demo-GitHub_Pages-blue?logo=github)](https://fashnlvr.github.io/listing-lab-capstone-prototype/)
![Project Status](https://img.shields.io/badge/Status-Functional_Prototype-purple)
![License](https://img.shields.io/badge/License-MIT-green)

**Live Application:** [Launch Listing Lab](https://listing-lab-capstone-prototype.vercel.app/)

**Static Demo:** [GitHub Pages Version](https://fashnlvr.github.io/listing-lab-capstone-prototype/)

**Project Status:** Functional Prototype | Ongoing Development

---

## 📌 Project Overview

**Listing Lab** is a web-based resale productivity application designed to streamline the work required before publishing products on online marketplaces such as eBay and Poshmark.

Originally developed as a graduate web design capstone project, Listing Lab has evolved into a functional web application featuring:

- Guided listing creation and content generation
- API-assisted market research
- Pricing and profitability calculations
- Inventory management and organization
- Reusable listing templates
- Product photography guidance
- Marketplace-specific listing preparation
- Spreadsheet and inventory data exports

The application combines product research, listing preparation, and inventory organization into a centralized, user-friendly workspace.

### The Problem

Online resellers frequently manage their businesses across multiple tools, including spreadsheets, marketplace listing forms, research tabs, photographs, and personal notes.

This fragmented workflow creates several challenges:

- Repetitive data entry across selling platforms
- Inconsistent product descriptions and pricing decisions
- Difficulty tracking inventory and listing progress
- Disorganized comparable-sales research
- Time-consuming preparation before publishing listings

### The Solution

Listing Lab provides a structured pre-listing workspace that helps resellers prepare products more efficiently, maintain consistent information, and organize inventory before publishing across marketplaces.

The application is designed for casual sellers, growing resellers, and small online resale businesses.

---

## 🚀 Core Features

### 1. Guided Listing Creation

A structured listing workflow designed to simplify the process of preparing resale inventory.

**Features include:**

- Product information and category-specific attributes
- Brand, condition, material, color, and measurement fields
- Automatic listing description and tag generation
- Live listing preview
- Individual copy controls for listing information
- Draft saving, retrieval, and editing
- Listing completeness indicators
- Custom SKU management

### 2. API-Assisted Market Research

Optional market research functionality powered by a Python backend and SerpApi.

**Features include:**

- Search-assisted comparable-listing research
- Potential sold-listing leads from eBay and Poshmark
- Relevant listing keywords and product wording suggestions
- Manual comparable-sales verification
- User-confirmed comparable prices
- Median comparable-price calculations
- Manual research options when API access is unavailable

> **Note:** API research results provide potential comparable-listing leads. Results are not guaranteed verified completed-sale transactions and should be reviewed by the seller.

### 3. Pricing & Profit Calculator

Interactive pricing tools designed to support more informed resale pricing decisions.

**Features include:**

- Cost-of-goods tracking
- Estimated marketplace fees
- Shipping and packaging expenses
- Advertising and additional selling costs
- Minimum profit calculations
- Target profit margins
- Return on investment (ROI) estimates
- Suggested listing prices
- Offer and discount calculations
- Ability to apply calculated pricing to listing records

> Pricing calculations are estimates based on user-provided costs, fees, and assumptions.

### 4. Inventory Management Dashboard

A centralized workspace for organizing saved product records and managing listing progress.

**Features include:**

- Searchable and sortable inventory
- Custom inventory SKUs
- Listing status management
- Draft, Ready to List, Listed, and Sold statuses
- Record editing and duplication
- Bulk record selection
- Inventory data exports
- Backup, import, and recovery options

### 5. Smart Listing Templates

Customizable templates that help sellers maintain consistent listing information.

**Features include:**

- Reusable product descriptions
- Shipping templates
- Condition disclosures
- Seller notes
- Dynamic item-specific placeholders
- Reusable listing language and tags
- Custom SKU settings

### 6. Product Photography Guidance

Category-specific photography guidance designed to help sellers create more complete and consistent product listings.

**Features include:**

- Product photography checklists
- Recommended product angles
- Brand and size tag documentation
- Material and care label documentation
- Measurement photograph guidance
- Product flaw documentation
- Platform-compatible image preparation guidance
- Customizable photography requirements
- Saved checklist progress

### 7. Marketplace Listing Preparation & Exports

Listing Lab prepares structured listing information for use across reseller tools and marketplaces.

**Supported workflows include:**

- Flyp listing preparation
- eBay listing preparation
- Poshmark listing preparation
- Marketplace-specific field previews
- Copyable listing information
- Downloadable listing worksheets
- CSV inventory exports
- JSON inventory exports
- Excel inventory and pricing worksheets

> Marketplace preparation tools support manual data transfer and listing organization. Listing Lab does not currently publish listings directly to marketplaces or provide native bulk-upload integrations.

---

## 🔄 Application Workflow

Listing Lab organizes the pre-listing process into four primary stages.

| Stage | Workflow | Description |
|---|---|---|
| 1 | Enter Essentials | Record product details, condition, measurements, and inventory information |
| 2 | Research & Price | Research comparable listings, calculate expenses, and establish pricing targets |
| 3 | Create Listing Content | Generate descriptions, organize tags, and complete photography requirements |
| 4 | Save & Export | Save inventory records and prepare marketplace-specific listing information |

This workflow is intended to reduce duplicate work and create a more consistent listing preparation process.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Semantic application structure and content |
| CSS3 | Custom styling and responsive design |
| JavaScript | Application logic, user interactions, and data processing |
| Bootstrap 5.3 | Responsive layouts and interface components |
| Bootstrap Icons | User interface iconography |
| Browser LocalStorage | Client-side inventory and draft persistence |
| Python | Backend functionality and API request handling |
| SerpApi | External search service for assisted market research |
| Vercel | Application deployment and serverless API hosting |
| GitHub Pages | Static application hosting |
| Git | Source control and development history |
| GitHub | Repository hosting and project documentation |

---

## 🏗️ Application Architecture

Listing Lab uses a **local-first application architecture** with optional server-side research functionality.

### Frontend

The frontend is developed using HTML, CSS, and JavaScript.

It handles:

- Listing creation and editing
- Form validation and user interactions
- Pricing calculations
- Live listing previews
- Inventory management
- Templates and photography checklists
- Data export operations

### Client-Side Storage

Browser LocalStorage supports persistent application data without requiring user accounts.

Locally stored information includes:

- Saved listings
- Draft records
- Inventory information
- Custom templates
- Application preferences

Data is stored within the user's browser and is not automatically synchronized between devices.

### Backend & API Integration

A Python backend supports optional search-assisted market research.

The backend communicates with SerpApi and processes external search responses for use within the listing workflow.

API credentials are intended to remain server-side rather than being exposed in frontend JavaScript.

### Deployment

Two versions of Listing Lab are available:

**Vercel Deployment**

[listing-lab-capstone-prototype.vercel.app](https://listing-lab-capstone-prototype.vercel.app/)

Primary application deployment, including support for server-side API functionality when configured.

**GitHub Pages Deployment**

[fashnlvr.github.io/listing-lab-capstone-prototype](https://fashnlvr.github.io/listing-lab-capstone-prototype/)

Static frontend deployment with core listing and inventory functionality. Server-side market research is unavailable in this version.

---

## 💻 Getting Started

### Prerequisites

- Modern web browser
- Git
- Python 3 for local server functionality
- Optional SerpApi API key for assisted market research

### 1. Clone the Repository

```bash
git clone https://github.com/Fashnlvr/listing-lab-capstone-prototype.git
```

### 2. Navigate to the Project Directory

```bash
cd listing-lab-capstone-prototype
```

### 3. Run the Static Application

Start a local development server:

```bash
python3 -m http.server 8000
```

Open the application in your browser:

```text
http://localhost:8000
```

You can also use the Live Server extension in Visual Studio Code.

### 4. Run with API-Assisted Research

To enable optional market research:

1. Obtain a SerpApi API key.
2. Configure the `SERPAPI_KEY` environment variable.
3. Start the Python backend:

```bash
python3 server.py
```

4. Open:

```text
http://127.0.0.1:8000/new-listing.html
```

5. Enter product information and select **Research with API**.

**Security:** Never commit API keys, passwords, or other credentials to the repository.

For additional configuration details, see [LIVE_SEARCH.md](LIVE_SEARCH.md).

---

## 🧪 Testing & Quality Assurance

Listing Lab includes automated regression tests and documented functionality reviews covering important application workflows.

Testing areas include:

- Guided listing creation
- Form behavior and validation
- Draft management
- Inventory operations
- Pricing calculations
- Research integration behavior
- Template functionality
- Data exports
- Responsive interface behavior

### Run Automated Tests

```bash
python3 -m unittest discover -s tests -v
```

For documented testing results and functionality reviews, see [FUNCTIONALITY_AUDIT.md](FUNCTIONALITY_AUDIT.md).

---

## 📚 Project Documentation

Additional project documentation is available in the repository.

| Document | Description |
|---|---|
| [Live Market Research](LIVE_SEARCH.md) | API research functionality, backend setup, and deployment details |
| [Marketplace Exports](MARKETPLACE_EXPORTS.md) | Marketplace field preparation and export workflows |
| [Pricing & Spreadsheet Export](PRICING_AND_SPREADSHEET.md) | Pricing calculations and spreadsheet functionality |
| [Template Guide](TEMPLATE_GUIDE.md) | Reusable listing templates and customization |
| [Functionality Audit](FUNCTIONALITY_AUDIT.md) | Testing coverage, functionality reviews, and development findings |

---

## ⚠️ Current Limitations

Listing Lab is an actively developed functional prototype rather than a fully commercialized SaaS platform.

Current limitations include:

- Inventory data is stored locally in the user's browser.
- Accounts and cross-device cloud synchronization are not currently available.
- API-assisted research requires backend configuration and external service access.
- Market research leads require seller verification.
- Marketplace exports support preparation and manual data transfer rather than automatic publishing.
- Production-grade authentication, persistent rate limiting, and advanced access controls remain future considerations.

These limitations guide ongoing development and future feature prioritization.

---

## 🔮 Future Development

Potential future enhancements include:

- Secure user accounts and cloud synchronization
- Expanded marketplace research functionality
- Improved market pricing assistance
- Additional inventory analytics
- Sales performance reporting
- Enhanced spreadsheet and marketplace compatibility
- More advanced workflow automation
- Additional reseller platform integrations
- User testing and accessibility improvements

Development priorities will continue to reflect reseller workflows, usability, and practical business value.

---

## 🎓 Project Background

Listing Lab originated as a graduate capstone project in the **University of Florida's Master of Arts in Mass Communication program**, with a concentration in Web Design and Online Communication.

The project applies concepts from:

- Front-end web development
- Responsive web design
- User experience (UX) design
- Information architecture
- JavaScript application development
- API integration
- Data organization and management
- Digital product development

Since its initial development, Listing Lab has continued evolving beyond its original academic scope into a more comprehensive resale productivity application.

The project demonstrates the process of identifying a real-world business problem, designing a user-centered solution, implementing application functionality, and iteratively improving the product.

---

## 📄 License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.

---

**Listing Lab — Research smarter. List faster. Stay organized.**
