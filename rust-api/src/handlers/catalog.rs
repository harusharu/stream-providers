//! `GET /api/catalog?provider=` — the provider's home/genre categories
//! (`[{title, filter}]`). Cached for [`crate::config::Config::cache_catalog_secs`].

use actix_web::web::{Data, Query};
use actix_web::HttpResponse;
use serde_json::json;

use crate::cache::CacheBundle;
use crate::error::ApiError;
use crate::handlers::{cached, resolve_provider};
use crate::model::ProviderQuery;
use crate::state::AppState;

pub async fn catalog(
    state: Data<AppState>,
    q: Query<ProviderQuery>,
) -> Result<HttpResponse, ApiError> {
    let provider = resolve_provider(&state, q.provider.clone())?;
    let key = CacheBundle::key("catalog", &provider, &json!({}));
    if let Some(v) = state.caches.catalog.get(&key).await {
        return Ok(cached(v, state.caches.catalog.ttl().as_secs()));
    }
    let data = state
        .gateway
        .call(&provider, "catalog", "catalog", json!({}))
        .await?;
    state.caches.catalog.set(key, data.clone()).await;
    Ok(cached(data, state.caches.catalog.ttl().as_secs()))
}
