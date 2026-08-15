//! Query-string parameter shapes and validation helpers.
//!
//! The serde structs mirror exactly the contract harustream's zod schemas
//! (`lib/api/types.ts`) expect. Handlers enforce presence/validity via
//! [`require_non_empty`] and friends.
//!
//! This module also contains the media-`type` inference ([`infer_type`]
//! / [`apply_type_hints`]) that fills in the `type`
//! field harustream's home feed relies on, since the provider bundles return
//! bare `{title, link, image}` posts.

use serde::Deserialize;

/// `GET /api/catalog` — only `provider` is read.
#[derive(Debug, Deserialize)]
pub struct ProviderQuery {
    pub provider: Option<String>,
}

/// `GET /api/search` — `provider`, `query`, and optional `page`.
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub provider: Option<String>,
    pub query: Option<String>,
    pub page: Option<u32>,
}

/// `GET /api/search-all` — `query`, optional `page`, and optional
/// comma-separated `providers` subset. Fans out to every enabled provider and
/// merges the results.
#[derive(Debug, Deserialize)]
pub struct SearchAllQuery {
    pub query: Option<String>,
    pub page: Option<u32>,
    pub providers: Option<String>,
}

/// `GET /api/meta` — `provider` and `link`.
#[derive(Debug, Deserialize)]
pub struct MetaQuery {
    pub provider: Option<String>,
    pub link: Option<String>,
}

/// `GET /api/episodes` — `provider` and `url`.
#[derive(Debug, Deserialize)]
pub struct EpisodesQuery {
    pub provider: Option<String>,
    pub url: Option<String>,
}

/// `GET /api/stream` — `provider`, `link`, and `type`.
#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    pub provider: Option<String>,
    pub link: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
}

// --- Validation helpers ----------------------------------------------------

/// Trim and default an optional provider value to the configured default.
pub fn normalize_provider(raw: Option<String>, default: &str) -> String {
    raw.map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default.to_string())
}

/// Require a non-empty query parameter, bounding its length.
pub fn require_non_empty(
    value: Option<String>,
    name: &'static str,
    max_len: usize,
) -> Result<String, crate::error::ApiError> {
    let value = value.unwrap_or_default().trim().to_string();
    if value.is_empty() {
        return Err(crate::error::ApiError::MissingParam(name));
    }
    if value.chars().count() > max_len {
        return Err(crate::error::ApiError::InvalidParam(format!(
            "{name} exceeds {max_len} characters"
        )));
    }
    Ok(value)
}

/// Normalise the `type` query param to `movie` or `series` (default `movie`).
pub fn stream_type(raw: Option<String>) -> String {
    match raw.as_deref().map(|s| s.trim().to_lowercase()).as_deref() {
        Some("series") | Some("tv") | Some("show") => "series".to_string(),
        Some("movie") | Some("film") => "movie".to_string(),
        _ => "movie".to_string(),
    }
}

// --- Media type inference --------------------------------------------------

// Provider bundles return search/posts items as bare { title, link, image }
// with no `type` field. harustream's home feed splits rails by media type
// (`item.type === 'movie' | 'series'`), so the API must supply it. Inference
// keys off how each provider encodes the type in the link/title:
//   - showbox:  /movie/..., /tv/...
//   - vega:     series links/titles carry "season"/"episode" markers
// Fallback is "movie".
pub fn infer_type(link: &str, title: &str) -> &'static str {
    let link_l = link.to_ascii_lowercase();
    if link_l.contains("/movie/") {
        return "movie";
    }
    if link_l.contains("/tv/") || link_l.contains("/series/") || link_l.contains("/show/") {
        return "series";
    }
    let hay = format!("{link_l} {}", title.to_ascii_lowercase());
    if is_series_marker(&hay) {
        "series"
    } else {
        "movie"
    }
}

fn is_series_marker(hay: &str) -> bool {
    const MARKERS: [&str; 8] = [
        "season",
        "episode",
        "web-series",
        "web series",
        "netflix series",
        "complete series",
        "tv show",
        "s01e",
    ];
    if MARKERS.iter().any(|m| hay.contains(m)) {
        return true;
    }
    // Generic s01e05 / s1e5 episode markers.
    let bytes = hay.as_bytes();
    for i in 0..bytes.len().saturating_sub(3) {
        if bytes[i] == b's'
            && bytes[i + 1].is_ascii_digit()
            && bytes[i + 2] == b'e'
            && bytes[i + 3].is_ascii_digit()
        {
            return true;
        }
    }
    false
}

