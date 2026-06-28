#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::{Events, Address as _}, vec, Env, IntoVal, Symbol, String};

#[test]
fn test_suspend_certificate_emits_complete_event_payload() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CertificateContract);
    let client = CertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let cert_id = String::from_str(&env, "CERT-2026-XYZ");
    let suspension_reason = String::from_str(&env, "Non-compliance with curriculum standards");

    // Invoke the method
    client.suspend_certificate(&admin, &cert_id, &suspension_reason);

    // Fetch the last emitted event
    let last_event = env.events().all().last().unwrap();
    
    // Assert Topics match: (Symbol("CertificateSuspendedEvent"), cert_id)
    assert_eq!(
        last_event.0,
        (
            contract_id,
            (Symbol::new(&env, "CertificateSuspendedEvent"), cert_id.clone()).into_val(&env)
        )
    );

    // Assert Data Payload matches the suspension_reason string exactly
    assert_eq!(last_event.1, suspension_reason.into_val(&env));
}

#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::{Events, Address as _}, Env, IntoVal, Symbol, String};

#[test]
fn test_update_certificate_metadata_emits_event_successfully() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CertificateContract);
    let client = CertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let cert_id = String::from_str(&env, "CERT-2026-999");
    let target_uri = String::from_str(&env, "ipfs://bafybeicdxxx...");

    // Execute the state update invocation
    client.update_certificate_metadata(&admin, &cert_id, &target_uri);

    // Grab the last emitted event from the testing mock framework stack
    let last_event = env.events().all().last().unwrap();
    
    // Validate Indexable Topics: (Symbol("CertificateMetadataUpdatedEvent"), cert_id)
    assert_eq!(
        last_event.0,
        (
            contract_id,
            (Symbol::new(&env, "CertificateMetadataUpdatedEvent"), cert_id.clone()).into_val(&env)
        )
    );

    // Validate Data Payload matches the new IPFS / web uri exactly
    assert_eq!(last_event.1, target_uri.into_val(&env));
}

#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Env, String, Symbol};

#[test]
fn test_reissue_certificate_atomically_revokes_original() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CertificateContract);
    let client = CertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let original_id = String::from_str(&env, "CERT-OLD-123");
    let new_id = String::from_str(&env, "CERT-NEW-456");
    let metadata_uri = String::from_str(&env, "ipfs://bafy...");

    // Seed the initial certificate state in storage
    // (Adjust according to your contract's actual issue setup helper method)
    // client.issue_certificate(&admin, &user, &original_id, ...);

    // Execute reissuance
    client.reissue_certificate(&admin, &original_id, &new_id, &metadata_uri);

    // Assertions: 
    // 1. Fetch the original certificate record and verify its status is now Revoked
    let fetched_old: Certificate = env.storage().persistent().get(&original_id).unwrap();
    assert_eq!(fetched_old.status, Symbol::new(&env, "Revoked"));
    assert_eq!(fetched_old.internal_reason, String::from_str(&env, "Superseded"));

    // 2. Fetch the newly reissued certificate and confirm it is Active
    let fetched_new: Certificate = env.storage().persistent().get(&new_id).unwrap();
    assert_eq!(fetched_new.status, Symbol::new(&env, "Active"));
}