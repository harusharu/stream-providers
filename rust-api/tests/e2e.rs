//! End-to-end tests: the real architecture (Rust gateway → Node sidecar
//! workers → live upstream hosts) driven through the actual HTTP surface via
//! `actix_web::test`.
//!
//! These require `node` on `PATH`, built `dist/` bundles, `node_modules`
//! (axios/cheerio/curl-cffi-node), a `manifest.json`, and network access, so
//! they are `#[ignore]`d by default. Run them explicitly with:
//!
//! ```bash
//! cargo test --test e2e -- --ignored --test-threads=1
//! ```

use std::sync::Arc;

use actix_web::body::MessageBody;
use actix_web::dev::{Service, ServiceResponse};
use actix_web::http::StatusCode;
use actix_web::test;
use serde_json::Value;

use harustream_provider_api::app::build_app;
use harustream_provider_api::cache::CacheBundle;
use harustream_provider_api::config::Config;
use harustream_provider_api::manifest::Manifest;
use harustream_provider_api::state::AppState;
use harustream_provider_api::worker::WorkerPool;

/// Build a real, wired state from the environment (`PROVIDERS_ROOT` defaults
/// to the stream-providers repo root).
async fn real_state() -> (Config, AppState) {
    let mut config = Config::from_env().expect("config from env");
    // Keep the local run light: fewer Node processes, quieter logs.
    config.worker_count = config.worker_count.min(2);
    config.log_level = "error".into();

    let manifest = Manifest::load(&config.providers_root).unwrap_or_else(|e| {
        panic!(
            "failed to load manifest from {}: {e}",
            config.providers_root.display()
        )
    });
    let pool = WorkerPool::new(Arc::new(config.clone()))
        .await
        .expect("worker pool (is `node` on PATH and `dist/` built via `npm run build`?)");

    let state = AppState::new(
        Arc::new(config.clone()),
        Arc::new(manifest),
        Arc::new(pool),
        CacheBundle::from_config(&config),
    );
    (config, state)
}

async fn get_json<S, B, E>(app: &S, uri: &str) -> (StatusCode, Value)
where
    S: Service<actix_http::Request, Response = ServiceResponse<B>, Error = E>,
    B: MessageBody,
    E: std::fmt::Debug,
{
    let req = test::TestRequest::get().uri(uri).to_request();
    let resp = test::call_service(app, req).await;
    let status = resp.status();
    let body = test::read_body_json(resp).await;
    (status, body)
}

/// `?link=...` values are real URLs; encode them for the query string.
fn link_query(link: &str) -> String {
    urlencoding::encode(link).into_owned()
}

