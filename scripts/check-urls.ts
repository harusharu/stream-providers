import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sites } from '../providers/_shared/sites.ts';

const sitesPath = join(dirname(fileURLToPath(import.meta.url)), '../providers/_shared/sites.ts');
const updated = [];

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function trailingSlash(url) {
  return url.endsWith('/') && !url.endsWith('://');
}

async function probe(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    });
    const finalUrl = res.url || url;
    console.log(`${url} -> status=${res.status} final=${finalUrl}`);
    const nextOrigin = originOf(finalUrl);
    if (nextOrigin && nextOrigin !== originOf(url)) {
      return nextOrigin + (trailingSlash(url) ? '/' : '');
    }
  } catch (err) {
    console.log(`Error checking ${url}: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function serialize(next) {
  const lines = Object.entries(next).map(
    ([id, site]) =>
      `  ${JSON.stringify(id)}: { name: ${JSON.stringify(site.name)}, url: ${JSON.stringify(site.url)} },`,
  );
  return `// Channel list and upstream site URLs. Change a URL here when a host moves.
export const sites = {
${lines.join('\n')}
} as const;

export type ProviderId = keyof typeof sites;

export function channelList(): Array<{ id: string; name: string }> {
  return Object.entries(sites).map(([id, site]) => ({ id, name: site.name }));
}

export function getBaseUrl(id: string): string {
  const site = (sites as Record<string, { url: string } | undefined>)[id];
  if (!site) throw new Error(\`unknown provider: \${id}\`);
  return site.url;
}

export function isKnownProvider(id: string): boolean {
  return id in sites;
}
`;
}

const next = { ...sites };

for (const [id, site] of Object.entries(sites)) {
  if (!site.url.startsWith('http')) continue;
  console.log(`Checking ${site.name} (${site.url})...`);
  const newUrl = await probe(site.url);
  if (!newUrl || newUrl === site.url) continue;
  next[id] = { ...site, url: newUrl };
  updated.push({ name: site.name, oldUrl: site.url, newUrl });
  console.log(`Updated ${site.name}: ${site.url} -> ${newUrl}`);
}

if (updated.length === 0) {
  console.log('No URL changes needed');
  process.exit(0);
}

writeFileSync(sitesPath, serialize(next));
console.log(`Updated ${sitesPath}`);
console.log('### UPDATED_PROVIDERS_START ###');
for (const row of updated) console.log(`${row.name}|${row.oldUrl}|${row.newUrl}`);
console.log('### UPDATED_PROVIDERS_END ###');
