//! `GET /api/stream?provider=&link=&type=` — resolves a hub URL into playable
//! m3u8/mp4 sources `[{server, link, type}]`. Cached for
//! [`crate::config::Config::cache_stream_secs`].

use actix_web::web::{Data, Query};
use actix_web::HttpResponse;
use serde_json::json;

use crate::cache::CacheBundle;
use crate::error::ApiError;
use crate::handlers::{cached, resolve_provider};
use crate::model::{require_non_empty, stream_type, StreamQuery};
use crate::state::AppState;

pub async fn stream(
    state: Data<AppState>,
    q: Query<StreamQuery>,
) -> Result<HttpResponse, ApiError> {
    let provider = resolve_provider(&state, q.provider.clone())?;
    let link = require_non_empty(q.link.clone(), "link", 2000)?;
    let kind = stream_type(q.kind.clone());
    let params = json!({ "link": link, "type": kind, "providerValue": provider });
    let key = CacheBundle::key("stream", &provider, &params);
    if let Some(v) = state.caches.stream.get(&key).await {
        return Ok(cached(v, state.caches.stream.ttl().as_secs()));
    }
    let data = state
        .gateway
        .call(&provider, "stream", "getStream", params)
        .await?;
    state.caches.stream.set(key, data.clone()).await;
    Ok(cached(data, state.caches.stream.ttl().as_secs()))
}
