//! Process-wide `tracing` setup.
//!
//! Initializes a human-friendly, env-filtered logger once at startup.

use tracing_subscriber::EnvFilter;

/// Initialize the `tracing` subscriber from `RUST_LOG` (falling back to
/// `level`). Safe to call once; ignores subsequent calls.
pub fn init(level: &str) {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(level));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .init();
}
