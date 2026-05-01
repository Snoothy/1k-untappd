# 1k Untappd

A small Astro + Preact site for tracking the road to 1,000 Untappd check-ins.

The site uses fallback progress data, currently `800 / 1000`, when Untappd secrets are not configured or the Untappd API request fails. This keeps GitHub Pages deployments green.

## Development

```bash
npm install
npm run dev
```

## Fetch Untappd data

For live data, add these as GitHub Actions repository secrets:

- `UNTAPPD_CLIENT_ID`
- `UNTAPPD_CLIENT_SECRET`
- `UNTAPPD_USERNAME`

The build runs:

```bash
npm run fetch:untappd
```

If any secret is missing, `scripts/fetch-untappd.mjs` writes fallback data to `src/data/progress.json`.

## Build

```bash
npm run build
npm run preview
```

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, builds the static Astro site, and publishes `dist/` to GitHub Pages.

In the repository settings, make sure **Pages** is configured to use **GitHub Actions** as the source.
