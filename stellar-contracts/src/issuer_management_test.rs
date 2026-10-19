#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

// After an issuer is removed, they must no longer be able to issue certificates
#[test]
fn test_remove_issuer_clears_issuer_storage() {
    // Fresh test environment; mock_all_auths() makes every require_auth()
    // check pass, so the tests don't need to build real signatures
    let env = Env::default();
    env.mock_all_auths();

    // Register the contract in the test environment and get a client for calling it
    let contract_id = env.register(CertificateContract, ());
    let client = CertificateContractClient::new(&env, &contract_id);

    // Randomly generated addresses for the three roles involved
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let owner = Address::generate(&env);

    // Test data for the certificate that will be issued
    let id = String::from_str(&env, "cert-remove-issuer");
    let metadata_uri = String::from_str(&env, "ipfs://meta");

    // Setup: initialize the contract with an admin, then authorize the issuer
    client.initialize(&admin);
    client.add_issuer(&issuer);

    // Action: remove the issuer
    client.remove_issuer(&issuer);

    // The try_ variant returns a Result instead of panicking, so the test can
    // assert that issuing now fails. This checks that the removal really took
    // effect, not just that the call succeeded
    let issue_result = client.try_issue_certificate(&id, &issuer, &owner, &metadata_uri, &None);
    assert!(issue_result.is_err());
}

// Removing an issuer should be safe to repeat, and safe even if the address
// was never an issuer. The test passes as long as no call panics
#[test]
fn test_remove_issuer_is_idempotent() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(CertificateContract, ());
    let client = CertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    client.initialize(&admin);

    // Removing a non-existent issuer should be a no-op.
    client.remove_issuer(&issuer);

    // Add the issuer, then remove them twice in a row;
    // the second removal should also be a harmless no-op
    client.add_issuer(&issuer);
    client.remove_issuer(&issuer);
    client.remove_issuer(&issuer);
}