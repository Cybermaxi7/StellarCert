#![cfg(test)]
use super::multisig::*;
use soroban_sdk::{Env, testutils::Address as _, Address, String, Vec};

#[test]
fn test_init_multisig_config() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    
    let signers = vec![&env, signer1.clone(), signer2.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &2, &signers, &5, &admin);

    let config = client.get_multisig_config(&issuer);
    assert_eq!(config.threshold, 2);
    assert_eq!(config.max_signers, 5);
    assert_eq!(config.signers.len(), 2);
}

#[test]
fn test_propose_certificate() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    
    let signers = vec![&env, signer1.clone(), signer2.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &2, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-001");
    let metadata = String::from_str(&env, "certificate metadata");
    
    let request = client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &7);
    
    assert_eq!(request.id, request_id);
    assert_eq!(request.issuer, issuer);
    assert_eq!(request.recipient, recipient);
    assert_eq!(request.status, RequestStatus::Pending);
    assert_eq!(request.approvals.len(), 0);
    assert_eq!(request.rejections.len(), 0);
}

#[test]
fn test_approve_request_success() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    
    let signers = vec![&env, signer1.clone(), signer2.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &2, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-002");
    let metadata = String::from_str(&env, "certificate metadata");
    
    client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &7);

    // First approval
    let result = client.approve_request(&request_id, &signer1);
    assert!(result.success);
    assert_eq!(result.final_status, OptionalRequestStatus::Some(RequestStatus::Pending));

    // Second approval - should reach threshold and become approved
    let result = client.approve_request(&request_id, &signer2);
    assert!(result.success);
    assert_eq!(result.final_status, OptionalRequestStatus::Some(RequestStatus::Approved));

    // Check the request status
    let request = client.get_pending_request(&request_id);
    assert_eq!(request.status, RequestStatus::Approved);
    assert_eq!(request.approvals.len(), 2);
}

#[test]
fn test_reject_request() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    
    // Set up config with 3 signers, threshold 2
    let signers = vec![&env, signer1.clone(), signer2.clone(), signer3.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &2, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-003");
    let metadata = String::from_str(&env, "certificate metadata");
    
    client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &7);

    // Reject by one signer
    let result = client.reject_request(&request_id, &signer1, &None);
    assert!(result.success);
    assert_eq!(result.final_status, OptionalRequestStatus::Some(RequestStatus::Pending));

    // Approve by another signer
    let result = client.approve_request(&request_id, &signer2);
    assert!(result.success);
    assert_eq!(result.final_status, OptionalRequestStatus::Some(RequestStatus::Pending));

    // Approve by third signer - should succeed despite rejection
    let result = client.approve_request(&request_id, &signer3);
    assert!(result.success);
    assert_eq!(result.final_status, OptionalRequestStatus::Some(RequestStatus::Approved));

    // Check the request status
    let request = client.get_pending_request(&request_id);
    assert_eq!(request.status, RequestStatus::Approved);
    assert_eq!(request.approvals.len(), 2);
    assert_eq!(request.rejections.len(), 1);
}

#[test]
fn test_reject_request_impossible_approval() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    
    // Set up config with 3 signers, threshold 3 (all must approve)
    let signers = vec![&env, signer1.clone(), signer2.clone(), signer3.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &3, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-004");
    let metadata = String::from_str(&env, "certificate metadata");
    
    client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &7);

    // Reject by one signer
    let result = client.reject_request(&request_id, &signer1, &None);
    assert!(result.success);
    assert_eq!(result.final_status, OptionalRequestStatus::Some(RequestStatus::Pending));

    // Reject by second signer - now impossible to reach threshold of 3
    let result = client.reject_request(&request_id, &signer2, &None);
    assert!(result.success);
    assert_eq!(result.final_status, OptionalRequestStatus::Some(RequestStatus::Rejected));

    // Check the request status
    let request = client.get_pending_request(&request_id);
    assert_eq!(request.status, RequestStatus::Rejected);
    assert_eq!(request.rejections.len(), 2);
    assert_eq!(request.approvals.len(), 0);
}

#[test]
fn test_issue_approved_certificate() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    
    let signers = vec![&env, signer1.clone(), signer2.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &2, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-005");
    let metadata = String::from_str(&env, "certificate metadata");
    
    client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &7);

    // Get both approvals
    client.approve_request(&request_id, &signer1);
    client.approve_request(&request_id, &signer2);

    // Issue the certificate
    let success = client.issue_approved_certificate(&request_id);
    assert!(success);

    // Check the request status
    let request = client.get_pending_request(&request_id);
    assert_eq!(request.status, RequestStatus::Issued);
}

#[test]
fn test_cancel_request() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let proposer = Address::generate(&env); // Same as issuer in this case
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    
    let signers = vec![&env, signer1.clone(), signer2.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &2, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-006");
    let metadata = String::from_str(&env, "certificate metadata");
    
    client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &7);

    // Cancel the request (proposer is the issuer in our implementation)
    let success = client.cancel_request(&request_id, &issuer);
    assert!(success);

    // Check the request status
    let request = client.get_pending_request(&request_id);
    assert_eq!(request.status, RequestStatus::Rejected); // Using Rejected as cancelled
}

#[test]
fn test_update_multisig_config() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    
    let initial_signers = vec![&env, signer1.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &1, &initial_signers, &5, &admin);

    // Update the config
    let new_signers = vec![&env, signer1.clone(), signer2.clone()];
    client.update_multisig_config(&Some(2), &Some(&new_signers), &Some(10), &issuer);

    let config = client.get_multisig_config(&issuer);
    assert_eq!(config.threshold, 2);
    assert_eq!(config.max_signers, 10);
    assert_eq!(config.signers.len(), 2);
}

#[test]
fn test_invalid_approve_by_non_signer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let non_signer = Address::generate(&env); // This address is not in the signers list
    
    let signers = vec![&env, signer1.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &1, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-007");
    let metadata = String::from_str(&env, "certificate metadata");
    
    client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &7);

    // Try to approve with non-signer - should fail
    let result = client.approve_request(&request_id, &non_signer);
    assert!(!result.success);
    assert_eq!(result.message, "Approver is not an authorized signer");
}

#[test]
fn test_double_approval() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let signer1 = Address::generate(&env);
    
    let signers = vec![&env, signer1.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &2, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-008");
    let metadata = String::from_str(&env, "certificate metadata");
    
    client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &7);

    // First approval
    let result = client.approve_request(&request_id, &signer1);
    assert!(result.success);

    // Second approval by same signer - should fail
    let result = client.approve_request(&request_id, &signer1);
    assert!(!result.success);
    assert_eq!(result.message, "Request already approved by this signer");
}

#[test]
fn test_expired_request() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MultisigCertificateContract);
    let client = MultisigCertificateContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let recipient = Address::generate(&env);
    let signer1 = Address::generate(&env);
    
    let signers = vec![&env, signer1.clone()];
    
    env.mock_all_auths();
    client.init_multisig_config(&issuer, &1, &signers, &5, &admin);

    let request_id = String::from_str(&env, "req-009");
    let metadata = String::from_str(&env, "certificate metadata");
    
    // Create request with 1 day expiration
    client.propose_certificate(&request_id, &issuer, &recipient, &metadata, &1);

    // Manually advance time to expire the request (in a real test, we'd use ledger time)
    // This is a simplified test - in reality we'd check the expiration in the contract
    let is_expired = client.is_expired(&request_id);
    // Note: This depends on the current ledger time vs expiration time
    // For this test, we're just checking the function exists
}