/// Walk the full chain for one provider: catalog → search → meta →
/// episodes/stream. Returns a summary, or an error describing what broke.
async fn sweep_provider<S, B, E>(app: &S, provider: &str) -> Result<String, String>
where
    S: Service<actix_http::Request, Response = ServiceResponse<B>, Error = E>,
    B: MessageBody,
    E: std::fmt::Debug,
{
    // 1. Catalog
    let (status, body) = get_json(app, &format!("/api/catalog?provider={provider}")).await;
    if status != StatusCode::OK {
        return Err(format!("catalog: HTTP {status}: {body}"));
    }
    let catalog = body["data"]
        .as_array()
        .filter(|a| !a.is_empty())
        .ok_or_else(|| format!("catalog: empty data: {body}"))?;
    let filters = catalog.len();

    // 2. Search
    let (status, body) = get_json(
        app,
        &format!("/api/search?provider={provider}&query=avengers&page=1"),
    )
    .await;
    if status != StatusCode::OK {
        return Err(format!("search: HTTP {status}: {body}"));
    }
    let posts = body["data"]
        .as_array()
        .filter(|a| !a.is_empty())
        .ok_or_else(|| "search: empty results for query 'avengers'".to_string())?;
    let post = posts
        .iter()
        .find(|p| p["link"].as_str().is_some() && !p["link"].as_str().unwrap().is_empty())
        .ok_or_else(|| "search: no post carries a link".to_string())?;
    let post_link = post["link"].as_str().unwrap().to_string();

    // 3. Meta
    let uri = format!(
        "/api/meta?provider={provider}&link={}",
        link_query(&post_link)
    );
    let (status, body) = get_json(app, &uri).await;
    if status != StatusCode::OK {
        return Err(format!(
            "meta ({}): HTTP {status}: {body}",
            truncate(&post_link, 60)
        ));
    }
    let link_list = body["data"]["linkList"]
        .as_array()
        .filter(|a| !a.is_empty())
        .ok_or_else(|| format!("meta: empty linkList for {}", truncate(&post_link, 60)))?;
    let title = body["data"]["title"].as_str().unwrap_or("?").to_string();

    // 4. Episodes / stream resolution
    let mut episodes_checked = 0usize;
    let mut streams_found = 0usize;
    for entry in link_list {
        if let Some(episodes_link) = entry["episodesLink"].as_str() {
            let uri = format!(
                "/api/episodes?provider={provider}&url={}",
                link_query(episodes_link)
            );
            let (status, body) = get_json(app, &uri).await;
            if status != StatusCode::OK {
                continue;
            }
            let empty: Vec<Value> = vec![];
            let episodes = body["data"].as_array().unwrap_or(&empty);
            episodes_checked += 1;
            if let Some(ep) = episodes.iter().find(|e| e["link"].as_str().is_some()) {
                let ep_link = ep["link"].as_str().unwrap();
                let uri = format!(
                    "/api/stream?provider={provider}&link={}&type=series",
                    link_query(ep_link)
                );
                if let (StatusCode::OK, sbody) = get_json(app, &uri).await {
                    if sbody["data"]
                        .as_array()
                        .map(|a| !a.is_empty())
                        .unwrap_or(false)
                    {
                        streams_found += 1;
                    }
                }
            }
            if streams_found > 0 {
                break;
            }
        } else if let Some(direct_links) = entry["directLinks"].as_array() {
            if let Some(link) = direct_links
                .iter()
                .find(|d| d["link"].as_str().is_some())
                .and_then(|d| d["link"].as_str())
            {
                let uri = format!(
                    "/api/stream?provider={provider}&link={}&type=movie",
                    link_query(link)
                );
                if let (StatusCode::OK, sbody) = get_json(app, &uri).await {
                    if sbody["data"]
                        .as_array()
                        .map(|a| !a.is_empty())
                        .unwrap_or(false)
                    {
                        streams_found += 1;
                    }
                }
                if streams_found > 0 {
                    break;
                }
            }
        }
    }

    if streams_found == 0 && episodes_checked == 0 {
        return Err(format!(
            "meta: no episodesLink or directLinks to resolve streams for {}",
            truncate(&post_link, 60)
        ));
    }
    if streams_found == 0 {
        return Err(format!("stream: no playable stream resolved for {title}"));
    }

    Ok(format!(
        "{title}: {filters} catalog filters, {posts:?} posts, {episodes_checked} episode lists, {streams_found} stream(s)"
    ))
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        format!("{}…", s.chars().take(max).collect::<String>())
    }
}

// --- Smoke: default provider, full chain -------------------------------------

#[actix_rt::test]
#[ignore = "requires node, built dist, and live upstream hosts"]
async fn smoke_default_provider_full_chain() {
    let (_config, state) = real_state().await;
    let app = test::init_service(build_app(state)).await;
    let provider = &_config.default_provider;

    let summary = sweep_provider(&app, provider)
        .await
        .unwrap_or_else(|e| panic!("{provider} failed the full chain: {e}"));
    eprintln!("{provider}: {summary}");
}

// --- Sweep: every enabled provider -------------------------------------------

#[actix_rt::test]
#[ignore = "requires node, built dist, and live upstream hosts; slow (one provider at a time)"]
async fn sweep_all_enabled_providers() {
    let (config, state) = real_state().await;
    let app = test::init_service(build_app(state)).await;

    let manifest = Manifest::load(&config.providers_root).expect("manifest");
    let enabled = manifest.entries;

    assert!(!enabled.is_empty(), "no enabled providers in manifest");
    eprintln!("sweeping {} enabled providers", enabled.len());

    let mut failures: Vec<String> = Vec::new();
    let mut summaries: Vec<String> = Vec::new();
    for entry in &enabled {
        match sweep_provider(&app, &entry.value).await {
            Ok(summary) => {
                eprintln!("✅ {}: {summary}", entry.value);
                summaries.push(summary);
            }
            Err(err) => {
                eprintln!("❌ {}: {err}", entry.value);
                failures.push(format!("{}: {err}", entry.value));
            }
        }
    }

    eprintln!(
        "passed {}/{} providers",
        enabled.len() - failures.len(),
        enabled.len()
    );
    assert!(
        failures.is_empty(),
        "{} provider(s) failed:\n- {}",
        failures.len(),
        failures.join("\n- ")
    );
}
