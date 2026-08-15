//! `GET /api/episodes?provider=&url=` — per-episode links for a series URL.
//! Cached for [`crate::config::Config::cache_episodes_secs`].

use actix_web::web::{Data, Query};
use actix_web::HttpResponse;
use serde_json::json;

use crate::cache::CacheBundle;
use crate::error::ApiError;
use crate::handlers::{cached, resolve_provider};
use crate::model::{require_non_empty, EpisodesQuery};
use crate::state::AppState;

pub async fn episodes(
    state: Data<AppState>,
    q: Query<EpisodesQuery>,
) -> Result<HttpResponse, ApiError> {
    let provider = resolve_provider(&state, q.provider.clone())?;
    let url = require_non_empty(q.url.clone(), "url", 2000)?;
    let params = json!({ "url": url, "providerValue": provider });
    let key = CacheBundle::key("episodes", &provider, &params);
    if let Some(v) = state.caches.episodes.get(&key).await {
        return Ok(cached(v, state.caches.episodes.ttl().as_secs()));
    }
    let data = state
        .gateway
        .call(&provider, "episodes", "getEpisodes", params)
        .await?;
    state.caches.episodes.set(key, data.clone()).await;
    Ok(cached(data, state.caches.episodes.ttl().as_secs()))
}
