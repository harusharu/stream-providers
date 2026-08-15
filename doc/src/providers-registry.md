# Provider Registry

The registry is loaded from `manifest.json`. As of writing the repo ships
**48 providers**, of which **23 are enabled** (disabled entries are
filtered out at startup):

| id | display | version | type |
| --- | --- | --- | --- |
| `vega` | VMovies | 2.27 | global |
| `drive` | MoviesDrive | 2.16 | global |
| `4khdhub` | 4khdHub | 2.10 | global |
| `1cinevood` | Cinewood | 1.22 | global |
| `world4u` | World4uFree | 1.7 | global |
| `katmovies` | KatMoviesHd | 1.23 | global |
| `mod` | MoviesMod | 1.7 | global |
| `uhd` | UHDMovies | 1.8 | global |
| `movieBoxWeb` | MovieBox Web | 1.4 | global |
| `gokuHD` | GokuHD | 1.2 | global |
| `eonMovies` | EonMovies | 1.6 | global |
| `movies4u` | Movies4U | 1.18 | global |
| `kmMovies` | KmMovies | 2.14 | global |
| `zeefliz` | Zeefliz | 1.20 | global |
| `hdhub4u` | HdHub4u | 2.14 | global |
| `a111477` | A.111477 | 1.7 | english |
| `moviezwap` | MoviezWap | 1.3 | india |
| `showbox` | ShowBox | 1.5 | english |
| `luxMovies` | RogMovies | 2.19 | india |
| `topmovies` | TopMovies | 1.11 | india |
| `Joya9tv` | Joya9tv | 1.12 | india |
| `torrentio` | Torrentio | 1.12 | global |
| `cinefreak` | CineFreak | 1.1 | global |

The full list (including disabled entries) is always available at
`GET /providers` and on the `/` dashboard.
