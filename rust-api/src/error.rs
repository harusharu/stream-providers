//! Error taxonomy for the gateway.
//!
//! Every [`ApiError`] variant maps to a real HTTP status so
//! the Next.js client (harustream) can translate it into its own
//! `ProviderError` taxonomy: `429 → RATE_LIMITED`, `503 → UNAVAILABLE`,
//! `5xx → UPSTREAM_ERROR`, and so on.
//!
//! | Variant | HTTP status | Client code |
//! | --- | --- | --- |
//! | `ProviderNotFound` | 400 | `BAD_REQUEST` |
//! | `MissingParam` | 400 | `BAD_REQUEST` |
//! | `InvalidParam` | 422 | `INVALID_INPUT` |
//! | `Worker` | 502 | `UPSTREAM_ERROR` |
//! | `Upstream` | mirrors upstream | `UPSTREAM_ERROR` |
//! | `Timeout` | 504 | `TIMEOUT` |
//! | `Internal` | 500 | `ERROR` |
//!
//! [`ApiError::is_transient`] tells the
//! worker pool whether retrying on a different worker is likely to help.

use actix_web::http::StatusCode;
use actix_web::{HttpResponse, ResponseError};
use serde_json::json;

/// Every failure the gateway can produce, plus its HTTP mapping.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    /// A `provider` value that is not in the manifest.
    #[error("unknown provider: {0}")]
    ProviderNotFound(String),

    /// A required query parameter was missing or empty.
    #[error("missing required parameter: {0}")]
    MissingParam(&'static str),

    /// A query parameter failed a constraint (e.g. too long).
    #[error("invalid parameter: {0}")]
    InvalidParam(String),

    /// The Node worker process itself failed (spawn, pipe, or crash).
    #[error("provider worker failed: {0}")]
    Worker(String),

    /// The provider bundle raised an error while scraping an upstream host.
    #[error("upstream provider error (HTTP {status}): {message}")]
    Upstream { status: u16, message: String },

    /// A worker call exceeded [`crate::config::Config::call_timeout_ms`].
    #[error("provider request timed out")]
    Timeout,

    /// An unexpected internal failure.
    #[error("internal server error: {0}")]
    Internal(String),
}

impl ApiError {
    pub fn status(&self) -> u16 {
        match self {
            ApiError::ProviderNotFound(_) => 400,
            ApiError::MissingParam(_) => 400,
            ApiError::InvalidParam(_) => 422,
            ApiError::Worker(_) => 502,
            ApiError::Upstream { status, .. } => *status,
            ApiError::Timeout => 504,
            ApiError::Internal(_) => 500,
        }
    }

    /// Whether retrying on a different worker is likely to help (transient).
    pub fn is_transient(&self) -> bool {
        matches!(self, ApiError::Timeout | ApiError::Worker(_))
            || matches!(self, ApiError::Upstream { status, .. } if *status >= 500)
    }
}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        StatusCode::from_u16(self.status()).unwrap_or(StatusCode::BAD_GATEWAY)
    }

    fn error_response(&self) -> HttpResponse {
        let status = self.status();
        let code = match self {
            ApiError::ProviderNotFound(_) | ApiError::MissingParam(_) => "BAD_REQUEST",
            ApiError::InvalidParam(_) => "INVALID_INPUT",
            ApiError::Worker(_) | ApiError::Upstream { .. } => "UPSTREAM_ERROR",
            ApiError::Timeout => "TIMEOUT",
            ApiError::Internal(_) => "ERROR",
        };
        let status_code = StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY);
        HttpResponse::build(status_code).json(json!({
            "success": false,
            "error": self.to_string(),
            "code": code,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status(err: ApiError) -> u16 {
        err.status()
    }

    #[test]
    fn status_mapping() {
        assert_eq!(status(ApiError::ProviderNotFound("x".into())), 400);
        assert_eq!(status(ApiError::MissingParam("q")), 400);
        assert_eq!(status(ApiError::InvalidParam("x".into())), 422);
        assert_eq!(status(ApiError::Worker("x".into())), 502);
        assert_eq!(
            status(ApiError::Upstream {
                status: 503,
                message: "x".into()
            }),
            503
        );
        assert_eq!(status(ApiError::Timeout), 504);
        assert_eq!(status(ApiError::Internal("x".into())), 500);
    }

    #[test]
    fn transient_classification() {
        assert!(ApiError::Timeout.is_transient());
        assert!(ApiError::Worker("x".into()).is_transient());
        assert!(ApiError::Upstream {
            status: 500,
            message: "x".into()
        }
        .is_transient());
        assert!(ApiError::Upstream {
            status: 502,
            message: "x".into()
        }
        .is_transient());
        assert!(!ApiError::Upstream {
            status: 404,
            message: "x".into()
        }
        .is_transient());
        assert!(!ApiError::ProviderNotFound("x".into()).is_transient());
        assert!(!ApiError::MissingParam("q").is_transient());
        assert!(!ApiError::InvalidParam("x".into()).is_transient());
        assert!(!ApiError::Internal("x".into()).is_transient());
    }

    #[actix_rt::test]
    async fn error_response_envelope() {
        let err = ApiError::ProviderNotFound("nope".into());
        let resp = err.error_response();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
        let body = actix_web::body::to_bytes(resp.into_body()).await.unwrap();
        let text = String::from_utf8_lossy(&body);
        assert!(text.contains("\"success\":false"));
        assert!(text.contains("\"code\":\"BAD_REQUEST\""));
        assert!(text.contains("nope"));
    }

    #[actix_rt::test]
    async fn upstream_error_uses_upstream_status() {
        let err = ApiError::Upstream {
            status: 523,
            message: "origin down".into(),
        };
        let resp = err.error_response();
        assert_eq!(resp.status(), StatusCode::from_u16(523).unwrap());
        let body = actix_web::body::to_bytes(resp.into_body()).await.unwrap();
        let text = String::from_utf8_lossy(&body);
        assert!(text.contains("\"code\":\"UPSTREAM_ERROR\""));
    }
}
