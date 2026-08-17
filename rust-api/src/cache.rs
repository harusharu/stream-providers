//! In-memory TTL caching (moka).
//!
//! Provider calls scrape slow upstream pages, so identical requests must never
//! hit the Node workers twice within a short window. Every `/api/*` handler
//! keys its cache as `provider|endpoint|params` and serves the stored JSON on
//! a hit, stamping `Cache-Control: public, max-age=<ttl>` on the response.
//!
//! Capacities: each cache holds up to 10 000 entries with a per-endpoint TTL
//! configured by [`crate::config::Config`] (`CACHE_*_SECS`).

use std::sync::Arc;
use std::time::Duration;

use moka::future::Cache;
use serde_json::Value;

/// A single endpoint's TTL cache.
#[derive(Clone)]
pub struct TtlCache {
    inner: Cache<String, Arc<Value>>,
    ttl: Duration,
}

impl TtlCache {
    /// Build a cache with the given TTL (seconds, minimum 1).
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            inner: Cache::builder()
                .time_to_live(Duration::from_secs(ttl_secs.max(1)))
                .max_capacity(10_000)
                .build(),
            ttl: Duration::from_secs(ttl_secs),
        }
    }

    /// Look up a key, returning a clone of the cached JSON if present.
    pub async fn get(&self, key: &str) -> Option<Value> {
        self.inner.get(key).await.map(|v| (*v).clone())
    }

    /// Store a value under a key.
    pub async fn set(&self, key: String, value: Value) {
        self.inner.insert(key, Arc::new(value)).await;
    }

    /// The configured TTL, used for the `Cache-Control` header.
    pub fn ttl(&self) -> Duration {
        self.ttl
    }
}

/// The bundle of per-endpoint caches held in [`crate::state::AppState`].
#[derive(Clone)]
pub struct CacheBundle {
    pub catalog: TtlCache,
    pub search: TtlCache,
    pub meta: TtlCache,
    pub episodes: TtlCache,
    pub stream: TtlCache,
}

impl CacheBundle {
    /// Construct all five caches from the configured TTLs.
    pub fn from_config(c: &crate::config::Config) -> Self {
        Self {
            catalog: TtlCache::new(c.cache_catalog_secs),
            search: TtlCache::new(c.cache_search_secs),
            meta: TtlCache::new(c.cache_meta_secs),
            episodes: TtlCache::new(c.cache_episodes_secs),
            stream: TtlCache::new(c.cache_stream_secs),
        }
    }

    /// Build the canonical cache key for an endpoint/provider/params triple.
    pub fn key(endpoint: &str, provider: &str, params: &serde_json::Value) -> String {
        format!("{endpoint}|{provider}|{params}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[actix_rt::test]
    async fn get_set_roundtrip() {
        let c = TtlCache::new(60);
        assert!(c.get("k").await.is_none());
        c.set("k".into(), json!({"x": 1})).await;
        assert_eq!(c.get("k").await, Some(json!({"x": 1})));
    }

    #[actix_rt::test]
    async fn set_overwrites() {
        let c = TtlCache::new(60);
        c.set("k".into(), json!(1)).await;
        c.set("k".into(), json!(2)).await;
        assert_eq!(c.get("k").await, Some(json!(2)));
    }

    #[test]
    fn key_format_is_stable() {
        let params = json!({"query": "inception", "page": 1});
        let k1 = CacheBundle::key("search", "vega", &params);
        let k2 = CacheBundle::key("search", "vega", &params);
        let k3 = CacheBundle::key("search", "showbox", &params);
        assert_eq!(k1, k2);
        assert_ne!(k1, k3);
        assert!(k1.starts_with("search|vega|"));
    }

    #[test]
    fn ttl_is_exposed() {
        assert_eq!(TtlCache::new(30).ttl(), Duration::from_secs(30));
    }
}
