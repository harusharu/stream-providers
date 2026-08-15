//! Shared test utilities: a mock [`ProviderGateway`] and helpers for building
//! a test [`Config`], [`Manifest`], and [`AppState`].

use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use harustream_provider_api::cache::CacheBundle;
use harustream_provider_api::config::Config;
use harustream_provider_api::error::ApiError;
use harustream_provider_api::manifest::{Manifest, ManifestEntry};
use harustream_provider_api::services::provider::ProviderGateway;
use harustream_provider_api::state::AppState;
use serde_json::{json, Value};

/// Deterministic gateway returning canned data for every endpoint, with a
/// call counter so tests can assert on cache behaviour.
#[derive(Clone)]
pub struct MockGateway {
    pub catalog: Value,
    pub search: Value,
    pub meta: Value,
    pub episodes: Value,
    pub stream: Value,
    pub healthy: bool,
    /// Providers whose calls fail with a worker error (for failure-tolerance
    /// tests).
    pub failing: Vec<String>,
    pub call_count: Arc<AtomicUsize>,
}

impl Default for MockGateway {
    fn default() -> Self {
        Self {
            catalog: Value::Null,
            search: Value::Null,
            meta: Value::Null,
            episodes: Value::Null,
            stream: Value::Null,
            healthy: true,
            failing: Vec::new(),
            call_count: Arc::new(AtomicUsize::new(0)),
        }
    }
}

impl MockGateway {
    /// Realistic payloads mirroring what the provider bundles return.
    pub fn default_data() -> Self {
        Self {
            catalog: json!([
                { "title": "Latest Movies", "filter": "/category/popular" },
                { "title": "TV Shows", "filter": "/category/tv" },
            ]),
            search: json!([
                {
                    "title": "Inception",
                    "link": "https://example.com/movie/inception",
                    "image": "https://example.com/i.jpg",
                },
                {
                    "title": "Breaking Bad Season 1",
                    "link": "https://example.com/tv/breaking-bad",
                    "image": "https://example.com/i.jpg",
                },
            ]),
            meta: json!({
                "title": "Inception",
                "image": "https://example.com/i.jpg",
                "synopsis": "A thief who steals corporate secrets...",
                "imdbId": "tt1375666",
                "type": "movie",
                "linkList": [{
                    "title": "Server 1",
                    "directLinks": [{
                        "title": "1080p",
                        "link": "https://example.com/s1.m3u8",
                        "type": "movie",
                    }],
                }],
            }),
            episodes: json!([
                { "title": "S01E01", "link": "https://example.com/ep1" },
                { "title": "S01E02", "link": "https://example.com/ep2" },
            ]),
            stream: json!([
                {
                    "server": "Server 1",
                    "link": "https://example.com/stream.m3u8",
                    "type": "m3u8",
                    "quality": "1080p",
                },
            ]),
            healthy: true,
            failing: Vec::new(),
            call_count: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Number of gateway calls so far.
    pub fn calls(&self) -> usize {
        self.call_count.load(Ordering::SeqCst)
    }
}

impl ProviderGateway for MockGateway {
    fn call<'a>(
        &'a self,
        _provider: &'a str,
        module: &'a str,
        func: &'a str,
        _args: Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, ApiError>> + Send + 'a>> {
        Box::pin(async move {
            self.call_count.fetch_add(1, Ordering::SeqCst);
            if self.failing.iter().any(|p| p == _provider) {
                return Err(ApiError::Worker(format!(
                    "provider {_provider} is failing by design"
                )));
            }
            let key = format!("{module}/{func}");
            let value = match key.as_str() {
                "catalog/catalog" => &self.catalog,
                "posts/getSearchPosts" => &self.search,
                "meta/getMeta" => &self.meta,
                "episodes/getEpisodes" => &self.episodes,
                "stream/getStream" => &self.stream,
                other => return Err(ApiError::Worker(format!("unexpected call: {other}"))),
            };
            Ok(value.clone())
        })
    }

    fn healthy(&self) -> Pin<Box<dyn Future<Output = bool> + Send + '_>> {
        Box::pin(async move { self.healthy })
    }
}

/// A permissive config for offline tests.
pub fn test_config() -> Config {
    Config {
        host: "127.0.0.1".into(),
        port: 8787,
        providers_root: std::env::temp_dir(),
        worker_script: std::env::temp_dir().join("worker.js"),
        default_provider: "vega".into(),
        worker_count: 1,
        call_timeout_ms: 1000,
        worker_timeout_ms: 1500,
        search_all_timeout_ms: 1000,
        rate_limit_per_min: 600,
        rate_limit_burst: 120,
        cache_catalog_secs: 60,
        cache_search_secs: 60,
        cache_meta_secs: 60,
        cache_episodes_secs: 60,
        cache_stream_secs: 30,
        cors_origins: vec!["*".to_string()],
        tls_cert: None,
        tls_key: None,
        log_level: "error".into(),
    }
}

/// A manifest with two known providers.
pub fn test_manifest() -> Manifest {
    Manifest::from_entries(vec![
        ManifestEntry {
            display_name: Some("VMovies".into()),
            value: "vega".into(),
            version: Some("2.27".into()),
            disabled: false,
            kind: Some("global".into()),
        },
        ManifestEntry {
            display_name: Some("ShowBox".into()),
            value: "showbox".into(),
            version: Some("1.5".into()),
            disabled: false,
            kind: Some("english".into()),
        },
    ])
}

/// Assemble a fully-wired state with the given gateway + config.
pub fn test_state(gateway: MockGateway, config: Config) -> AppState {
    AppState::new(
        Arc::new(config.clone()),
        Arc::new(test_manifest()),
        Arc::new(gateway),
        CacheBundle::from_config(&config),
    )
}
