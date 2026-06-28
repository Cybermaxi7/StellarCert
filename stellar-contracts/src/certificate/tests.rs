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