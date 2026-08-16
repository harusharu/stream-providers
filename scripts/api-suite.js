// Functional test suite for a stream-providers API gateway.
// Usage: node scripts/api-suite.js [quick] [API_BASE]  (API_BASE default http://localhost:8787)
const QUICK = process.argv[2] === 'quick';
const BASE = process.argv[3] ?? process.env.API_BASE ?? 'http://localhost:8787';

let passed = 0;
let failed = 0;
const failures = [];

async function req(path, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, { signal: ctrl.signal });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
    return { status: res.status, json, text };
  } catch (err) {
    return { status: 0, json: null, text: `ERROR: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

function report(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function okEnvelope(j) {
  return j && j.success === true;
}

async function main() {
  console.log(`\n=== RUST API @ ${BASE} ===`);

  console.log(`\n--- 1. System ---`);
  {
    const r = await req('/health');
    report(
      'GET /health',
      r.status === 200 && r.json?.status === 'healthy' && r.json?.providers === 9,
      `status=${r.status} ${JSON.stringify(r.json)}`,
    );
    const p = await req('/providers');
    report(
      'GET /providers',
      p.status === 200 && Array.isArray(p.json?.providers) && p.json.providers.length === 9,
      `status=${p.status}`,
    );
    const i = await req('/info');
    report('GET /info', i.status === 200 && Array.isArray(i.json?.providers), `status=${i.status}`);
    const u = await req('/urls.json');
    report(
      'GET /urls.json',
      u.status === 200 && Object.keys(u.json || {}).length >= 30,
      `status=${u.status} providers=${Object.keys(u.json || {}).length}`,
    );
    const d = await req('/');
    report(
      'GET / (dashboard)',
      d.status === 200 && d.text.includes('<!doctype'),
      `status=${d.status}`,
    );
    const l = await req('/api/providers');
    report(
      'GET /api/providers (legacy)',
      l.status === 200 && okEnvelope(l.json) && Array.isArray(l.json.data),
      `status=${l.status}`,
    );
  }

  console.log(`\n--- 2. Catalog ---`);
  for (const p of ['vega', 'showbox', 'movieBoxWeb', '4khdhub']) {
    const r = await req(`/api/catalog?provider=${p}`, 30000);
    const ok =
      r.status === 200 &&
      okEnvelope(r.json) &&
      Array.isArray(r.json.data) &&
      r.json.data.length > 0;
    report(
      `GET /api/catalog?provider=${p}`,
      ok,
      `status=${r.status} items=${r.json?.data?.length ?? 0}`,
    );
  }

  console.log(`\n--- 3. Search ---`);
  {
    const r = await req('/api/search?provider=vega&query=inception', 45000);
    const items = r.json?.data ?? [];
    report(
      'GET /api/search?provider=vega&query=inception',
      r.status === 200 &&
        okEnvelope(r.json) &&
        items.length > 0 &&
        items.every((x) => x.title && x.link),
      `status=${r.status} results=${items.length}`,
    );
    global.__rustItems = items;
  }

  console.log(`\n--- 4. Search-all (fan-out) ---`);
  {
    const r = await req('/api/search-all?query=inception&providers=vega,showbox', 60000);
    const d = r.json?.data;
    report(
      'GET /api/search-all (2 providers)',
      r.status === 200 &&
        okEnvelope(r.json) &&
        Array.isArray(d?.data) &&
        d.data.length > 0 &&
        d.total > 0 &&
        typeof d.failed === 'number' &&
        d.providers === 2,
      `status=${r.status} total=${d?.total ?? 0} failed=${d?.failed ?? 'n/a'} providers=${d?.providers ?? 'n/a'}`,
    );
    const r2 = await req('/api/search-all?query=inception', 90000);
    report(
      'GET /api/search-all (all providers)',
      r2.status === 200 && r2.json?.data?.total > 0,
      `status=${r2.status} total=${r2.json?.data?.total ?? 0}`,
    );
  }

  console.log(`\n--- 5. Errors & envelope ---`);
  {
    const r = await req('/api/catalog?provider=nope');
    report(
      'unknown provider -> 400 BAD_REQUEST',
      r.status === 400 && r.json?.success === false && r.json?.code === 'BAD_REQUEST',
      `status=${r.status}`,
    );
    const r2 = await req('/api/does-not-exist');
    report(
      'unknown route -> 404',
      r2.status === 404 && r2.json?.success === false,
      `status=${r2.status}`,
    );
    const r3 = await req('/api/search?provider=vega');
    report(
      'missing query -> 400',
      r3.status === 400 && r3.json?.success === false,
      `status=${r3.status}`,
    );
    const r4 = await req('/api/catalog');
    report(
      'missing provider -> 200 (default provider fallback)',
      r4.status === 200 && okEnvelope(r4.json) && Array.isArray(r4.json.data),
      `status=${r4.status}`,
    );
    const r5 = await req('/api/search?provider=vega&query=');
    report(
      'empty query -> 400 BAD_REQUEST',
      r5.status === 400 && r5.json?.code === 'BAD_REQUEST',
      `status=${r5.status} code=${r5.json?.code}`,
    );
    const r6 = await req('/api/stream?provider=vega&link=%2Fbad&type=movie', 45000);
    report(
      'stream with bad link handled (404/502)',
      [404, 502].includes(r6.status) && r6.json?.success === false,
      `status=${r6.status}`,
    );
  }

  if (!QUICK && Array.isArray(global.__rustItems) && global.__rustItems.length > 0) {
    const item = global.__rustItems[0];
    console.log(`\n--- 6. Deep scrape (${item.title}) ---`);
    let metaData = null;
    {
      const r = await req(`/api/meta?provider=vega&link=${encodeURIComponent(item.link)}`, 60000);
      metaData = r.json?.data;
      report(
        'GET /api/meta',
        r.status === 200 &&
          okEnvelope(r.json) &&
          !!metaData &&
          !!metaData.title &&
          Array.isArray(metaData.linkList),
        `status=${r.status}`,
      );
    }
    {
      const directLink = metaData?.linkList?.[0]?.directLinks?.[0];
      if (!directLink?.link) {
        report('GET /api/stream (via meta directLink)', false, 'no directLink in meta');
      } else {
        const r = await req(
          `/api/stream?provider=vega&link=${encodeURIComponent(directLink.link)}&type=${directLink.type || 'movie'}`,
          60000,
        );
        report(
          'GET /api/stream (via meta directLink)',
          r.status === 200 &&
            okEnvelope(r.json) &&
            Array.isArray(r.json.data) &&
            r.json.data.length > 0,
          `status=${r.status} sources=${r.json?.data?.length ?? 0}`,
        );
      }
    }
    // episodes: find a TV series result, then stream its episodesLink from meta
    const s = await req('/api/search?provider=vega&query=monarch', 45000);
    const series = (s.json?.data ?? []).find((x) => /season|series/i.test(x.title));
    if (!series?.link) {
      report(
        'TV series search found',
        false,
        `no series result in ${(s.json?.data ?? []).length} items`,
      );
    } else {
      const m = await req(`/api/meta?provider=vega&link=${encodeURIComponent(series.link)}`, 60000);
      const epLink = m.json?.data?.linkList?.[0]?.episodesLink;
      if (!epLink) {
        report('GET /api/episodes (TV)', false, 'no episodesLink in series meta');
      } else {
        const r = await req(`/api/episodes?provider=vega&url=${encodeURIComponent(epLink)}`, 60000);
        const episodes = Array.isArray(r.json?.data) ? r.json.data : [];
        report(
          'GET /api/episodes (TV)',
          r.status === 200 && okEnvelope(r.json) && episodes.length > 0,
          `status=${r.status} episodes=${episodes.length}`,
        );
      }
    }
  }

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  for (const f of failures) console.log(`\nFAILED: ${f.name}\n  ${f.detail}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
