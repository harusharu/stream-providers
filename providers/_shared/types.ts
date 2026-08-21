import { AxiosStatic } from 'axios';
import * as cheerio from 'cheerio';

// getPosts
export interface Post {
  title: string;
  link: string;
  image: string;
  provider?: string;
}

export type TextTracks = {
  title: string;
  language: string;
  type: 'application/x-subrip' | 'application/ttml+xml' | 'text/vtt';
  uri: string;
}[];

// getStream
export interface Stream {
  server: string;
  link: string;
  type: string;
  quality?: '360' | '480' | '720' | '1080' | '2160';
  subtitles?: TextTracks;
  headers?: any;
}

// getInfo
export interface Info {
  title: string;
  image: string;
  poster?: string;
  logo?: string;
  synopsis: string;
  imdbId: string;
  tmdbId?: string;
  type: string;
  tags?: string[];
  cast?: string[];
  rating?: string;
  linkList: Link[];
  webUrl?: string;
}
// getEpisodeLinks
export interface EpisodeLink {
  title: string;
  link: string;
  description?: string;
  image?: string;
}

export interface Link {
  title: string;
  quality?: string;
  episodesLink?: string;
  directLinks?: {
    title: string;
    link: string;
    type?: 'movie' | 'series';
    description?: string;
    image?: string;
  }[];
}

// catalog
export interface Catalog {
  title: string;
  filter: string;
}

// Options to customize the WAF-solving WebView dialog.
export interface OpenWebViewOptions {
  // Title shown in the dialog header.
  title?: string;
  // Helper text shown under the title.
  description?: string;

  headers?: Record<string, string>;

  waitForCookie?: string;

  force?: boolean;
  // If set, the dialog auto-cancels (rejects) after this many milliseconds.
  timeoutMs?: number;
}

// Result returned to the provider after the user solves the challenge.
export interface OpenWebViewResult {
  // The page response after the challenge is solved: the rendered HTML of the
  // document (document.documentElement.outerHTML).
  data: string;
  // Cookie header value, e.g. "cf_clearance=abc; other=def".
  cookies: string;
  // Cookies as a name -> value map.
  cookieMap: Record<string, string>;
  // The User-Agent used by the WebView.
  userAgent: string;
  // The URL that was opened.
  url: string;
}

export type ProviderContext = {
  axios: AxiosStatic;
  Aes: any; // AES encryption utility, if used
  commonHeaders: Record<string, string>;
  cheerio: typeof cheerio;
  openWebView?: (url: string, options?: OpenWebViewOptions) => Promise<OpenWebViewResult>;
};
