// Query validation helpers + media-`type` inference.
//
// Mirrors the Rust `model` module: `requireNonEmpty`, `normalizeProvider`,
// `streamType`, and the `inferType`/`applyTypeHints` heuristics that fill in
// the `type` field harustream's home feed relies on.

import { ApiError } from './errors.ts';

/** Trim and default an optional provider value. */
export function normalizeProvider(raw: string | null | undefined, fallback: string): string {
  const trimmed = (raw ?? '').trim();
  return trimmed === '' ? fallback : trimmed;
}

/** Require a non-empty query parameter, bounding its length. */
export function requireNonEmpty(
  value: string | null | undefined,
  name: string,
  maxLen: number,
): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') throw ApiError.missingParam(name);
  if (trimmed.length > maxLen) {
    throw ApiError.invalidParam(`${name} exceeds ${maxLen} characters`);
  }
  return trimmed;
}

/** Parse the `page` param, defaulting to 1 and never below 1. */
export function parsePage(value: string | null | undefined): number {
  const n = value === undefined || value === null ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Normalise the `type` query param to `movie` or `series` (default `movie`). */
export function streamType(raw: string | null | undefined): 'movie' | 'series' {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'series' || v === 'tv' || v === 'show') return 'series';
  return 'movie';
}

/** Whether the given text looks like a TV series by common markers. */
function isSeriesMarker(hay: string): boolean {
  const MARKERS = [
    'season',
    'episode',
    'web-series',
    'web series',
    'netflix series',
    'complete series',
    'tv show',
    's01e',
  ];
  if (MARKERS.some((m) => hay.includes(m))) return true;
  // Generic s01e05 / s1e5 episode codes.
  return /s\d+e\d+/.test(hay);
}

/** Infer the media type (`movie` | `series`) from a provider post link/title. */
export function inferType(link: string, title: string): 'movie' | 'series' {
  const linkLower = link.toLowerCase();
  if (linkLower.includes('/movie/')) return 'movie';
  if (
    linkLower.includes('/tv/') ||
    linkLower.includes('/series/') ||
    linkLower.includes('/show/')
  ) {
    return 'series';
  }
  const hay = `${linkLower} ${title.toLowerCase()}`;
  return isSeriesMarker(hay) ? 'series' : 'movie';
}

/** A post item as returned by the providers. */
export interface PostItem {
  [key: string]: unknown;
}

/**
 * Fill in a missing `type` on each object of a provider array using the
 * `link`/`title` heuristics. Returns a new array (or the input unchanged when
 * it isn't an array).
 */
export function applyTypeHints(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  return data.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    const obj = item as Record<string, unknown>;
    if (obj['type'] !== undefined) return obj;
    const link = typeof obj['link'] === 'string' ? (obj['link'] as string) : '';
    const title = typeof obj['title'] === 'string' ? (obj['title'] as string) : '';
    return { ...obj, type: inferType(link, title) };
  });
}
