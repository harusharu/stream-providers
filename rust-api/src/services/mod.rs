//! Service layer: the "ports" of the gateway.
//!
//! [`provider::ProviderGateway`] is the single interface handlers depend on
//! for executing provider bundles. The production implementation is the Node
//! sidecar [`WorkerPool`](crate::worker::WorkerPool); tests inject a mock so
//! the HTTP surface can be tested without a Node runtime.

pub mod provider;
