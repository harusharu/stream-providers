//! `GET /api/meta?provider=&link=` — full metadata for a title. Cached for
//! [`crate::config::Config::cache_meta_secs`].

use actix_web::web::{Data, Query};
use actix_web::HttpResponse;
use serde_json::json;

use crate::cache::CacheBundle;
use crate::error::ApiError;
use crate::handlers::{cached, resolve_provider};
use crate::model::{require_non_empty, MetaQuery};
use crate::state::AppState;

pub async fn meta(state: Data<AppState>, q: Query<MetaQuery>) -> Result<HttpResponse, ApiError> {
    let provider = resolve_provider(&state, q.provider.clone())?;
    let link = require_non_empty(q.link.clone(), "link", 2000)?;
    let params = json!({ "link": link, "providerValue": provider });
    let key = CacheBundle::key("meta", &provider, &params);
    if let Some(v) = state.caches.meta.get(&key).await {
        return Ok(cached(v, state.caches.meta.ttl().as_secs()));
    }
    let data = state
        .gateway
        .call(&provider, "meta", "getMeta", params)
        .await?;
    state.caches.meta.set(key, data.clone()).await;
    Ok(cached(data, state.caches.meta.ttl().as_secs()))
}
