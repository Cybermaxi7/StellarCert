#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, String,
};

/// Number of contract events emitted by the most recent invocation.
///
/// soroban-sdk 27 returns `ContractEvents`, which is neither an iterator nor
/// indexable, so the old `events.last().unwrap().1` pattern no longer
/// compiles. `.all()` reports the events of the last invocation rather than a
/// running log, so each transition is checked immediately after it runs.
fn event_count(env: &Env) -> usize {
    env.events().all().events().len()
}

// Walks a certificate through its status transitions (suspend -> reinstate ->
// freeze -> unfreeze) and checks that each one emits an event and updates the
// stored status
#[test]
fn test_status_transition_events() {
    // Fresh test environment, with the contract registered in it and a client
    // for calling it
    let env = Env::default();
    let contract_id = env.register(CertificateContract, ());
    let client = CertificateContractClient::new(&env, &contract_id);

    // Randomly generated addresses for the roles involved
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let owner = Address::generate(&env);
    // Test data for the certificate
    let cert_id = String::from_str(&env, "test-cert");
    let metadata_uri = String::from_str(&env, "ipfs://test");

    // Make every require_auth() check pass so the test needs no real signatures
    env.mock_all_auths();
    // Setup: initialize with an admin and authorize the issuer
    client.initialize(&admin);
    client.add_issuer(&issuer);

    // Issue the certificate; it starts out Active (the status the
    // reinstate/unfreeze steps below return to)
    client.issue_certificate(&cert_id, &issuer, &owner, &metadata_uri, &None);

    // Suspend
    client.suspend_certificate(&cert_id, &String::from_str(&env, "suspended for testing"));
    // Events are read right after the call, since .all() only covers the
    // most recent invocation
    assert!(event_count(&env) >= 1, "suspend should emit an event");
    // Confirm the stored state changed too, not just that an event fired
    assert_eq!(
        client.get_certificate(&cert_id).unwrap().status,
        CertificateStatus::Suspended
    );

    // Reinstate
    // Suspended -> Active again
    client.reinstate_certificate(&cert_id, &String::from_str(&env, "reinstated for testing"));
    assert!(event_count(&env) >= 1, "reinstate should emit an event");
    assert_eq!(
        client.get_certificate(&cert_id).unwrap().status,
        CertificateStatus::Active
    );

    // Freeze
    client.freeze_certificate(&cert_id, &String::from_str(&env, "frozen for testing"));
    assert!(event_count(&env) >= 1, "freeze should emit an event");
    assert_eq!(
        client.get_certificate(&cert_id).unwrap().status,
        CertificateStatus::Frozen
    );

    // Unfreeze
    // Unlike the other transitions, this one takes no reason argument
    client.unfreeze_certificate(&cert_id);
    assert!(event_count(&env) >= 1, "unfreeze should emit an event");
    assert_eq!(
        client.get_certificate(&cert_id).unwrap().status,
        CertificateStatus::Active
    );
}