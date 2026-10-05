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
- **Tap the number 10 times** — replay the star flight and explosion without changing the count or progress. Enter/Space on the focused number also counts as a tap.
- **Escape** — leave browser full screen.

The production page fills the screen without a control footer. Use the keyboard shortcuts above to operate the projector. Reduced-motion preferences start the scene paused, and finale previews show the completed state immediately.

A preview is explicitly labelled **FINALE PREVIEW**. It does not modify data. Leaving the preview restores the most recently received real snapshot, including counts above the goal.

Each confirmed increase launches a bright star from the solar corona. It curves outward, leaves a gold-and-white trail, then accelerates into the middle of the counter. The number advances on impact, with a white-hot pulse, expanding shockwaves and a shower of sparks. Reaching the goal starts the full finale at that same impact. Press **Space** to see the sequence in the finale preview.

The flight lasts 2.2 seconds. New snapshots received in flight are combined into the latest confirmed value; identical readings never replay it. Corrections and recovery from demo data apply directly. Paused or reduced-motion displays update immediately, and pausing in flight settles on the latest real count.

The ten-tap replay is purely visual. Its tap counter resets after triggering, and a replay requested during another animation waits its turn. It respects paused and reduced-motion settings.

## Progress data

`npm run fetch:untappd` scrapes the public Untappd profile’s **Unique** count and writes `src/data/progress.json`. Set `UNTAPPD_USERNAME` to change the profile; it defaults to `Snoothy`. No API credentials are required.

Astro embeds a build snapshot in the initial HTML so the page is immediately readable. The browser then requests fresh progress immediately and every **30 seconds** from the Sites API configured in `src/data/live-config.json`. The API reads Snoothy’s public Untappd profile and shares a **60-second cache**; healthy updates typically appear within about **60–90 seconds**, subject to Untappd’s own updates and availability. The count and progress bar update in place, and crossing the goal triggers the finale automatically.

The endpoint is `https://snoothy-live-progress.snoothy.chatgpt.site/api/progress`. It is public and read-only, permits the GitHub Pages origin through CORS, requires no browser credentials and only exposes the progress snapshot. Its source is maintained in the companion **Snoothy Live Progress** Site. The root of that Site redirects to this projector page.

Polling pauses in hidden tabs or offline, resumes on visibility/focus/reconnection, avoids overlapping requests, times out after eight seconds and backs off to at most five minutes on failure. The screen keeps the original update time and shows **RECONNECTING** or **OFFLINE · LAST UPDATE** when appropriate. API failures never fabricate a count. `/1k-untappd/progress.json` remains a secondary build-snapshot fallback; it is not presented as live data.

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

The existing scheduled rebuilds run daily at **05:17 UTC** and hourly **18:00–23:00 UTC on Friday and Saturday**. These rebuilds provide the fallback snapshot; near-live updates use the separate Sites API and do not wait for a deployment.
