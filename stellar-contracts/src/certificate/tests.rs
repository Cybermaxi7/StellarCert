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