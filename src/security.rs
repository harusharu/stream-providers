//! Security middleware: request-id, rate limiting, and response headers.
//!
//! [`Security`] is an Actix [`Transform`] wrapping every
//! request. In order it:
//!
//! 1. Generates/echoes an `x-request-id` (12-char hex, or the client's value).
//! 2. Enforces a per-IP rate limit (governor) with a configurable
//!    quota/burst. `/`, `/health`, `/providers`, `/info` are exempt.
//! 3. Logs the request with `request_id`, method, path, status, duration.
//! 4. Stamps security headers on the response: `X-Content-Type-Options`,
//!    `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`.
//!
//! The rate limiter is built from [`Config`](crate::config::Config) and
//! injected via [`Security::new`] when the app is assembled (see
//! [`crate::app::build_app`]) — there is deliberately no process-global state.
//!
//! Note: middleware futures need not be `Send` (Actix runs each request within
//! an arbiter thread), so the transform only requires `S::Future: 'static` —
//! matching how `actix-cors` itself is implemented.
//!
//! [`RateLimited`] is the 429 error surfaced by the
//! middleware before the request reaches a handler.

use std::future::{ready, Ready};
use std::net::IpAddr;
use std::num::NonZeroU32;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use actix_web::body::MessageBody;
use actix_web::dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::http::header::HeaderValue;
use actix_web::{Error, HttpResponse};
use governor::clock::DefaultClock;
use governor::state::keyed::DefaultKeyedStateStore;
use governor::{Quota, RateLimiter};

pub type IpRateLimiter = RateLimiter<IpAddr, DefaultKeyedStateStore<IpAddr>, DefaultClock>;

/// Build a per-IP rate limiter with the given per-minute quota and burst.
pub fn build_limiter(per_min: u32, burst: u32) -> IpRateLimiter {
    RateLimiter::keyed(
        Quota::per_minute(NonZeroU32::new(per_min.max(1)).unwrap())
            .allow_burst(NonZeroU32::new(burst.max(1)).unwrap()),
    )
}

/// Request id carried on responses and logs. Computed in middleware.
pub const REQUEST_ID_HEADER: &str = "x-request-id";

const EXEMPT_PATHS: [&str; 4] = ["/health", "/", "/providers", "/info"];

/// Whether a path is exempt from rate limiting.
pub fn is_exempt(path: &str) -> bool {
    EXEMPT_PATHS.contains(&path)
}

// --- Error type for 429 -----------------------------------------------------

#[derive(Debug)]
pub struct RateLimited;

impl std::fmt::Display for RateLimited {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "rate limit exceeded")
    }
}

impl std::error::Error for RateLimited {}

impl actix_web::ResponseError for RateLimited {
    fn status_code(&self) -> actix_web::http::StatusCode {
        actix_web::http::StatusCode::TOO_MANY_REQUESTS
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::TooManyRequests().json(serde_json::json!({
            "success": false,
            "error": "rate limit exceeded",
            "code": "RATE_LIMITED",
        }))
    }
}

// --- Security middleware: request id + rate limit + security headers --------

const SECURITY_HEADERS: [(&str, &str); 4] = [
    ("x-content-type-options", "nosniff"),
    ("x-frame-options", "DENY"),
    ("referrer-policy", "no-referrer"),
    (
        "content-security-policy",
        "default-src 'none'; frame-ancestors 'none'",
    ),
];

pub struct Security {
    limiter: Arc<IpRateLimiter>,
}

impl Security {
    /// Wrap a service with the given rate limiter.
    pub fn new(limiter: Arc<IpRateLimiter>) -> Self {
        Self { limiter }
    }
}

impl<S, B> Transform<S, ServiceRequest> for Security
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = SecurityMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(SecurityMiddleware {
            service,
            limiter: self.limiter.clone(),
        }))
    }
}

pub struct SecurityMiddleware<S> {
    service: S,
    limiter: Arc<IpRateLimiter>,
}

