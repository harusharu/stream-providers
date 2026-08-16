//! Integration tests: the full Actix app driven through `actix_web::test`
//! with a mock gateway — no Node runtime or network required.

mod common;

use actix_web::body::MessageBody;
use actix_web::dev::{Service, ServiceResponse};
use actix_web::http::{header, StatusCode};
use actix_web::test;
use harustream_provider_api::app::build_app;
use serde_json::Value;

use common::{test_config, test_state, MockGateway};

/// Build a test service around the mock gateway (inlined because the service
/// type is opaque).
macro_rules! app {
    ($gateway:expr, $config:expr) => {
        test::init_service(build_app(test_state($gateway, $config)))
    };
}

/// GET `uri` and return the status + decoded JSON body.
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

// --- Happy paths -------------------------------------------------------------

#[actix_rt::test]
async fn catalog_returns_envelope_and_cache_control() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let req = test::TestRequest::get().uri("/api/catalog").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);
    let cc = resp
        .headers()
        .get(header::CACHE_CONTROL)
        .and_then(|v| v.to_str().ok())
        .unwrap();
    assert_eq!(cc, "public, max-age=60");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["success"], true);
    assert_eq!(body["data"].as_array().unwrap().len(), 2);
}

#[actix_rt::test]
async fn catalog_uses_default_provider_when_omitted() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let (status, body) = get_json(&app, "/api/catalog").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["success"], true);
}

#[actix_rt::test]
async fn search_applies_type_hints() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let (status, body) = get_json(&app, "/api/search?query=inception&page=1").await;
    assert_eq!(status, StatusCode::OK);
    let items = body["data"].as_array().unwrap();
    assert_eq!(items[0]["type"], "movie");
    assert_eq!(items[1]["type"], "series");
}

// --- Aggregated search (/api/search-all) -------------------------------------

#[actix_rt::test]
async fn search_all_fans_out_to_every_provider_and_tags_items() {
    let mock = MockGateway::default_data();
    let app = app!(mock.clone(), test_config()).await;
    let (status, body) = get_json(&app, "/api/search-all?query=inception&page=1").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(mock.calls(), 2, "one gateway call per enabled provider");
    assert_eq!(body["data"]["providers"], 2);
    assert_eq!(body["data"]["failed"], 0);
    let items = body["data"]["data"].as_array().unwrap();
    assert_eq!(items.len(), 4, "2 mock results × 2 providers");
    let vega: Vec<_> = items.iter().filter(|i| i["provider"] == "vega").collect();
    let showbox: Vec<_> = items
        .iter()
        .filter(|i| i["provider"] == "showbox")
        .collect();
    assert_eq!(vega.len(), 2);
    assert_eq!(showbox.len(), 2);
    assert_eq!(vega[0]["providerName"], "VMovies");
    assert_eq!(showbox[0]["providerName"], "ShowBox");
    assert_eq!(items[0]["type"], "movie", "type hints applied per item");
}

#[actix_rt::test]
async fn search_all_provider_subset() {
    let mock = MockGateway::default_data();
    let app = app!(mock.clone(), test_config()).await;
    let (status, body) = get_json(&app, "/api/search-all?query=inception&providers=showbox").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(mock.calls(), 1, "only the requested provider is queried");
    assert_eq!(body["data"]["providers"], 1);
    assert_eq!(body["data"]["failed"], 0);
    let items = body["data"]["data"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    assert!(items.iter().all(|i| i["provider"] == "showbox"));
}

#[actix_rt::test]
async fn search_all_tolerates_failing_providers() {
    let mut mock = MockGateway::default_data();
    mock.failing = vec!["showbox".to_string()];
    let app = app!(mock.clone(), test_config()).await;
    let (status, body) = get_json(&app, "/api/search-all?query=inception").await;
    assert_eq!(status, StatusCode::OK, "partial failures are tolerated");
    assert_eq!(body["data"]["failed"], 1);
    assert_eq!(body["data"]["providers"], 2);
    let items = body["data"]["data"].as_array().unwrap();
    assert_eq!(items.len(), 2, "only the healthy provider's results");
    assert!(items.iter().all(|i| i["provider"] == "vega"));
}

#[actix_rt::test]
async fn search_all_caches_per_query() {
    let mock = MockGateway::default_data();
    let app = app!(mock.clone(), test_config()).await;
    get_json(&app, "/api/search-all?query=inception").await;
    get_json(&app, "/api/search-all?query=inception").await;
    get_json(&app, "/api/search-all?query=matrix").await;
    assert_eq!(
        mock.calls(),
        4,
        "same query cached (2 calls), distinct query re-fanned (2 more)"
    );
}

#[actix_rt::test]
async fn search_all_missing_query_is_400() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let (status, body) = get_json(&app, "/api/search-all").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "BAD_REQUEST");
}

