// Provider base-URL resolution, local-first with no GitHub dependency.
//
// Resolution order:
//   1. `URLS_MANIFEST_URL` set -> fetch that manifest endpoint over the
//      network (the worker intercepts it and falls back to the local copy on
//      failure — for deployments that host their own manifest).
//   2. Unset (default) -> read `urls.json` straight from the local project
//      directory (`PROVIDERS_ROOT`, else cwd). The repo keeps that file fresh
//      via the `check-urls` GitHub Action (runs daily + on demand), so
//      whatever is deployed locally is always the latest manifest.
//
// Both runtimes run the bundles with cwd = PROVIDERS_ROOT (Rust spawns the
// sidecar there; the Node gateway loads bundles in-process), so the local
// read works identically everywhere.
import { readFileSync } from 'fs';
import { join } from 'path';

const cacheTtl = 60 * 60 * 1000;

type ProviderUrls = Record<string, { url: string }>;

type BaseUrlCache = {
  data?: ProviderUrls;
  expiresAt: number;
  request?: Promise<ProviderUrls>;
};

type ProviderState = {
  __vegaProviderBaseUrlCache__?: BaseUrlCache;
};

declare const providerGlobal: ProviderState | undefined;

function getCache(): BaseUrlCache {
  const state =
    typeof providerGlobal !== 'undefined' && providerGlobal
      ? providerGlobal
      : (globalThis as typeof globalThis & ProviderState);

  state.__vegaProviderBaseUrlCache__ ??= { expiresAt: 0 };
  return state.__vegaProviderBaseUrlCache__;
}

/** Resolve the optional manifest endpoint from the environment ('' = local). */
function urlsEndpoint(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env ? process.env.URLS_MANIFEST_URL : undefined;
  return fromEnv && fromEnv.trim() !== '' ? fromEnv.trim() : '';
}

/** Read urls.json from the local project directory (cwd is PROVIDERS_ROOT). */
function readLocalUrls(): ProviderUrls {
  const root =
    typeof process !== 'undefined' && process.env?.PROVIDERS_ROOT
      ? process.env.PROVIDERS_ROOT
      : process.cwd();
  try {
    return JSON.parse(readFileSync(join(root, 'urls.json'), 'utf8')) as ProviderUrls;
  } catch {
    return {};
  }
}

async function fetchProviderUrls(): Promise<ProviderUrls> {
  const cache = getCache();

  if (cache.data && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  if (cache.request) {
    return cache.request;
  }

  let request: Promise<ProviderUrls>;
  const endpoint = urlsEndpoint();

  if (endpoint === '') {
    request = Promise.resolve().then(() => {
      cache.data = readLocalUrls();
      cache.expiresAt = Date.now() + cacheTtl;
      return cache.data;
    });
  } else {
    request = fetch(endpoint)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`URL configuration request failed: ${response.status}`);
        }

        const data = (await response.json()) as ProviderUrls;
        console.log('Fetched provider URL configuration');
        cache.data = data;
        cache.expiresAt = Date.now() + cacheTtl;
        return data;
      })
      .catch((error) => {
        if (cache.data) {
          console.warn('Using stale provider URL configuration', error);
          return cache.data;
        }

        throw error;
      });
  }

  request.finally(() => {
    cache.request = undefined;
  });

  Object.defineProperty(cache, 'request', {
    configurable: true,
    enumerable: false,
    value: request,
    writable: true,
  });
  return request;
}

export const getBaseUrl = async (providerValue: string) => {
  try {
    const providerUrls = await fetchProviderUrls();
    return providerUrls[providerValue]?.url ?? '';
  } catch (error) {
    console.error(`Error fetching baseUrl: ${providerValue}`, error);
    throw error;
  }
};
