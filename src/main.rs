//! Binary entrypoint: load config, assemble state, and run the HTTP server.

use std::sync::Arc;

use actix_web::HttpServer;
use anyhow::Context;
use harustream_provider_api::app;
use harustream_provider_api::cache::CacheBundle;
use harustream_provider_api::config::Config;
use harustream_provider_api::manifest::Manifest;
use harustream_provider_api::state::AppState;
use harustream_provider_api::{telemetry, tls};
use tracing::{info, warn};

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    let config = Arc::new(Config::from_env()?);
    telemetry::init(&config.log_level);

    let manifest = Arc::new(Manifest::load(&config.providers_root).with_context(|| {
        format!(
            "failed to load provider manifest from {}",
            config.providers_root.display()
        )
    })?);
    info!(
        providers = manifest.values().len(),
        root = %config.providers_root.display(),
        "manifest loaded"
    );

    let gateway = Arc::new(harustream_provider_api::worker::WorkerPool::new(config.clone()).await?);
    let state = AppState::new(
        config.clone(),
        manifest,
        gateway,
        CacheBundle::from_config(&config),
    );

    // TLS termination when a cert/key are configured, otherwise plain HTTP.
    let http_server = HttpServer::new(move || app::build_app(state.clone()));
    let server = match (&config.tls_cert, &config.tls_key) {
        (Some(cert), Some(key)) => {
            let tls_config = tls::build_server_config(cert, key)?;
            info!(
                host = %config.host,
                port = config.port,
                tls = true,
                "binding HTTPS"
            );
            http_server
                .bind_rustls_0_23((config.host.as_str(), config.port), tls_config)
                .with_context(|| format!("failed to bind {}:{}", config.host, config.port))?
        }
        _ => {
            info!(
                host = %config.host,
                port = config.port,
                tls = false,
                "binding HTTP (put behind a TLS-terminating proxy in production)"
            );
            http_server
                .bind((config.host.as_str(), config.port))
                .with_context(|| format!("failed to bind {}:{}", config.host, config.port))?
        }
    };

    // Graceful shutdown on SIGINT/SIGTERM.
    let srv = server.run();
    let handle = srv.handle();
    tokio::spawn(async move {
        shutdown_signal().await;
        warn!("shutdown signal received; draining connections");
        handle.stop(true).await;
    });

    srv.await?;
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install SIGINT handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
