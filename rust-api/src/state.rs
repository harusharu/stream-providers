//! Application state shared by every handler.
//!
//! [`AppState`] is the single object Actix stores in `app_data` and hands to
//! each request handler: configuration, the loaded provider registry, the
//! provider-execution gateway, and the per-endpoint TTL caches.

use std::sync::Arc;

use crate::cache::CacheBundle;
use crate::config::Config;
use crate::manifest::Manifest;
use crate::services::provider::ProviderGateway;

/// Cloneable, shareable state attached to the Actix `App`.
#[derive(Clone)]
pub struct AppState {
    /// Process-wide runtime configuration.
    pub config: Arc<Config>,
    /// Loaded, filtered provider registry.
    pub manifest: Arc<Manifest>,
    /// The provider-execution port (Node worker pool in production).
    pub gateway: Arc<dyn ProviderGateway>,
    /// Per-endpoint TTL caches.
    pub caches: CacheBundle,
}

impl AppState {
    /// Assemble a fully-wired state from its parts.
    pub fn new(
        config: Arc<Config>,
        manifest: Arc<Manifest>,
        gateway: Arc<dyn ProviderGateway>,
        caches: CacheBundle,
    ) -> Self {
        Self {
            config,
            manifest,
            gateway,
            caches,
        }
    }
}
