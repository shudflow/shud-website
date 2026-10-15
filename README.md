# Shudflow website

Team status page for Shudflow: hero, status, open decisions, team, links. Static site on [Astro](https://astro.build), no CSS framework, no backend, no analytics or trackers.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:4321
```

## Edit content

All text and links live in one file: [`src/content.json`](src/content.json).

- `status.date` and `status.items[]`: `state` is `done`, `progress` or `planned`.
- `decisions.items[]`, `team.items[]`, `links.items[]` (`private: true` adds a "private" label).
- `meta.url` is the canonical address; `links.contact` is the public contact.

Layout is in `src/pages/index.astro`, styles in `src/styles/global.css` (colours are CSS variables; the dark theme redefines them).

## Build

```bash
npm run build      # output in dist/
npm run preview    # serve dist/ locally
```

`dist/` is plain static HTML/CSS and can be hosted anywhere. Pushes to `main` deploy to GitHub Pages (`.github/workflows/pages.yml`); it can also be run by hand from the Actions tab.

## Domain

Target address: `https://plan.shudflow.com` (set in `astro.config.mjs` and `src/content.json`).
`public/CNAME` is there for GitHub Pages. To go live: add a DNS `CNAME` record `plan` → `shudflow.github.io` at the registrar and enable Pages for this repo.
The root `shudflow.com` already serves a different site and is not touched.

## Price calculator

`src/components/PriceCalculator.astro` shows the package that fits a shop and the monthly price per shop. Put it on a page with `<PriceCalculator contactHref="#contact" />` (`contactHref` is where "Talk to us" points; default `#links`).

All numbers live in `src/pricing.json`; the logic in `src/lib/pricing.ts` has none. Change the file, rebuild, and the result changes. A malformed file fails the build.

- Package: the first entry in `packages` (keep them from smallest to largest) whose `maxProducts`, `maxConversations` (per shop, per month) and `maxLanguages` all fit. Above the largest one: custom plan.
- Price per shop: `(priceMonthly + conversations × answersPerConversation × costPerAnswer × (1 + markupPercent / 100)) × (1 − discountPercent / 100)`, where the discount is the largest `shopDiscounts` tier whose `minShops` is reached. Total = price per shop × shops.
- Any figure the price needs that is `null` (not approved yet) → the package is still shown, with "Price after consultation" instead of a number.

`costPerAnswer` per model comes from the provider table in shudflow/shud-ai-service#19; packages, limits and markup from shudflow/shud-platform#37. Until those are approved every price is `null`.

Tests: `npm test`.
