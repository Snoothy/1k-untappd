import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

export default defineConfig({
  integrations: [preact()],
  site: 'https://snoothy.github.io',
  base: '/1k-untappd',
});
