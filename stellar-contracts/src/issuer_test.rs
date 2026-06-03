#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_issuer_management() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CertificateContract);
    let client = CertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer1 = Address::generate(&env);
    let issuer2 = Address::generate(&env);

    // Initialize with admin
    client.initialize(&admin);

    // Initial count should be 0
    assert_eq!(client.get_issuer_count(), 0);
    assert_eq!(client.get_issuers().len(), 0);

    // Add first issuer
    env.mock_all_auths();
    client.add_issuer(&issuer1);

    assert_eq!(client.get_issuer_count(), 1);
    assert!(client.is_issuer(&issuer1));
    assert!(!client.is_issuer(&issuer2));

    let issuers = client.get_issuers();
    assert_eq!(issuers.len(), 1);
    assert_eq!(issuers.get(0).unwrap(), issuer1);

    // Add second issuer
    client.add_issuer(&issuer2);

    assert_eq!(client.get_issuer_count(), 2);
    assert!(client.is_issuer(&issuer2));

    let issuers = client.get_issuers();
    assert_eq!(issuers.len(), 2);
    
    // Add issuer1 again (should not increment count or add to list)
    client.add_issuer(&issuer1);
    assert_eq!(client.get_issuer_count(), 2);
    assert_eq!(client.get_issuers().len(), 2);
}

#[test]
fn test_remove_issuer_updates_vec_and_count() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CertificateContract);
    let client = CertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer1 = Address::generate(&env);
    let issuer2 = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();

    client.add_issuer(&issuer1);
    client.add_issuer(&issuer2);
    assert_eq!(client.get_issuer_count(), 2);

    // Remove issuer1 — count must drop and Vec must no longer contain it.
    client.remove_issuer(&issuer1);

    assert_eq!(client.get_issuer_count(), 1);
    assert!(!client.is_issuer(&issuer1));
    assert!(client.is_issuer(&issuer2));

    let issuers = client.get_issuers();
    assert_eq!(issuers.len(), 1);
    assert_eq!(issuers.get(0).unwrap(), issuer2);
}

#[test]
fn test_remove_issuer_idempotent_on_missing_issuer() {
    // Removing an address that was never added must not panic, and must not
    // corrupt the count or list.
    let env = Env::default();
    let contract_id = env.register_contract(None, CertificateContract);
    let client = CertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer1 = Address::generate(&env);
    let ghost = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();

    client.add_issuer(&issuer1);
    assert_eq!(client.get_issuer_count(), 1);

    // Removing a non-existent address must be a no-op.
    client.remove_issuer(&ghost);

    assert_eq!(client.get_issuer_count(), 1);
    assert_eq!(client.get_issuers().len(), 1);
    assert!(client.is_issuer(&issuer1));
}

#[test]
fn test_remove_all_issuers_reaches_zero() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CertificateContract);
    let client = CertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer1 = Address::generate(&env);
    let issuer2 = Address::generate(&env);
    let issuer3 = Address::generate(&env);

    client.initialize(&admin);
    env.mock_all_auths();

    client.add_issuer(&issuer1);
    client.add_issuer(&issuer2);
    client.add_issuer(&issuer3);
    assert_eq!(client.get_issuer_count(), 3);

    client.remove_issuer(&issuer2);
    client.remove_issuer(&issuer1);
    client.remove_issuer(&issuer3);

    assert_eq!(client.get_issuer_count(), 0);
    assert_eq!(client.get_issuers().len(), 0);
    assert!(!client.is_issuer(&issuer1));
    assert!(!client.is_issuer(&issuer2));
    assert!(!client.is_issuer(&issuer3));
}
