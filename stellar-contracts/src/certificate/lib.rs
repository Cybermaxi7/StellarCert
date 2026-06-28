#![no_std]
use soroban_sdk::{contract, contractimpl, Env, String, Symbol, Address};

#[contract]
pub struct CertificateContract;

#[contractimpl]
impl CertificateContract {
    /// Mutates the off-chain metadata URI reference pointer for a certificate and broadcasts an event.
    pub fn update_certificate_metadata(
        env: Env, 
        admin: Address, 
        certificate_id: String, 
        new_metadata_uri: String
    ) {
        admin.require_auth();

        // 1. (Your existing logic) Fetch state from storage, update URI data, and persist changes
        // let mut cert = env.storage().persistent().get(&certificate_id)...
        // cert.metadata_uri = new_metadata_uri.clone();
        // env.storage().persistent().set(&certificate_id, &cert);

        // 2. FIXED: Emit event so off-chain webhook processors and indexers can capture mutations
        env.events().publish(
            (
                Symbol::new(&env, "CertificateMetadataUpdatedEvent"), 
                certificate_id
            ), // Event Topics (Indexable)
            new_metadata_uri // Event Data Payload (The updated content URI pointer)
        );
    }
}