#[actix_rt::test]
async fn search_all_unknown_provider_subset_is_400() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let (status, body) = get_json(&app, "/api/search-all?query=inception&providers=nope").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "BAD_REQUEST");
}

#[actix_rt::test]
async fn meta_episodes_stream_happy_paths() {
    let app = app!(MockGateway::default_data(), test_config()).await;

    let (status, body) = get_json(
        &app,
        "/api/meta?link=https%3A%2F%2Fexample.com%2Fmovie%2Finception",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["title"], "Inception");

    let (status, body) = get_json(&app, "/api/episodes?url=https%3A%2F%2Fexample.com%2Feps").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"].as_array().unwrap().len(), 2);

    let (status, body) = get_json(
        &app,
        "/api/stream?link=https%3A%2F%2Fexample.com%2Fs1.m3u8&type=movie",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let streams = body["data"].as_array().unwrap();
    assert_eq!(streams[0]["server"], "Server 1");
}

#[actix_rt::test]
async fn stream_normalises_type() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    // "tv" should be normalised to "series" without erroring.
    let (status, _) = get_json(
        &app,
        "/api/stream?link=https%3A%2F%2Fexample.com%2Fs.m3u8&type=tv",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
}

// --- Validation / errors -----------------------------------------------------

#[actix_rt::test]
async fn search_missing_query_is_400() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let (status, body) = get_json(&app, "/api/search").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["success"], false);
    assert_eq!(body["code"], "BAD_REQUEST");
}

#[actix_rt::test]
async fn search_oversized_query_is_422() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let long = "a".repeat(201);
    let (status, body) = get_json(&app, &format!("/api/search?query={long}")).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["code"], "INVALID_INPUT");
}

#[actix_rt::test]
async fn unknown_provider_is_400() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let (status, body) = get_json(&app, "/api/catalog?provider=nope").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["code"], "BAD_REQUEST");
    assert!(body["error"].as_str().unwrap().contains("nope"));
}

#[actix_rt::test]
async fn unknown_route_is_404() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let (status, body) = get_json(&app, "/api/nope").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "NOT_FOUND");
}

// --- Headers / middleware ----------------------------------------------------

#[actix_rt::test]
async fn security_headers_present() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let req = test::TestRequest::get().uri("/api/catalog").to_request();
    let resp = test::call_service(&app, req).await;
    let headers = resp.headers();
    assert_eq!(
        headers
            .get("x-content-type-options")
            .and_then(|v| v.to_str().ok()),
        Some("nosniff")
    );
    assert_eq!(
        headers.get("x-frame-options").and_then(|v| v.to_str().ok()),
        Some("DENY")
    );
    assert!(headers.contains_key("referrer-policy"));
    assert!(headers.contains_key("content-security-policy"));
}

#[actix_rt::test]
async fn request_id_is_echoed() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let req = test::TestRequest::get()
        .uri("/api/catalog")
        .insert_header(("x-request-id", "my-custom-id"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.headers()
            .get("x-request-id")
            .and_then(|v| v.to_str().ok()),
        Some("my-custom-id")
    );
}

// --- Caching -----------------------------------------------------------------

#[actix_rt::test]
async fn identical_requests_are_cached() {
    let mock = MockGateway::default_data();
    let app = app!(mock.clone(), test_config()).await;
    get_json(&app, "/api/search?query=inception&page=1").await;
    get_json(&app, "/api/search?query=inception&page=1").await;
    assert_eq!(
        mock.calls(),
        1,
        "second identical request must hit the cache"
    );
}

