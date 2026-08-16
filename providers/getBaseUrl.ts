// The provider URL manifest endpoint comes from the environment — the single
// source of truth, set as `URLS_MANIFEST_URL` in the repo's `.env` (see
// `.env.example`). Both runtimes read the same variable, so whatever is
// configured there is used end-to-end with no duplicated URL constants.
//
// This constant is only the built-in fallback for zero-config setups: it is
// never consulted when `URLS_MANIFEST_URL` is set.
const DEFAULT_URLS_ENDPOINT =
  'https://raw.githubusercontent.com/harusharu/stream-providers/refs/heads/main/urls.json';
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

/** Resolve the manifest endpoint from the environment (fallback to default). */
function urlsEndpoint(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env ? process.env.URLS_MANIFEST_URL : undefined;
  return fromEnv && fromEnv.trim() !== '' ? fromEnv.trim() : DEFAULT_URLS_ENDPOINT;
}

async function fetchProviderUrls(): Promise<ProviderUrls> {
  const cache = getCache();

  if (cache.data && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  if (cache.request) {
    return cache.request;
  }

  const request = fetch(urlsEndpoint())
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
    })
    .finally(() => {
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
