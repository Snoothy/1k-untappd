import fs from 'node:fs/promises';

const outputPath = new URL('../src/data/progress.json', import.meta.url);
const target = 1000;
const username = process.env.UNTAPPD_USERNAME || 'Snoothy';

const fallbackData = {
  username,
  displayName: username,
  avatarUrl: '',
  current: 800,
  target,
  source: 'fallback',
  updatedAt: new Date().toISOString(),
};

async function writeProgress(data) {
  await fs.mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function parseUniqueBeers(html) {
  const text = normalizeText(html);
  const number = String.raw`([\d,.]+\s*[KMB]?)`;

  const patterns = [
    // User profile pages render stats like: "1,234 Total 987 Unique 42 Badges 10 Friends".
    new RegExp(`${number}\\s+Unique\\b`, 'i'),
    // Brewery/beer pages render stats like: "Unique (?) 987".
    new RegExp(`\\bUnique(?:\\s*\\(\\?\\))?\\s+${number}`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseCompactNumber(match[1]);
    }
  }

  throw new Error('Could not parse unique beers');
}

function parseCompactNumber(value) {
  const trimmed = value.replace(/,/g, '').trim().toUpperCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)([KMB])?$/);

  if (!match) throw new Error(`Could not parse number: ${value}`);

  const [, amount, suffix] = match;
  const multiplier = suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : suffix === 'B' ? 1_000_000_000 : 1;

  return Math.round(Number(amount) * multiplier);
}

async function fetchFromWebsite() {
  const res = await fetch(`https://untappd.com/user/${username}`, {
    headers: { 'User-Agent': '1k-untappd static site builder' },
  });

  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);

  const html = await res.text();
  const current = parseUniqueBeers(html);

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
  await writeProgress(await fetchFromWebsite());
} catch (error) {
  console.warn(error instanceof Error ? error.message : error);
  console.log('Falling back to placeholder progress data so the deploy can continue.');
  await writeProgress(fallbackData);
}
