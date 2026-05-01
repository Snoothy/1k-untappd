import fs from 'node:fs/promises';

const outputPath = new URL('../src/data/progress.json', import.meta.url);
const target = 1000;
const username = process.env.UNTAPPD_USERNAME || 'Snoothy';

async function writeProgress(data) {
  await fs.mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchFromWebsite() {
  const res = await fetch(`https://untappd.com/user/${username}`, {
    headers: { 'User-Agent': '1k-untappd scraper' }
  });

  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);

  const html = await res.text();

  // naive but stable: look for "Unique" stat block
  const match = html.match(/Unique[^0-9]*(\d{2,5})/i);

  if (!match) throw new Error('Could not parse unique beers');

  const current = Number(match[1].replace(/,/g, ''));

  return {
    username,
    displayName: username,
    avatarUrl: '',
    current,
    target,
    source: 'scraped',
    updatedAt: new Date().toISOString(),
  };
}

try {
  const data = await fetchFromWebsite();
  await writeProgress(data);
} catch (err) {
  console.warn(err);
  await writeProgress({
    username,
    displayName: username,
    avatarUrl: '',
    current: 800,
    target,
    source: 'fallback',
    updatedAt: new Date().toISOString(),
  });
}
