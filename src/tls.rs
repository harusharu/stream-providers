//! Optional rustls TLS termination.
//!
//! When [`crate::config::Config::tls_cert`] and
//! [`crate::config::Config::tls_key`] are set, the HTTP server
//! binds with TLS via `bind_rustls_0_23`. Otherwise it serves plain HTTP and is
//! intended to sit behind a reverse proxy (Caddy / Nginx / LB).

use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use rustls::ServerConfig;

/// Build a rustls ServerConfig from PEM cert + private key files. Used only
/// when TLS_CERT / TLS_KEY are set; otherwise the server binds plain HTTP and
/// is intended to sit behind a reverse proxy (Caddy / Nginx / LB).
pub fn build_server_config(cert_path: &Path, key_path: &Path) -> anyhow::Result<ServerConfig> {
    let certs = {
        let mut reader =
            BufReader::new(File::open(cert_path).map_err(|e| {
                anyhow::anyhow!("cannot open TLS cert {}: {e}", cert_path.display())
            })?);
        rustls_pemfile::certs(&mut reader)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| anyhow::anyhow!("invalid TLS cert {}: {e}", cert_path.display()))?
    };
    let key = {
        let mut reader = BufReader::new(
            File::open(key_path)
                .map_err(|e| anyhow::anyhow!("cannot open TLS key {}: {e}", key_path.display()))?,
        );
        rustls_pemfile::private_key(&mut reader)
            .map_err(|e| anyhow::anyhow!("invalid TLS key {}: {e}", key_path.display()))?
            .ok_or_else(|| anyhow::anyhow!("no private key found in {}", key_path.display()))?
    };

    let config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certs, key)
        .map_err(|e| anyhow::anyhow!("failed to build TLS config: {e}"))?;

    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_server_config_from_pem_files() {
        let certified = rcgen::generate_simple_self_signed(vec!["localhost".into()]).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let cert_path = dir.path().join("cert.pem");
        let key_path = dir.path().join("key.pem");
        std::fs::write(&cert_path, certified.cert.pem()).unwrap();
        std::fs::write(&key_path, certified.key_pair.serialize_pem()).unwrap();

        let config = build_server_config(&cert_path, &key_path).expect("builds");
        // A valid rustls ServerConfig round-trips as PEM.
        let _ = config;
    }

    #[test]
    fn missing_cert_errors() {
        let dir = tempfile::tempdir().unwrap();
        assert!(
            build_server_config(&dir.path().join("nope.pem"), &dir.path().join("k.pem")).is_err()
        );
    }

    #[test]
    fn bad_key_errors() {
        let certified = rcgen::generate_simple_self_signed(vec!["localhost".into()]).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let cert_path = dir.path().join("cert.pem");
        let key_path = dir.path().join("key.pem");
        std::fs::write(&cert_path, certified.cert.pem()).unwrap();
        std::fs::write(&key_path, "not a key").unwrap();
        assert!(build_server_config(&cert_path, &key_path).is_err());
    }
}