impl<S, B> Service<ServiceRequest> for SecurityMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: MessageBody,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = SecurityFuture<B>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let rid = req
            .headers()
            .get("x-request-id")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string()[..12].to_string());

        let path = req.path().to_string();
        let limiter = self.limiter.clone();
        let fut_request_method = req.method().clone();

        // Rate limit (unless exempt). Source IP only.
        if !is_exempt(&path) {
            let ip: IpAddr = req
                .peer_addr()
                .map(|a| a.ip())
                .unwrap_or(IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED));
            if let Err(not_until) = limiter.check_key(&ip) {
                tracing::debug!(%ip, %path, "rate limited");
                // Default to the default quota if not configured.
                return SecurityFuture {
                    inner: Box::pin(async move {
                        let _ = not_until;
                        Err(RateLimited.into())
                    }),
                };
            }
        }

        let fut = self.service.call(req);
        let started = std::time::Instant::now();
        let method = fut_request_method.clone();
        let path = path.clone();
        let rid_log = rid.clone();
        SecurityFuture {
            inner: Box::pin(async move {
                let mut res = fut.await?;
                let status = res.status().as_u16();
                tracing::info!(
                    request_id = %rid_log,
                    %method,
                    %path,
                    status,
                    duration_ms = started.elapsed().as_millis() as u64,
                    "request"
                );
                if let Ok(v) = HeaderValue::from_str(&rid) {
                    res.headers_mut().insert(
                        actix_web::http::header::HeaderName::from_static(REQUEST_ID_HEADER),
                        v,
                    );
                }
                for (name, value) in SECURITY_HEADERS {
                    if let Ok(v) = HeaderValue::from_str(value) {
                        if let Ok(n) =
                            actix_web::http::header::HeaderName::from_bytes(name.as_bytes())
                        {
                            res.headers_mut().insert(n, v);
                        }
                    }
                }
                Ok(res)
            }),
        }
    }
}

pub struct SecurityFuture<B> {
    inner: Pin<Box<dyn std::future::Future<Output = Result<ServiceResponse<B>, Error>>>>,
}

impl<B> std::future::Future for SecurityFuture<B> {
    type Output = Result<ServiceResponse<B>, Error>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.inner.as_mut().poll(cx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exempt_paths_cover_ops() {
        assert!(is_exempt("/"));
        assert!(is_exempt("/health"));
        assert!(is_exempt("/providers"));
        assert!(is_exempt("/info"));
        assert!(!is_exempt("/api/catalog"));
        assert!(!is_exempt("/api/search"));
        assert!(!is_exempt("/health?x=1"));
    }

    #[test]
    fn limiter_enforces_quota() {
        let limiter = build_limiter(1, 1);
        let ip: IpAddr = "127.0.0.1".parse().unwrap();
        assert!(limiter.check_key(&ip).is_ok());
        assert!(limiter.check_key(&ip).is_err());
        // A different key is unaffected.
        let other: IpAddr = "127.0.0.2".parse().unwrap();
        assert!(limiter.check_key(&other).is_ok());
    }

    #[test]
    fn limiter_never_panics_on_zero() {
        let limiter = build_limiter(0, 0);
        assert!(limiter
            .check_key(&IpAddr::V4(std::net::Ipv4Addr::LOCALHOST))
            .is_ok());
    }

    #[actix_rt::test]
    async fn rate_limited_error_shape() {
        use actix_web::ResponseError;
        let err = RateLimited;
        assert_eq!(
            err.status_code(),
            actix_web::http::StatusCode::TOO_MANY_REQUESTS
        );
        let resp = err.error_response();
        let body = actix_web::body::to_bytes(resp.into_body()).await.unwrap();
        let text = String::from_utf8_lossy(&body);
        assert!(text.contains("\"success\":false"));
        assert!(text.contains("\"code\":\"RATE_LIMITED\""));
    }
}
