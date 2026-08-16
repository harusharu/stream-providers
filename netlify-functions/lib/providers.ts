// Provider registry.
//
// Loads `manifest.json` from the repo root (mirroring the Rust `Manifest`),
// filtering out disabled or empty entries. When the manifest cannot be read we
// fall back to a static, curated list of the currently-enabled providers so
// the API still works on platforms where the manifest file isn't deployed.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Provider {
  /** Provider id sent in the `provider` query param (e.g. `vega`). */
  value: string;
  /** Human-friendly name (e.g. "VMovies"). */
  display_name: string;
  /** Bundle version, if published in the manifest. */
  version?: string;
  /** Disabled providers are filtered out at load time. */
  disabled: boolean;
  /** Provider category (`global`, `english`, `india`, `italy`, …). */
  type?: string;
}

/** Static fallback for the currently-enabled providers (matches manifest). */
const STATIC_PROVIDERS: Provider[] = [
  {
    value: 'torrentio',
    display_name: 'Torrentio',
    version: '1.12',
    type: 'global',
    disabled: false,
  },
  { value: 'vega', display_name: 'VMovies', version: '2.27', type: 'global', disabled: false },
  {
    value: 'movieBoxWeb',
    display_name: 'MovieBox Web',
    version: '1.4',
    type: 'global',
    disabled: false,
  },
  {
    value: 'cinefreak',
    display_name: 'CineFreak',
    version: '1.1',
    type: 'global',
    disabled: false,
  },
  {
    value: 'eonMovies',
    display_name: 'EonMovies',
    version: '1.6',
    type: 'global',
    disabled: false,
  },
  { value: '4khdhub', display_name: '4khdHub', version: '2.10', type: 'global', disabled: false },
  { value: 'showbox', display_name: 'ShowBox', version: '1.5', type: 'english', disabled: false },
  { value: 'kmMovies', display_name: 'KmMovies', version: '2.14', type: 'global', disabled: false },
  { value: 'movies4u', display_name: 'Movies4U', version: '1.18', type: 'global', disabled: false },
];

interface RawManifestEntry {
  display_name?: string;
  value?: string;
  version?: string;
  disabled?: boolean;
  type?: string;
}

/**
 * Load the enabled provider list. Returns an empty array when `manifest.json`
 * cannot be read (callers use `load()` which falls back to the static list).
 */
export function loadFromManifest(providersRoot: string): Provider[] {
  const path = join(providersRoot, 'manifest.json');
  if (!existsSync(path)) return [];

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const entries: Provider[] = [];
  for (const item of raw as RawManifestEntry[]) {
    const value = item.value ?? '';
    if (value === '' || item.disabled) continue;
    entries.push({
      value,
      display_name: item.display_name || value,
      version: item.version,
      disabled: false,
      type: item.type,
    });
  }
  return entries;
}

/** Registry of enabled providers with O(1) lookup by value. */
export class ProviderRegistry {
  private readonly byValue = new Map<string, Provider>();
  readonly entries: Provider[];

  constructor(entries: Provider[]) {
    this.entries = entries;
    for (const e of entries) this.byValue.set(e.value, e);
  }

  static load(providersRoot: string): ProviderRegistry {
    const fromManifest = loadFromManifest(providersRoot);
    return new ProviderRegistry(fromManifest.length > 0 ? fromManifest : STATIC_PROVIDERS);
  }

  contains(value: string): boolean {
    return this.byValue.has(value);
  }

  get(value: string): Provider | undefined {
    return this.byValue.get(value);
  }

  values(): string[] {
    return this.entries.map((e) => e.value);
  }

  get size(): number {
    return this.entries.length;
  }
}