/// Fills in a missing `type` on each object in a provider array using
/// `link`/`title` heuristics. Returns the (possibly modified) value.
pub fn apply_type_hints(mut data: serde_json::Value) -> serde_json::Value {
    let Some(arr) = data.as_array_mut() else {
        return data;
    };
    for item in arr.iter_mut() {
        let Some(obj) = item.as_object_mut() else {
            continue;
        };
        if obj.contains_key("type") {
            continue;
        }
        let link = obj.get("link").and_then(|v| v.as_str()).unwrap_or("");
        let title = obj.get("title").and_then(|v| v.as_str()).unwrap_or("");
        obj.insert(
            "type".to_string(),
            serde_json::json!(infer_type(link, title)),
        );
    }
    data
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn infer_type_by_link_segment() {
        assert_eq!(infer_type("https://x/movie/foo", "Foo"), "movie");
        assert_eq!(infer_type("https://x/tv/foo", "Foo"), "series");
        assert_eq!(infer_type("https://x/series/foo", "Foo"), "series");
        assert_eq!(infer_type("https://x/show/foo", "Foo"), "series");
    }

    #[test]
    fn infer_type_by_title_markers() {
        assert_eq!(
            infer_type("https://x/abc", "The Walking Dead Season 1"),
            "series"
        );
        assert_eq!(infer_type("https://x/abc", "Web Series XYZ"), "series");
        assert_eq!(infer_type("https://x/abc", "Plain Movie"), "movie");
    }

    #[test]
    fn infer_type_by_episode_codes() {
        assert_eq!(infer_type("https://x/abc", "Show S01E05"), "series");
        assert_eq!(infer_type("https://x/abc", "Show s3e12"), "series");
    }

    #[test]
    fn stream_type_normalises() {
        assert_eq!(stream_type(None), "movie");
        assert_eq!(stream_type(Some("movie".into())), "movie");
        assert_eq!(stream_type(Some("series".into())), "series");
        assert_eq!(stream_type(Some("tv".into())), "series");
        assert_eq!(stream_type(Some("show".into())), "series");
        assert_eq!(stream_type(Some("MOVIE".into())), "movie");
        assert_eq!(stream_type(Some("garbage".into())), "movie");
    }

    #[test]
    fn require_non_empty_validation() {
        assert_eq!(
            require_non_empty(Some("  abc  ".into()), "q", 10).unwrap(),
            "abc"
        );
        assert!(matches!(
            require_non_empty(None, "q", 10),
            Err(crate::error::ApiError::MissingParam("q"))
        ));
        assert!(matches!(
            require_non_empty(Some("   ".into()), "q", 10),
            Err(crate::error::ApiError::MissingParam("q"))
        ));
        assert!(matches!(
            require_non_empty(Some("way too long".into()), "q", 5),
            Err(crate::error::ApiError::InvalidParam(_))
        ));
    }

    #[test]
    fn normalize_provider_falls_back() {
        assert_eq!(normalize_provider(None, "vega"), "vega");
        assert_eq!(
            normalize_provider(Some("  showbox  ".into()), "vega"),
            "showbox"
        );
        assert_eq!(normalize_provider(Some("   ".into()), "vega"), "vega");
    }

    #[test]
    fn apply_type_hints_adds_missing_types() {
        let input = json!([
            { "title": "Foo", "link": "https://x/movie/foo", "image": "https://x/i.jpg" },
            { "title": "Bar Season 1", "link": "https://x/bar", "image": "https://x/i.jpg" },
            { "title": "Pretyped", "link": "https://x/movie/z", "type": "series" },
        ]);
        let out = apply_type_hints(input);
        let arr = out.as_array().unwrap();
        assert_eq!(arr[0]["type"], "movie");
        assert_eq!(arr[1]["type"], "series");
        assert_eq!(arr[2]["type"], "series", "existing type preserved");
    }

    #[test]
    fn apply_type_hints_leaves_non_arrays() {
        assert_eq!(apply_type_hints(json!({"a": 1})), json!({"a": 1}));
    }
}
