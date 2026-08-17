//! Provider registry parsing.
//!
//! Loads `manifest.json` from [`crate::config::Config::providers_root`]
//! at startup and filters out disabled or empty entries. The `value` field is
//! the provider id clients send in the `provider` query param.
//!
//! See the crate-level docs for the list of providers and [`crate::handlers::system::providers`].

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// One entry of the stream-providers `manifest.json`.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ManifestEntry {
    /// Human-friendly provider name (e.g. "VMovies").
    #[serde(rename = "display_name")]
    pub display_name: Option<String>,
    /// Provider id used in the `provider` query param (e.g. `vega`).
    pub value: String,
    /// Bundle version, if published in the manifest.
    pub version: Option<String>,
    /// Disabled providers are filtered out at load time.
    #[serde(default)]
    pub disabled: bool,
    /// Provider category (`global`, `english`, `india`, `italy`, …).
    #[serde(rename = "type")]
    pub kind: Option<String>,
}

/// Loaded, filtered manifest with an O(1) lookup by provider value.
#[derive(Debug, Clone, Default)]
pub struct Manifest {
    /// Enabled entries, in manifest order.
    pub entries: Vec<ManifestEntry>,
    by_value: HashMap<String, ManifestEntry>,
}

impl Manifest {
    /// Read and parse `manifest.json` from `root`, dropping disabled/empty
    /// entries.
    pub fn load(root: &Path) -> anyhow::Result<Self> {
        let path = root.join("manifest.json");
        let text = std::fs::read_to_string(&path)
            .map_err(|e| anyhow::anyhow!("cannot read manifest at {}: {e}", path.display()))?;
        let raw: Vec<ManifestEntry> = serde_json::from_str(&text)
            .map_err(|e| anyhow::anyhow!("invalid manifest.json: {e}"))?;

        let entries: Vec<ManifestEntry> = raw
            .into_iter()
            .filter(|e| !e.disabled && !e.value.is_empty())
            .collect();

        let by_value = entries
            .iter()
            .map(|e| (e.value.clone(), e.clone()))
            .collect();

        Ok(Manifest { entries, by_value })
    }

    /// Build a manifest directly from entries (used by tests and embedders
    /// that already hold the provider list).
    pub fn from_entries(entries: Vec<ManifestEntry>) -> Self {
        let by_value = entries
            .iter()
            .map(|e| (e.value.clone(), e.clone()))
            .collect();
        Manifest { entries, by_value }
    }

    pub fn contains(&self, value: &str) -> bool {
        self.by_value.contains_key(value)
    }

    pub fn values(&self) -> Vec<&str> {
        self.entries.iter().map(|e| e.value.as_str()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(value: &str, disabled: bool) -> ManifestEntry {
        ManifestEntry {
            display_name: Some(format!("Provider {value}")),
            value: value.to_string(),
            version: Some("1.0".into()),
            disabled,
            kind: Some("global".into()),
        }
    }

    #[test]
    fn load_filters_disabled_and_empty() {
        let dir = tempfile::tempdir().unwrap();
        {
            let manifest = vec![
                entry("vega", false),
                entry("showbox", true),
                entry("", false),
            ];
            let file = std::fs::File::create(dir.path().join("manifest.json")).unwrap();
            serde_json::to_writer(file, &manifest).unwrap();
        }

        let m = Manifest::load(dir.path()).expect("loads");
        assert_eq!(m.values(), vec!["vega"]);
        assert!(m.contains("vega"));
        assert!(!m.contains("showbox"));
    }

    #[test]
    fn load_missing_file_errors() {
        let dir = tempfile::tempdir().unwrap();
        assert!(Manifest::load(dir.path()).is_err());
    }

    #[test]
    fn load_invalid_json_errors() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("manifest.json"), "not json").unwrap();
        assert!(Manifest::load(dir.path()).is_err());
    }

    #[test]
    fn from_entries_builds_lookup() {
        let m = Manifest::from_entries(vec![entry("vega", false), entry("mod", true)]);
        assert_eq!(m.values(), vec!["vega", "mod"]);
        assert!(m.contains("vega"));
        assert!(m.contains("mod"));
        assert!(!m.contains("nope"));
    }
}
