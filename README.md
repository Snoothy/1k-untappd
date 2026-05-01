# 1k Untappd

A small Astro + Preact site for tracking the road to 1,000 Untappd check-ins.

The current placeholder progress is `800 / 1000`.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, builds the static Astro site, and publishes `dist/` to GitHub Pages.

In the repository settings, make sure **Pages** is configured to use **GitHub Actions** as the source.
