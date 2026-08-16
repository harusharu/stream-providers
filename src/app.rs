//! Actix `App` factory.
//!
//! [`build_app`] assembles the complete HTTP application — CORS, security
//! middleware (request-id, rate limit, headers), all routes, and the 404
//! fallback — from an [`AppState`]. The binary calls it at startup; tests call
//! it with a mock gateway so the whole surface is exercised without Node.

use std::sync::Arc;

use actix_cors::Cors;
use actix_web::body::MessageBody;
use actix_web::dev::{ServiceFactory, ServiceRequest, ServiceResponse};
use actix_web::http::header::{self, HeaderName};
use actix_web::{web, App, Error, HttpResponse};

use crate::handlers;
use crate::security;
use crate::state::AppState;

/// Build the complete Actix application from [`AppState`].
pub fn build_app(
    state: AppState,
) -> App<
    impl ServiceFactory<
        ServiceRequest,
        Config = (),
        Response = ServiceResponse<impl MessageBody>,
        Error = Error,
        InitError = (),
    >,
> {
    let cors_origins = state.config.cors_origins.clone();
    let per_min = state.config.rate_limit_per_min;
    let burst = state.config.rate_limit_burst;
    let limiter = Arc::new(security::build_limiter(per_min, burst));

    App::new()
        .app_data(web::Data::new(state))
        .wrap(build_cors(&cors_origins))
        .wrap(security::Security::new(limiter))
        .configure(configure_routes)
}

/// Build the CORS middleware from the configured origin allow-list.
pub fn build_cors(origins: &[String]) -> Cors {
    let mut b = Cors::default();
    if origins.iter().any(|o| o == "*") {
        b = b.allow_any_origin();
    } else {
        for o in origins {
            b = b.allowed_origin(o);
        }
    }
    b.allowed_methods(vec!["GET", "OPTIONS"])
        .allowed_headers(vec![
            header::ACCEPT,
            header::CONTENT_TYPE,
            HeaderName::from_static(security::REQUEST_ID_HEADER),
        ])
        .max_age(3600)
}

fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(web::resource("/api/catalog").route(web::get().to(handlers::catalog::catalog)))
        .service(web::resource("/api/search").route(web::get().to(handlers::search::search)))
        .service(
            web::resource("/api/search-all").route(web::get().to(handlers::search_all::search_all)),
        )
        .service(web::resource("/api/meta").route(web::get().to(handlers::meta::meta)))
        .service(web::resource("/api/episodes").route(web::get().to(handlers::episodes::episodes)))
        .service(web::resource("/api/stream").route(web::get().to(handlers::stream::stream)))
        .service(web::resource("/health").route(web::get().to(handlers::system::health)))
        .service(web::resource("/providers").route(web::get().to(handlers::system::providers)))
        .service(
            web::resource("/api/providers").route(web::get().to(handlers::system::api_providers)),
        )
        .service(web::resource("/info").route(web::get().to(handlers::system::info)))
        .service(web::resource("/urls.json").route(web::get().to(handlers::system::urls_manifest)))
        .service(web::resource("/").route(web::get().to(handlers::system::dashboard)))
        .default_service(web::route().to(not_found));
}

async fn not_found() -> HttpResponse {
    HttpResponse::NotFound().json(serde_json::json!({
        "success": false,
        "error": "not found",
        "code": "NOT_FOUND",
    }))
}
