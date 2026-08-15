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

/// `GET /` — the self-contained human dashboard (see `static/index.html`).
/// Exempt from rate limiting.
pub async fn dashboard() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(include_str!("../../static/index.html"))
}
