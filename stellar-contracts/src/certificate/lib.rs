#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env, String, Symbol, Address};

// ... Other contract types (e.g., Certificate struct) ...

#[contract]
pub struct CertificateContract;

#[contractimpl]
impl CertificateContract {
    /// Suspends an active certificate and emits an audit-compliant event containing the reason.
    pub fn suspend_certificate(env: Env, admin: Address, certificate_id: String, reason: String) {
        admin.require_auth();

        // 1. (Your existing logic) Fetch, mutate, and update the certificate state in storage
        // let mut cert = env.storage().persistent().get(&certificate_id)...
        // cert.is_suspended = true;
        // cert.suspension_reason = reason.clone();
        // env.storage().persistent().set(&certificate_id, &cert);

        // 2. UPDATED: Emit the event with both certificate_id AND the reason payload
        env.events().publish(
            (
                Symbol::new(&env, "CertificateSuspendedEvent"), 
                certificate_id
            ), // Event Topics (Indexable)
            reason // Event Data Payload
        );
    }
}