# Supernova — Road to 1k

An Astro site tracking Snoothy’s road to **1,000 unique beers**, designed for a projector. Supernova’s animated corona, orbital sparks, travelling flares and milestone celebration run locally in Canvas; no external fonts, images or animation services are needed.

## Run locally

```bash
npm ci
npm run dev
```

## Projector controls

- **F** — enter or exit full screen.
- **P** — pause or resume motion.
- **S** — trigger a solar flare without changing progress.
- **Space** — preview the finale, then return to the real count.
- **Escape** — leave browser full screen.

The production page fills the screen without a control footer. Use the keyboard shortcuts above to operate the projector. Reduced-motion preferences start the scene paused, and finale previews show the completed state immediately.

A preview is explicitly labelled **FINALE PREVIEW**. It does not modify data. Leaving the preview restores the most recently received real snapshot, including counts above the goal.

## Progress data

`npm run fetch:untappd` scrapes the public Untappd profile’s **Unique** count and writes `src/data/progress.json`. Set `UNTAPPD_USERNAME` to change the profile; it defaults to `Snoothy`. No API credentials are required.

Astro embeds that snapshot in the initial HTML and publishes the same data at `/1k-untappd/progress.json`. An open page checks that static endpoint every 60 seconds and when it becomes visible again. It can pick up new deployments without reloading. This is a build-time snapshot, not a direct live connection to Untappd; the screen displays the source and actual update time.

If scraping fails, the existing fetch script supplies the **800 / 1,000** fallback, visibly labelled **DEMO DATA**. A page already showing a confirmed count retains it if a later response is fallback data, older data, malformed or unavailable.

## Validate and build

```bash
npm run check
npm run test:unit
npm run build:static
npx playwright install chromium
npm run test:e2e
```

`build:static` uses the checked-in snapshot, making validation independent of Untappd availability. `npm run build` refreshes Untappd data, checks the project and builds it. `npm run preview` serves the build locally.

Pull requests run type checks, data tests, the static build and Chromium checks for data refresh, finale restoration, full screen, mobile layout and reduced motion. The browser job uploads screenshots and failure traces as an artifact.

## Deployment

Merging to `main` runs `.github/workflows/deploy.yml`, refreshes progress and publishes the static site to GitHub Pages. Pages must use **GitHub Actions** as its source.

The existing scheduled rebuilds run daily at **05:17 UTC** and hourly **18:00–23:00 UTC on Friday and Saturday**. The client refresh interval does not increase the frequency of those upstream scrapes.
