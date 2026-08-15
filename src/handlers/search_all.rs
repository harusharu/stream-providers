//! `GET /api/search-all` — aggregated search across every enabled provider.
//!
//! Fans out one `getSearchPosts` call per provider (concurrency-capped,
//! each bounded by `config::Config` via `SEARCH_ALL_TIMEOUT_MS`), merges the results
//! into a single list, and tags every item with the `provider` id and
//! `providerName` so the frontend can drive `/api/meta`, `/api/episodes`,
//! and `/api/stream` per provider. Slow or failing providers are skipped —
//! the response only contains what actually returned.
//!
//! The result is cached under `search-all|all|<params>` in the search cache.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use actix_web::web::{Data, Query};
use actix_web::HttpResponse;
use serde_json::{json, Value};
use tokio::sync::Semaphore;

use crate::cache::CacheBundle;
use crate::error::ApiError;
use crate::handlers::cached;
use crate::manifest::ManifestEntry;
use crate::model::{apply_type_hints, require_non_empty, SearchAllQuery};
use crate::state::AppState;

/// Cap on concurrent per-provider search calls inside one request.
const MAX_CONCURRENCY: usize = 8;

/// `GET /api/search-all?query=&page=&providers=` handler.
pub async fn search_all(
    state: Data<AppState>,
    q: Query<SearchAllQuery>,
) -> Result<HttpResponse, ApiError> {
    let query = require_non_empty(q.query.clone(), "query", 200)?;
    let page = q.page.unwrap_or(1).max(1);

    let entries = select_entries(&state, q.providers.as_deref())?;

    let params = json!({
        "query": query,
        "page": page,
        "providers": entries.iter().map(|e| e.value.as_str()).collect::<Vec<_>>(),
    });
    let key = CacheBundle::key("search-all", "all", &params);
    if let Some(hit) = state.caches.search.get(&key).await {
        return Ok(cached(hit, state.caches.search.ttl().as_secs()));
    }

    let timeout = Duration::from_millis(state.config.search_all_timeout_ms);
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENCY));
    let mut tasks = tokio::task::JoinSet::new();

    for entry in &entries {
        let gateway = Arc::clone(&state.gateway);
        let semaphore = Arc::clone(&semaphore);
        let query = query.clone();
        let provider = entry.value.clone();
        let name = entry
            .display_name
            .clone()
            .unwrap_or_else(|| provider.clone());
        tasks.spawn(async move {
            let _permit = semaphore.acquire_owned().await;
            let args = json!({
                "searchQuery": query,
                "page": page,
                "providerValue": provider,
            });
            let outcome = tokio::time::timeout(
                timeout,
                gateway.call(&provider, "posts", "getSearchPosts", args),
            )
            .await;
            (provider, name, outcome)
        });
    }

    let mut items: Vec<Value> = Vec::new();
    let mut failed = 0usize;
    let mut seen: HashSet<(String, String, String)> = HashSet::new();

    while let Some(joined) = tasks.join_next().await {
        let (provider, name, outcome) = match joined {
            Ok(joined) => joined,
            Err(e) => {
                tracing::warn!(error = %e, "search-all provider task panicked");
                failed += 1;
                continue;
            }
        };
        let data = match outcome {
            Ok(Ok(data)) => data,
            Ok(Err(e)) => {
                tracing::warn!(%provider, error = %e, "search-all provider failed");
                failed += 1;
                continue;
            }
            Err(_) => {
                tracing::warn!(%provider, "search-all provider timed out");
                failed += 1;
                continue;
            }
        };
        let typed = apply_type_hints(data);
        let Some(results) = typed.as_array() else {
            tracing::warn!(%provider, "search-all provider returned non-array");
            failed += 1;
            continue;
        };
        for item in results {
            let Some(obj) = item.as_object() else {
                continue;
            };
            let title = obj.get("title").and_then(Value::as_str).unwrap_or("");
            let link = obj.get("link").and_then(Value::as_str).unwrap_or("");
            if !seen.insert((provider.clone(), title.to_string(), link.to_string())) {
                continue;
            }
            let mut tagged = item.clone();
            let obj = tagged.as_object_mut().expect("checked above");
            obj.insert("provider".into(), json!(provider.clone()));
            obj.insert("providerName".into(), json!(name.clone()));
            items.push(tagged);
        }
    }

    let total = items.len();
    let providers = entries.len();
    let data = json!({
        "success": true,
        "data": items,
        "total": total,
        "providers": providers,
        "failed": failed,
    });
    state.caches.search.set(key, data.clone()).await;
    let ttl = state.caches.search.ttl().as_secs();
    Ok(HttpResponse::Ok()
        .insert_header(("Cache-Control", format!("public, max-age={ttl}")))
        .json(data))
}

/// Pick the manifest entries to query: the requested `providers` subset
/// (comma-separated), or every enabled entry when omitted.
fn select_entries<'a>(
    state: &'a AppState,
    requested: Option<&str>,
) -> Result<Vec<&'a ManifestEntry>, ApiError> {
    let all: Vec<&ManifestEntry> = state
        .manifest
        .entries
        .iter()
        .filter(|e| !e.disabled)
        .collect();
    let Some(requested) = requested else {
        return Ok(all);
    };
    let wanted: HashSet<&str> = requested
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    if wanted.is_empty() {
        return Ok(all);
    }
    let picked: Vec<&ManifestEntry> = all
        .into_iter()
        .filter(|e| wanted.contains(e.value.as_str()))
        .collect();
    if picked.is_empty() {
        return Err(ApiError::ProviderNotFound(requested.to_string()));
    }
    Ok(picked)
}
