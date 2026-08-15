//! The provider-execution port.
//!
//! Handlers never touch the Node sidecar directly; they call
//! [`ProviderGateway::call`] on whatever implementation is in
//! [`AppState`](crate::state::AppState). This decouples the HTTP surface from
//! the execution engine:
//!
//! - **Production** — [`crate::worker::WorkerPool`] runs the real bundles in
//!   isolated Node processes.
//! - **Tests** — a mock implementation returns canned values, so the whole
//!   HTTP layer is testable offline.
//!
//! The trait is object-safe (methods return boxed, `Send` futures) so it can
//! live behind `Arc<dyn ProviderGateway>`.

use std::future::Future;
use std::pin::Pin;

use serde_json::Value;

use crate::error::ApiError;

/// Execute a provider bundle function. Implementations must be `Send + Sync`
/// so the gateway can be shared across Actix workers.
pub trait ProviderGateway: Send + Sync {
    /// Invoke `func` on `dist/<provider>/<module>.js` with JSON `args`,
    /// returning the provider's raw result.
    fn call<'a>(
        &'a self,
        provider: &'a str,
        module: &'a str,
        func: &'a str,
        args: Value,
    ) -> Pin<Box<dyn Future<Output = Result<Value, ApiError>> + Send + 'a>>;

    /// Whether at least one execution unit is alive (used by `/health`).
    fn healthy(&self) -> Pin<Box<dyn Future<Output = bool> + Send + '_>>;
}
