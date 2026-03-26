#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, String, Vec};

mod types;
pub use types::*;

// mod metadata;
// pub use metadata::*;

mod multisig;
pub use multisig::*;

mod crl;
pub use crl::*;

#[contract]
pub struct CertificateContract;

#[contractimpl]
impl CertificateContract {
    /// Initialize the contract with an admin account
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Admin already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Add an authorized issuer (only admin can call)
    pub fn add_issuer(env: Env, issuer: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Contract not initialized");
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::Issuer(issuer), &true);
    }

    /// Issue a new certificate
    pub fn issue_certificate(
        env: Env,
        id: String,
        issuer: Address,
        owner: Address,
        metadata_uri: String,
        expires_at: Option<u64>,
    ) {
        issuer.require_auth();

        // Authorization check
        if !env
            .storage()
            .instance()
            .get::<_, bool>(&DataKey::Issuer(issuer.clone()))
            .unwrap_or(false)
        {
            panic!("Address is not an authorized issuer");
        }

        // Uniqueness check
        if env
            .storage()
            .instance()
            .has(&DataKey::Certificate(id.clone()))
        {
            panic!("Certificate with this ID already exists");
        }

        let cert = Certificate {
            id: id.clone(),
            issuer: issuer.clone(),
            owner: owner.clone(),
            status: CertificateStatus::Active,
            metadata_uri,
            issued_at: env.ledger().timestamp(),
            expires_at,
        };

        // Store the certificate
        env.storage()
            .instance()
            .set(&DataKey::Certificate(id.clone()), &cert);

        // Emit and publish issuance event
        env.events().publish(
            (symbol_short!("issued"), id.clone()),
            CertificateIssuedEvent { id, issuer, owner },
        );
    }

    /// Revoke an existing certificate (only the original issuer can revoke)
    pub fn revoke_certificate(env: Env, id: String, reason: String) {
        let mut cert: Certificate = env
            .storage()
            .instance()
            .get(&DataKey::Certificate(id.clone()))
            .expect("Certificate not found");
        cert.issuer.require_auth();

        if cert.status == CertificateStatus::Revoked {
            panic!("Certificate is already revoked");
        }

        cert.status = CertificateStatus::Revoked;
        env.storage()
            .instance()
            .set(&DataKey::Certificate(id.clone()), &cert);

        // Emit and publish revocation event
        env.events().publish(
            (symbol_short!("revoked"), id.clone()),
            CertificateRevokedEvent { id, reason },
        );
    }

    /// Get certificate details
    pub fn get_certificate(env: Env, id: String) -> Option<Certificate> {
        env.storage().instance().get(&DataKey::Certificate(id))
    }

    /// Suspend a certificate
    pub fn suspend_certificate(env: Env, id: String) {
        let mut cert: Certificate = env
            .storage()
            .instance()
            .get(&DataKey::Certificate(id.clone()))
            .expect("Certificate not found");
        cert.issuer.require_auth();

        if cert.status == CertificateStatus::Suspended {
            panic!("Certificate is already suspended");
        }

        cert.status = CertificateStatus::Suspended;
        env.storage()
            .instance()
            .set(&DataKey::Certificate(id.clone()), &cert);
    }

    /// Reinstate a suspended certificate
    pub fn reinstate_certificate(env: Env, id: String) {
        let mut cert: Certificate = env
            .storage()
            .instance()
            .get(&DataKey::Certificate(id.clone()))
            .expect("Certificate not found");
        cert.issuer.require_auth();

        if cert.status != CertificateStatus::Suspended {
            panic!("Certificate is not suspended");
        }

        cert.status = CertificateStatus::Active;
        env.storage()
            .instance()
            .set(&DataKey::Certificate(id.clone()), &cert);
    }

    /// Freeze a certificate
    pub fn freeze_certificate(env: Env, id: String) {
        let mut cert: Certificate = env
            .storage()
            .instance()
            .get(&DataKey::Certificate(id.clone()))
            .expect("Certificate not found");
        cert.issuer.require_auth();

        if cert.status == CertificateStatus::Frozen {
            panic!("Certificate is already frozen");
        }

        cert.status = CertificateStatus::Frozen;
        env.storage()
            .instance()
            .set(&DataKey::Certificate(id.clone()), &cert);
    }

    /// Unfreeze a certificate
    pub fn unfreeze_certificate(env: Env, id: String) {
        let mut cert: Certificate = env
            .storage()
            .instance()
            .get(&DataKey::Certificate(id.clone()))
            .expect("Certificate not found");
        cert.issuer.require_auth();

        if cert.status != CertificateStatus::Frozen {
            panic!("Certificate is not frozen");
        }

        cert.status = CertificateStatus::Active;
        env.storage()
            .instance()
            .set(&DataKey::Certificate(id.clone()), &cert);
    }


    /// Verify if a certificate is valid (active and not expired)
    pub fn is_valid(env: Env, id: String) -> bool {
        if let Some(cert) = env
            .storage()
            .instance()
            .get::<_, Certificate>(&DataKey::Certificate(id))
        {
            if cert.status != CertificateStatus::Active {
                return false;
            }
            if let Some(expires) = cert.expires_at {
                if env.ledger().timestamp() >= expires {
                    return false;
                }
            }
            true
        } else {
            false
        }
    }

    // --- Multisig Functions ---

    pub fn init_multisig_config(
        env: Env,
        issuer: Address,
        threshold: u32,
        signers: Vec<Address>,
        max_signers: u32,
        admin: Address,
    ) {
        admin.require_auth();
        #[allow(clippy::unnecessary_cast)]
        if threshold == 0
            || signers.is_empty()
            || threshold > signers.len() as u32
            || max_signers < threshold
        {
            panic!("Invalid multisig parameters");
        }
        env.storage().instance().set(
            &DataKey::MultisigConfig(issuer.clone()),
            &MultisigConfig {
                threshold,
                signers,
                max_signers,
            },
        );
        env.storage()
            .instance()
            .set(&DataKey::IssuerAdmin(issuer), &admin);
    }

    pub fn update_multisig_config(
        env: Env,
        issuer: Address,
        new_threshold: Option<u32>,
        new_signers: Option<Vec<Address>>,
        new_max_signers: Option<u32>,
    ) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::IssuerAdmin(issuer.clone()))
            .expect("Issuer admin not found");
        admin.require_auth();

        let mut config: MultisigConfig = env
            .storage()
            .instance()
            .get(&DataKey::MultisigConfig(issuer.clone()))
            .expect("Multisig config not found");

        if let Some(signers) = new_signers {
            config.signers = signers;
        }
        if let Some(threshold) = new_threshold {
            config.threshold = threshold;
        }
        if let Some(max_signers) = new_max_signers {
            config.max_signers = max_signers;
        }

        #[allow(clippy::unnecessary_cast)]
        if config.threshold == 0
            || config.signers.is_empty()
            || config.threshold > config.signers.len() as u32
            || config.max_signers < config.threshold
        {
            panic!("Invalid updated multisig parameters");
        }

        env.storage()
            .instance()
            .set(&DataKey::MultisigConfig(issuer), &config);
    }

    pub fn propose_certificate(
        env: Env,
        request_id: String,
        issuer: Address,
        recipient: Address,
        metadata: String,
        expiration_days: u32,
    ) -> PendingRequest {
        if !env
            .storage()
            .instance()
            .has(&DataKey::MultisigConfig(issuer.clone()))
        {
            panic!("Issuer does not have multisig configuration");
        }
        if env
            .storage()
            .instance()
            .has(&DataKey::PendingRequest(request_id.clone()))
        {
            panic!("Request already exists");
        }

        let request = PendingRequest {
            id: request_id.clone(),
            issuer: issuer.clone(),
            recipient: recipient.clone(),
            metadata: metadata.clone(),
            proposer: issuer.clone(),
            approvals: Vec::new(&env),
            rejections: Vec::new(&env),
            created_at: env.ledger().timestamp(),
            expires_at: env.ledger().timestamp() + expiration_days as u64,
            status: RequestStatus::Pending,
        };

        env.storage()
            .instance()
            .set(&DataKey::PendingRequest(request_id), &request);
        request
    }

    pub fn approve_request(env: Env, request_id: String, approver: Address) -> SignatureResult {
        approver.require_auth();
        let mut request: PendingRequest = env
            .storage()
            .instance()
            .get(&DataKey::PendingRequest(request_id.clone()))
            .expect("Request not found");

        if env.ledger().timestamp() > request.expires_at {
            request.status = RequestStatus::Expired;
            env.storage()
                .instance()
                .set(&DataKey::PendingRequest(request_id), &request);
            return SignatureResult {
                success: false,
                message: String::from_str(&env, "Expired"),
                final_status: OptionalRequestStatus::Some(RequestStatus::Expired),
            };
        }

        if request.status != RequestStatus::Pending {
            return SignatureResult {
                success: false,
                message: String::from_str(&env, "Not pending"),
                final_status: OptionalRequestStatus::Some(request.status),
            };
        }

        let config: MultisigConfig = env
            .storage()
            .instance()
            .get(&DataKey::MultisigConfig(request.issuer.clone()))
            .expect("Config not found");
        if !config.signers.contains(&approver) {
            return SignatureResult {
                success: false,
                message: String::from_str(
                    &env,
                    "Approver is not an authorized signer",
                ),
                final_status: OptionalRequestStatus::Some(request.status),
            };
        }

        if request.approvals.contains(&approver) {
            return SignatureResult {
                success: false,
                message: String::from_str(&env, "Request already approved by this signer"),
                final_status: OptionalRequestStatus::Some(request.status),
            };
        }

        request.approvals.push_back(approver);

        if request.approvals.len() >= config.threshold {
            request.status = RequestStatus::Approved;
        }

        env.storage()
            .instance()
            .set(&DataKey::PendingRequest(request_id), &request);
        SignatureResult {
            success: true,
            message: String::from_str(&env, "Approved"),
            final_status: OptionalRequestStatus::Some(request.status),
        }
    }

    pub fn reject_request(
        env: Env,
        request_id: String,
        rejector: Address,
        _reason: Option<String>,
    ) -> SignatureResult {
        rejector.require_auth();
        let mut request: PendingRequest = env
            .storage()
            .instance()
            .get(&DataKey::PendingRequest(request_id.clone()))
            .expect("Request not found");

        if request.status != RequestStatus::Pending {
            return SignatureResult {
                success: false,
                message: String::from_str(&env, "Not pending"),
                final_status: OptionalRequestStatus::Some(request.status),
            };
        }

        if !request.rejections.contains(&rejector) {
            request.rejections.push_back(rejector);
        }

        // Simplify rejection: one rejection doesn't necessarily fail the whole thing unless threshold can't be met
        // For simplicity, we just track it.

        env.storage()
            .instance()
            .set(&DataKey::PendingRequest(request_id), &request);
        SignatureResult {
            success: true,
            message: String::from_str(&env, "Rejected"),
            final_status: OptionalRequestStatus::Some(request.status),
        }
    }

    pub fn issue_approved_certificate(env: Env, request_id: String) -> bool {
        let mut request: PendingRequest = env
            .storage()
            .instance()
            .get(&DataKey::PendingRequest(request_id.clone()))
            .expect("Request not found");
        if request.status != RequestStatus::Approved {
            return false;
        }

        // Issue the actual certificate
        Self::issue_certificate(
            env.clone(),
            request.id.clone(),
            request.issuer.clone(),
            request.recipient.clone(),
            request.metadata.clone(),
            Some(request.expires_at),
        );

        request.status = RequestStatus::Issued;
        env.storage()
            .instance()
            .set(&DataKey::PendingRequest(request_id), &request);
        true
    }

    pub fn get_multisig_config(env: Env, issuer: Address) -> MultisigConfig {
        env.storage()
            .instance()
            .get(&DataKey::MultisigConfig(issuer))
            .expect("Multisig.config not found")
    }

    pub fn get_pending_request(env: Env, request_id: String) -> PendingRequest {
        env.storage()
            .instance()
            .get(&DataKey::PendingRequest(request_id))
            .expect("Request not found")
    }

    pub fn is_expired(env: Env, request_id: String) -> bool {
        let request: PendingRequest = env
            .storage()
            .instance()
            .get(&DataKey::PendingRequest(request_id))
            .expect("Request not found");
        env.ledger().timestamp() > request.expires_at
    }

    pub fn get_pending_requests_for_issuer(
        env: Env,
        _issuer: Address,
        pagination: Pagination,
    ) -> PaginatedResult {
        // Simplified return since iteration is hard
        PaginatedResult {
            data: Vec::new(&env),
            total: 0,
            page: pagination.page,
            limit: pagination.limit,
            has_next: false,
        }
    }

    pub fn get_pending_requests_for_signer(
        env: Env,
        _signer: Address,
        pagination: Pagination,
    ) -> PaginatedResult {
        // Simplified return
        PaginatedResult {
            data: Vec::new(&env),
            total: 0,
            page: pagination.page,
            limit: pagination.limit,
            has_next: false,
        }
    }

    pub fn cancel_request(env: Env, request_id: String, requester: Address) -> bool {
        requester.require_auth();
        let mut request: PendingRequest = env
            .storage()
            .instance()
            .get(&DataKey::PendingRequest(request_id.clone()))
            .expect("Request not found");
        if request.proposer != requester {
            panic!("Only proposer can cancel");
        }
        request.status = RequestStatus::Rejected;
        env.storage()
            .instance()
            .set(&DataKey::PendingRequest(request_id), &request);
        true
    }

    /// Batch verify multiple certificates
    pub fn batch_verify_certificates(env: Env, ids: Vec<String>) -> VerificationReport {
        const BASE_VERIFICATION_COST: u64 = 100;
        const COST_PER_CERTIFICATE: u64 = 50;

        let mut results = Vec::<VerificationResult>::new(&env);
        let mut successful: u32 = 0;
        let mut failed: u32 = 0;

        for id in ids.iter() {
            if let Some(cert) = env
                .storage()
                .instance()
                .get::<_, Certificate>(&DataKey::Certificate(id.clone()))
            {
                let is_revoked = cert.status == CertificateStatus::Revoked
                    || cert.status == CertificateStatus::Suspended
                    || cert.status == CertificateStatus::Expired;

                if !is_revoked {
                    successful += 1;
                } else {
                    failed += 1;
                }

                results.push_back(VerificationResult {
                    id: id.clone(),
                    exists: true,
                    revoked: is_revoked,
                });
            } else {
                failed += 1;
                results.push_back(VerificationResult {
                    id: id.clone(),
                    exists: false,
                    revoked: false,
                });
            }
        }

        let total_cost = BASE_VERIFICATION_COST + (COST_PER_CERTIFICATE * ids.len() as u64);

        VerificationReport {
            total: ids.len() as u32,
            successful,
            failed,
            total_cost,
            results,
        }
    }

    /// Set certificate expiry (only admin can call)
    pub fn set_certificate_expiry(env: Env, id: String, expiry_time: u64, admin: Address) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Contract not initialized");
        admin.require_auth();

        if admin != stored_admin {
            panic!("Only admin can set certificate expiry");
        }

        let mut cert: Certificate = env
            .storage()
            .instance()
            .get(&DataKey::Certificate(id.clone()))
            .expect("Certificate not found");

        cert.expires_at = Some(expiry_time);
        env.storage()
            .instance()
            .set(&DataKey::Certificate(id), &cert);
    }

    /// Get certificate expiry time
    pub fn get_certificate_expiry(env: Env, id: String) -> Option<u64> {
        if let Some(cert) = env
            .storage()
            .instance()
            .get::<_, Certificate>(&DataKey::Certificate(id))
        {
            cert.expires_at
        } else {
            None
        }
    }
}
