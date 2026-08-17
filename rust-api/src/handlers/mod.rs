//! REST endpoint handlers, split by domain.
//!
//! Every `/api/*` handler follows the same shape: resolve the provider,
//! validate params, check the TTL cache, call the provider gateway on a miss,
//! then re-cache and wrap the result in the `{ success, data }` envelope.
//!
//! - [`catalog`] — home/genre categories
//! - [`search`] — search results with [`type` inference](crate::model::apply_type_hints)
//! - [`search_all`] — aggregated search across every enabled provider
//! - [`meta`] — full title metadata
//! - [`episodes`] — per-series episode links
//! - [`stream`] — playable sources for a hub
//! - [`system`] — [`health`](crate::handlers::system::health), [`info`](crate::handlers::system::info),
//!   [`providers`](crate::handlers::system::providers), and the dashboard

pub mod catalog;
pub mod episodes;
pub mod meta;
pub mod search;
pub mod search_all;
pub mod stream;
pub mod system;

use actix_web::HttpResponse;
use serde_json::json;

use crate::error::ApiError;
use crate::state::AppState;

/// Resolve and validate the `provider` query param, defaulting per config.
pub(crate) fn resolve_provider(state: &AppState, raw: Option<String>) -> Result<String, ApiError> {
    let provider = crate::model::normalize_provider(raw, &state.config.default_provider);
    if !state.manifest.contains(&provider) {
        return Err(ApiError::ProviderNotFound(provider));
    }
    Ok(provider)
}

/// Wrap data in the `{ success, data }` envelope with a `Cache-Control` header.
pub(crate) fn cached(data: serde_json::Value, ttl_secs: u64) -> HttpResponse {
    HttpResponse::Ok()
        .insert_header(("Cache-Control", format!("public, max-age={ttl_secs}")))
        .json(json!({ "success": true, "data": data }))
}
