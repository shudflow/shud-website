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
