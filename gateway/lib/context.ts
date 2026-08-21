import { createRequire } from 'node:module';
import axios, { type AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import type { CffiClient } from './cffi-adapter.ts';
import { installAxiosAdapter, installFetchShim } from './cffi-adapter.ts';

export interface ProviderContext {
  axios: AxiosInstance;
  cheerio: typeof import('cheerio');
  Aes: null;
  commonHeaders: Record<string, string>;
}

function loadOptionalCffi(): CffiClient | undefined {
  const require = createRequire(import.meta.url);
  try {
    return require('curl-cffi-node') as CffiClient;
  } catch {
    return undefined;
  }
}

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
};

export function buildProviderContext(): ProviderContext {
  const cffi = loadOptionalCffi();
  installFetchShim(cffi);
  installAxiosAdapter(axios, cffi);

  return {
    axios,
    cheerio,
    Aes: null,
    commonHeaders: COMMON_HEADERS,
  };
}
