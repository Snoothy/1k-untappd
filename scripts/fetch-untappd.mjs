import fs from 'node:fs/promises';

const outputPath = new URL('../src/data/progress.json', import.meta.url);
const target = 1000;

const fallbackData = {
  username: process.env.UNTAPPD_USERNAME || 'Snoothy',
  displayName: process.env.UNTAPPD_USERNAME || 'Snoothy',
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

function hasUntappdSecrets() {
  return Boolean(
    process.env.UNTAPPD_CLIENT_ID &&
      process.env.UNTAPPD_CLIENT_SECRET &&
      process.env.UNTAPPD_USERNAME,
  );
}

function untappdUrl(path, params = {}) {
  const url = new URL(`https://api.untappd.com/v4${path}`);
  url.searchParams.set('client_id', process.env.UNTAPPD_CLIENT_ID);
  url.searchParams.set('client_secret', process.env.UNTAPPD_CLIENT_SECRET);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

async function getJson(path, params = {}) {
  const response = await fetch(untappdUrl(path, params), {
    headers: {
      'User-Agent': '1k-untappd static site builder',
    },
  });

  if (!response.ok) {
    throw new Error(`Untappd API returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function fetchUntappdProgress() {
  const username = process.env.UNTAPPD_USERNAME;
  const userInfo = await getJson(`/user/info/${username}`);
  const user = userInfo.response?.user;
  const stats = user?.stats || {};

  const current = Number(
    stats.total_beers ?? stats.total_checkins ?? fallbackData.current,
  );

  return {
    username,
    displayName: user?.user_name || username,
    avatarUrl: user?.user_avatar || '',
    current,
    target,
    source: 'untappd',
    updatedAt: new Date().toISOString(),
  };
}

if (!hasUntappdSecrets()) {
  console.log('Untappd secrets are missing. Writing fallback progress data.');
  await writeProgress(fallbackData);
  process.exit(0);
}

try {
  await writeProgress(await fetchUntappdProgress());
} catch (error) {
  console.warn(error instanceof Error ? error.message : error);
  console.log('Falling back to placeholder progress data so the deploy can continue.');
  await writeProgress(fallbackData);
}
