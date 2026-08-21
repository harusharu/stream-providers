// Channel list and upstream site URLs. Change a URL here when a host moves.
export const sites = {
  vega: { name: 'VMovies', url: 'https://new2.vegamovies.futbol' },
  autoEmbed: { name: 'MultiStream', url: 'https://cinemeta-catalogs.strem.io' },
  '4khdhub': { name: '4khdHub', url: 'https://4khdhub.one' },
  movieBoxWeb: { name: 'MovieBox Web', url: 'https://themoviebox.org' },
  eonMovies: { name: 'EonMovies', url: 'https://new4.eonmovies.click' },
  kmMovies: { name: 'KmMovies', url: 'https://kmmovies.online' },
  showbox: { name: 'ShowBox', url: 'https://www.showbox.media' },
  torrentio: { name: 'Torrentio', url: 'https://torrentio.strem.fun' },
  cinefreak: { name: 'CineFreak', url: 'https://cinefreak.net' },
  movies4u: { name: 'Movies4U', url: 'https://movies4u.ax' },
} as const;

export type ProviderId = keyof typeof sites;

export function channelList(): Array<{ id: string; name: string }> {
  return Object.entries(sites).map(([id, site]) => ({ id, name: site.name }));
}

export function getBaseUrl(id: string): string {
  const site = (sites as Record<string, { url: string } | undefined>)[id];
  if (!site) throw new Error(`unknown provider: ${id}`);
  return site.url;
}

export function isKnownProvider(id: string): boolean {
  return id in sites;
}
