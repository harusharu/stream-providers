//! Operational endpoints: `/health`, `/info`, `/providers`, and the `/`
//! dashboard. All are exempt from rate limiting.

use actix_web::web::Data;
use actix_web::HttpResponse;
use serde_json::json;

use crate::state::AppState;

/// `GET /health` — liveness probe. Reports `healthy`/`degraded` based on the
/// provider gateway and the loaded provider count. Exempt from rate limiting.
pub async fn health(state: Data<AppState>) -> HttpResponse {
    let workers_ok = state.gateway.healthy().await;
    HttpResponse::Ok().json(json!({
        "status": if workers_ok { "healthy" } else { "degraded" },
        "providers": state.manifest.values().len(),
        "workers_ok": workers_ok,
    }))
}

/// `GET /info` — crate name, version, and the list of registered endpoints.
/// Exempt from rate limiting.
pub async fn info(state: Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "name": env!("CARGO_PKG_NAME"),
        "version": env!("CARGO_PKG_VERSION"),
        "status": "running",
        "providers": state.manifest.values(),
        "endpoints": [
            "GET /api/catalog?provider=",
            "GET /api/search?provider=&query=&page=",
            "GET /api/search-all?query=&page=&providers=",
            "GET /api/meta?provider=&link=",
            "GET /api/episodes?provider=&url=",
            "GET /api/stream?provider=&link=&type=",
            "GET /health",
            "GET /providers",
            "GET /api/providers",
            "GET /urls.json",
        ],
    }))
}

/// `GET /providers` — the full, filtered manifest entries. Exempt from rate
/// limiting.
pub async fn providers(state: Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "providers": state.manifest.entries,
    }))
}

/// `GET /api/providers` — same data as `/providers`, wrapped in the standard
/// `{ success, data }` envelope (mirrors the Node gateway route).
pub async fn api_providers(state: Data<AppState>) -> HttpResponse {
    HttpResponse::Ok().json(json!({
        "success": true,
        "data": state.manifest.entries,
    }))
}

/// `GET /urls.json` — the provider URL manifest (upstream base URLs), read
/// from `PROVIDERS_ROOT/urls.json`. Lets deployments host their own copy and
/// point `URLS_MANIFEST_URL` at this endpoint instead of GitHub. Exempt from
/// rate limiting.
pub async fn urls_manifest(state: Data<AppState>) -> HttpResponse {
    let path = state.config.providers_root.join("urls.json");
    match std::fs::read_to_string(&path) {
        Ok(raw) => match serde_json::from_str::<serde_json::Value>(&raw) {
            Ok(json) => HttpResponse::Ok()
                .insert_header(("Cache-Control", "public, max-age=300"))
                .json(json),
            Err(_) => HttpResponse::NotFound().json(json!({
                "success": false,
                "error": "invalid urls.json",
                "code": "NOT_FOUND",
            })),
        },
        Err(_) => HttpResponse::NotFound().json(json!({
            "success": false,
            "error": "urls.json not found",
            "code": "NOT_FOUND",
        })),
    }
}
/// `GET /` — the self-contained human dashboard (see `static/index.html`).
/// Exempt from rate limiting.
pub async fn dashboard() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(include_str!("../../../static/index.html"))
}
