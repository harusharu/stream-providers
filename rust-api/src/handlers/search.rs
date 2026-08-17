//! `GET /api/search?provider=&query=&page=` — search results with a `type`
//! hint inferred per item (see [`crate::model::apply_type_hints`]).
//! Cached for [`crate::config::Config::cache_search_secs`].

use actix_web::web::{Data, Query};
use actix_web::HttpResponse;
use serde_json::json;

use crate::cache::CacheBundle;
use crate::error::ApiError;
use crate::handlers::{cached, resolve_provider};
use crate::model::{apply_type_hints, require_non_empty, SearchQuery};
use crate::state::AppState;

pub async fn search(
    state: Data<AppState>,
    q: Query<SearchQuery>,
) -> Result<HttpResponse, ApiError> {
    let provider = resolve_provider(&state, q.provider.clone())?;
    let query = require_non_empty(q.query.clone(), "query", 200)?;
    let page = q.page.unwrap_or(1).max(1);
    let params = json!({ "searchQuery": query, "page": page, "providerValue": provider });
    let key = CacheBundle::key("search", &provider, &params);
    if let Some(v) = state.caches.search.get(&key).await {
        return Ok(cached(v, state.caches.search.ttl().as_secs()));
    }
    let data = state
        .gateway
        .call(&provider, "posts", "getSearchPosts", params)
        .await?;
    let data = apply_type_hints(data);
    state.caches.search.set(key, data.clone()).await;
    Ok(cached(data, state.caches.search.ttl().as_secs()))
}