#[actix_rt::test]
async fn distinct_queries_bypass_cache() {
    let mock = MockGateway::default_data();
    let app = app!(mock.clone(), test_config()).await;
    get_json(&app, "/api/search?query=inception&page=1").await;
    get_json(&app, "/api/search?query=matrix&page=1").await;
    assert_eq!(mock.calls(), 2);
}

// --- Rate limiting -----------------------------------------------------------

#[actix_rt::test]
async fn rate_limit_returns_429_and_exempts_health() {
    let mut config = test_config();
    config.rate_limit_per_min = 1;
    config.rate_limit_burst = 1;
    let app = app!(MockGateway::default_data(), config).await;

    // First /api/catalog passes, second is throttled (returned as a service
    // error, which Actix renders as 429).
    let (status, _) = get_json(&app, "/api/catalog").await;
    assert_eq!(status, StatusCode::OK);
    let req = test::TestRequest::get().uri("/api/catalog").to_request();
    match test::try_call_service(&app, req).await {
        Ok(_) => panic!("second /api/catalog must be rate limited"),
        Err(e) => {
            let resp = e.error_response();
            assert_eq!(resp.status(), StatusCode::TOO_MANY_REQUESTS);
            let bytes = actix_web::body::to_bytes(resp.into_body()).await.unwrap();
            let body: Value = serde_json::from_slice(&bytes).unwrap();
            assert_eq!(body["code"], "RATE_LIMITED");
        }
    }

    // Exempt paths are never throttled.
    for _ in 0..5 {
        let (status, body) = get_json(&app, "/health").await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(body["status"], "healthy");
    }
}

// --- CORS --------------------------------------------------------------------

#[actix_rt::test]
async fn cors_reflects_allowed_origin() {
    let mut config = test_config();
    config.cors_origins = vec!["https://allowed.example".to_string()];
    let app = app!(MockGateway::default_data(), config).await;

    let req = test::TestRequest::get()
        .uri("/api/catalog")
        .insert_header((header::ORIGIN, "https://allowed.example"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .and_then(|v| v.to_str().ok()),
        Some("https://allowed.example")
    );

    // Disallowed origins get no CORS header.
    let req = test::TestRequest::get()
        .uri("/api/catalog")
        .insert_header((header::ORIGIN, "https://evil.example"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp
        .headers()
        .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
        .is_none());
}

#[actix_rt::test]
async fn cors_preflight_allowed_origin() {
    let mut config = test_config();
    config.cors_origins = vec!["https://app.example".to_string()];
    let app = app!(MockGateway::default_data(), config).await;

    let req = test::TestRequest::default()
        .method(actix_web::http::Method::OPTIONS)
        .uri("/api/search")
        .insert_header((header::ORIGIN, "https://app.example"))
        .insert_header((header::ACCESS_CONTROL_REQUEST_METHOD, "GET"))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(
        resp.headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .and_then(|v| v.to_str().ok()),
        Some("https://app.example")
    );
}

// --- Operational endpoints ---------------------------------------------------

#[actix_rt::test]
async fn health_reports_gateway_status() {
    let app = app!(MockGateway::default_data(), test_config()).await;
    let (status, body) = get_json(&app, "/health").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "healthy");
    assert_eq!(body["providers"], 2);
}

#[actix_rt::test]
async fn health_is_degraded_when_gateway_down() {
    let mut mock = MockGateway::default_data();
    mock.healthy = false;
    let app = app!(mock, test_config()).await;
    let (_, body) = get_json(&app, "/health").await;
    assert_eq!(body["status"], "degraded");
    assert_eq!(body["workers_ok"], false);
}

#[actix_rt::test]
async fn info_and_providers_and_dashboard() {
    let app = app!(MockGateway::default_data(), test_config()).await;

    let (status, body) = get_json(&app, "/info").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["name"], env!("CARGO_PKG_NAME"));

    let (status, body) = get_json(&app, "/providers").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["providers"].as_array().unwrap().len(), 2);

    let req = test::TestRequest::get().uri("/").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(
        resp.headers()
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap(),
        "text/html; charset=utf-8"
    );
}
