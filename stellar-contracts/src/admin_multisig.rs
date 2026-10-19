use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, BytesN, Env, IntoVal, String,
    Val, Vec,
};

// The privileged operations a multisig proposal can carry out.
// `#[contracttype]` makes the enum serializable for storage and contract calls.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AdminAction {
    // Upgrade the certificate contract to the WASM with this hash
    UpgradeContract(BytesN<32>),
    // Remove an issuer (marks it removed locally and tells the certificate contract)
    RemoveIssuer(Address),
    // Replace the multisig config: (threshold, signers, proposal_window)
    UpdateConfig(u32, Vec<Address>, u32),
    // Catch-all for free-form actions; currently always rejected at execution time
    Other(String),
}

// The multisig's governing settings, stored in instance storage
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminMultisigConfig {
    // Number of approvals needed to execute a proposal
    pub threshold: u32,
    // Addresses allowed to propose and approve
    pub signers: Vec<Address>,
    // How many ledgers a proposal stays open after creation
    pub proposal_window: u32,
}

// Lifecycle states of a proposal
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AdminProposalStatus {
    /// Submitted and collecting approvals.
    Pending,
    /// Threshold reached; the action is about to be (or has just been) executed.
    Approved,
    /// The action ran successfully.
    Executed,
    /// The proposal window closed before the threshold was reached.
    Expired,
    /// Rejected without executing. Reserved for a proposal that is voted down
    /// (no rejection entry point exists yet); a proposer cancellation is
    /// recorded as `Cancelled` instead so the two are distinguishable in audit
    /// logs and in the event stream.
    Rejected,
    /// Withdrawn by its proposer via `cancel_proposal`. Terminal, like
    /// `Rejected`, but deliberately a distinct status so a cancellation is
    /// never reported as a rejection.
    Cancelled,
}

// A single governance proposal, stored per-id in persistent storage
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminProposal {
    // Caller-chosen unique id
    pub id: String,
    // What will run once the threshold is reached
    pub action: AdminAction,
    // Signer who created the proposal (cannot approve their own)
    pub proposer: Address,
    // Signers who have approved so far
    pub approvals: Vec<Address>,
    // Ledger sequence when the proposal was created
    pub created_ledger: u32,
    // Last ledger at which the proposal can still be approved
    pub expires_at_ledger: u32,
    pub status: AdminProposalStatus,
}

// Admin multisig contract events. Declared with `#[contractevent]` so the topic
// list and payload shape are checked at compile time and published into the
// contract spec. The `topics = [...]` lists reproduce the two-symbol topics the
// previous untyped `env.events().publish` calls used, keeping the on-chain event
// stream wire-compatible; the payload is a map keyed by field name.
//
// `ProposalExecutedEvent` is the exception: the call it replaces published a bare
// `proposal_id` string rather than a struct, so it uses `data_format =
// "single-value"` to stay byte-for-byte identical.

// Emitted when a new proposal is created
#[contractevent(topics = ["proposal", "created"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalCreatedEvent {
    pub proposal_id: String,
    pub proposer: Address,
    pub expires_at_ledger: u32,
}

// Emitted each time a signer approves a proposal
#[contractevent(topics = ["proposal", "approved"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalApprovedEvent {
    pub proposal_id: String,
    pub approver: Address,
    // Approvals collected so far, and the number required
    pub approval_count: u32,
    pub threshold: u32,
}

// Emitted when the proposer withdraws a pending proposal
// (note the on-chain topic is spelled "canceled", the status "Cancelled")
#[contractevent(topics = ["proposal", "canceled"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalCanceledEvent {
    pub proposal_id: String,
    pub proposer: Address,
}

// Emitted after a proposal's action runs successfully;
// the payload is just the proposal id, not a map
#[contractevent(topics = ["proposal", "executed"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalExecutedEvent {
    pub proposal_id: String,
}

// Multisig governance contract: a set of signers propose privileged actions
// and, once enough of them approve, the action is executed automatically
#[contract]
pub struct AdminMultisigContract;

#[contractimpl]
impl AdminMultisigContract {
    // Write a value to instance storage and refresh its TTL.
    // Private helper (not `pub`), so it is not exposed as a contract function
    fn set_instance<K, V>(env: &Env, key: &K, value: &V)
    where
        K: IntoVal<Env, Val>,
        V: IntoVal<Env, Val>,
    {
        env.storage().instance().set(key, value);
        crate::persistent::extend_instance_ttl(env, None);
    }

    /// Persist a keyed record in persistent storage (per-id entries).
    /// Used for AdminProposal and RemovedIssuer so instance storage stays bounded.
    fn set_persistent<K, V>(env: &Env, key: &K, value: &V)
    where
        K: IntoVal<Env, Val> + Clone,
        V: IntoVal<Env, Val>,
    {
        env.storage().persistent().set(key, value);
        // Extend the entry's TTL so it doesn't get archived
        crate::persistent::extend_ttl(env, key, None);
    }

    /// Installs the admin signer set.
    ///
    /// Every proposed signer must authorize. There is no admin address to
    /// authenticate against at this point, and a signer set is exactly the
    /// thing being established — so consent from the whole set is the only
    /// check that actually means anything here.
    pub fn init_admin_multisig(
        env: Env,
        threshold: u32,
        signers: Vec<Address>,
        proposal_window: u32,
    ) {
        // Reject impossible configs (e.g. threshold greater than signer count)
        Self::validate_config(&signers, threshold, proposal_window);

        // Every signer must sign this transaction, proving they consent to being added
        for signer in signers.iter() {
            signer.require_auth();
        }

        // One-time setup: refuse to overwrite an existing config
        if env
            .storage()
            .instance()
            .has(&AdminMultisigDataKey::AdminConfig)
        {
            panic!("Admin multisig already initialized");
        }

        Self::set_instance(
            &env,
            &AdminMultisigDataKey::AdminConfig,
            &AdminMultisigConfig {
                threshold,
                signers,
                proposal_window,
            },
        );
    }

    // Read the current config; panics if init_admin_multisig hasn't run yet
    pub fn get_config(env: Env) -> AdminMultisigConfig {
        env.storage()
            .instance()
            .get(&AdminMultisigDataKey::AdminConfig)
            .expect("Admin multisig not initialized")
    }

    // Create a new proposal. The proposer must be a signer and authorize the call.
    // The proposer does not auto-approve; another signer must (see approve_action)
    pub fn propose_action(
        env: Env,
        proposal_id: String,
        proposer: Address,
        action: AdminAction,
    ) -> AdminProposal {
        // Proves the proposer actually signed this call
        proposer.require_auth();

        let config = Self::get_config(env.clone());
        Self::require_signer(&config.signers, &proposer);

        // Proposal ids must be unique
        let proposal_key = AdminMultisigDataKey::AdminProposal(proposal_id.clone());
        if env.storage().persistent().has(&proposal_key) {
            panic!("Proposal already exists");
        }

        // The proposal is open for `proposal_window` ledgers from now
        // (saturating_add avoids overflow with a huge window)
        let created_ledger = env.ledger().sequence();
        let expires_at_ledger = created_ledger.saturating_add(config.proposal_window);

        let proposal = AdminProposal {
            id: proposal_id.clone(),
            action,
            proposer: proposer.clone(),
            approvals: Vec::new(&env),
            created_ledger,
            expires_at_ledger,
            status: AdminProposalStatus::Pending,
        };

        Self::set_persistent(&env, &proposal_key, &proposal);
        ProposalCreatedEvent {
            proposal_id,
            proposer,
            expires_at_ledger,
        }
        .publish(&env);

        proposal
    }

    // Record a signer's approval. When the threshold is reached, the action is
    // executed in the same call. Returns the proposal's resulting status
    pub fn approve_action(env: Env, proposal_id: String, approver: Address) -> AdminProposalStatus {
        approver.require_auth();

        let config = Self::get_config(env.clone());
        Self::require_signer(&config.signers, &approver);

        let proposal_key = AdminMultisigDataKey::AdminProposal(proposal_id.clone());
        let mut proposal: AdminProposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .expect("Proposal not found");

        // Only pending proposals can collect approvals
        if proposal.status != AdminProposalStatus::Pending {
            panic!("Proposal is not pending");
        }

        // If the window has closed, record the expiry and return instead of
        // panicking, so the Expired status is actually saved
        // (a panic would roll back the write)
        let current_ledger = env.ledger().sequence();
        if current_ledger > proposal.expires_at_ledger {
            proposal.status = AdminProposalStatus::Expired;
            Self::set_persistent(&env, &proposal_key, &proposal);
            return AdminProposalStatus::Expired;
        }

        // Four-eyes rule: the proposer can't be one of the approvals
        if proposal.proposer == approver {
            panic!("Proposer cannot approve their own action");
        }

        // Each signer can approve only once
        if proposal.approvals.contains(&approver) {
            panic!("Already approved by this signer");
        }

        proposal.approvals.push_back(approver.clone());
        let approval_count = proposal.approvals.len();

        ProposalApprovedEvent {
            proposal_id: proposal_id.clone(),
            approver,
            approval_count,
            threshold: config.threshold,
        }
        .publish(&env);

        // Threshold reached: mark Approved and save before executing
        let mut status = AdminProposalStatus::Pending;
        if approval_count >= config.threshold {
            proposal.status = AdminProposalStatus::Approved;
            status = AdminProposalStatus::Approved;
        }

        Self::set_persistent(&env, &proposal_key, &proposal);

        // Execute immediately; on success the returned status is Executed
        if status == AdminProposalStatus::Approved {
            status = Self::execute_action(env, proposal_id);
        }

        status
    }

    /// Withdraws a pending proposal. Only the original proposer can cancel.
    ///
    /// The stored status becomes [`AdminProposalStatus::Cancelled`] (and the
    /// `proposal/canceled` event is emitted), which is intentionally distinct
    /// from [`AdminProposalStatus::Rejected`]: off-chain audit logs and the
    /// event stream must be able to tell a proposer cancellation apart from a
    /// proposal that was voted down. A `Rejected` proposal never executed; a
    /// `Cancelled` proposal was withdrawn before it could.
    pub fn cancel_proposal(env: Env, proposal_id: String, proposer: Address) {
        proposer.require_auth();

        let proposal_key = AdminMultisigDataKey::AdminProposal(proposal_id.clone());
        let mut proposal: AdminProposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .expect("Proposal not found");

        // Only the original proposer may withdraw it
        if proposal.proposer != proposer {
            panic!("Only proposer can cancel");
        }

        // Executed, expired, or already-cancelled proposals can't be cancelled
        if proposal.status != AdminProposalStatus::Pending {
            panic!("Proposal is not pending");
        }

        proposal.status = AdminProposalStatus::Cancelled;
        Self::set_persistent(&env, &proposal_key, &proposal);

        ProposalCanceledEvent {
            proposal_id,
            proposer,
        }
        .publish(&env);
    }

    /// Get a governance proposal.
    ///
    /// Proposal contents are sensitive governance data (pending upgrades, issuer
    /// removals, config changes), so reads are restricted to registered admin
    /// signers: the caller must authenticate and be present in the signer set.
    pub fn get_proposal(env: Env, proposal_id: String, caller: Address) -> AdminProposal {
        caller.require_auth();

        let config = Self::get_config(env.clone());
        Self::require_signer(&config.signers, &caller);

        env.storage()
            .persistent()
            .get(&AdminMultisigDataKey::AdminProposal(proposal_id))
            .expect("Proposal not found")
    }

    // Whether an issuer has been removed through governance (defaults to false).
    // Public and unauthenticated: this is a simple lookup flag
    pub fn is_issuer_removed(env: Env, issuer: Address) -> bool {
        env.storage()
            .persistent()
            .get(&AdminMultisigDataKey::RemovedIssuer(issuer))
            .unwrap_or(false)
    }

    // Alias for propose_action under the "admin action" naming,
    // kept for callers that use that name
    pub fn propose_admin_action(
        env: Env,
        proposal_id: String,
        proposer: Address,
        action: AdminAction,
    ) -> AdminProposal {
        Self::propose_action(env, proposal_id, proposer, action)
    }

    // Alias for approve_action under the "admin action" naming
    pub fn approve_admin_action(
        env: Env,
        proposal_id: String,
        approver: Address,
    ) -> AdminProposalStatus {
        Self::approve_action(env, proposal_id, approver)
    }

    // Set the address of the certificate contract that governance actions
    // (upgrade, remove issuer) are forwarded to. Any single signer can set this
    pub fn set_admin_certificate_contract(
        env: Env,
        signer: Address,
        certificate_contract: Address,
    ) {
        signer.require_auth();

        let config = Self::get_config(env.clone());
        Self::require_signer(&config.signers, &signer);

        Self::set_instance(
            &env,
            &AdminMultisigDataKey::CertificateContractId,
            &certificate_contract,
        );
    }

    // Read the configured certificate contract; panics if none has been set
    pub fn get_admin_certificate_contract(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&AdminMultisigDataKey::CertificateContractId)
            .expect("Certificate contract not configured")
    }

    // Run an approved proposal's action. Private: it is only reached through
    // approve_action once the threshold is met, never directly by callers
    fn execute_action(env: Env, proposal_id: String) -> AdminProposalStatus {
        let proposal_key = AdminMultisigDataKey::AdminProposal(proposal_id.clone());
        let mut proposal: AdminProposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .expect("Proposal not found");

        // Defensive check: only an Approved proposal may run
        if proposal.status != AdminProposalStatus::Approved {
            panic!("Proposal is not approved");
        }

        match &proposal.action {
            AdminAction::UpgradeContract(wasm_hash) => {
                let certificate_contract: Address = env
                    .storage()
                    .instance()
                    .get(&AdminMultisigDataKey::CertificateContractId)
                    .expect("Certificate contract not configured");

                // Cross-contract call: ask the certificate contract to upgrade itself
                let _: () = env.invoke_contract(
                    &certificate_contract,
                    &soroban_sdk::Symbol::new(&env, "upgrade"),
                    soroban_sdk::vec![&env, wasm_hash.clone().into_val(&env)],
                );
            }
            AdminAction::RemoveIssuer(issuer) => {
                // Record the removal locally first so is_issuer_removed reflects it
                Self::set_persistent(
                    &env,
                    &AdminMultisigDataKey::RemovedIssuer(issuer.clone()),
                    &true,
                );

                let certificate_contract: Address = env
                    .storage()
                    .instance()
                    .get(&AdminMultisigDataKey::CertificateContractId)
                    .expect("Certificate contract not configured");

                // Then tell the certificate contract to remove the issuer.
                // If this call fails, the whole transaction reverts, including
                // the local flag written above
                let _: () = env.invoke_contract(
                    &certificate_contract,
                    &soroban_sdk::Symbol::new(&env, "remove_issuer"),
                    soroban_sdk::vec![&env, issuer.clone().into_val(&env)],
                );
            }
            AdminAction::UpdateConfig(threshold, signers, proposal_window) => {
                // The new config must pass the same validation as the initial one
                Self::validate_config(signers, *threshold, *proposal_window);
                Self::set_instance(
                    &env,
                    &AdminMultisigDataKey::AdminConfig,
                    &AdminMultisigConfig {
                        threshold: *threshold,
                        signers: signers.clone(),
                        proposal_window: *proposal_window,
                    },
                );
            }
            AdminAction::Other(_) => {
                // Free-form actions have no implementation, so executing one
                // aborts the transaction. This means such a proposal can never
                // complete (the approval that reaches the threshold reverts)
                panic!("Unsupported action type");
            }
        }

        // Mark the proposal done and announce it
        proposal.status = AdminProposalStatus::Executed;
        Self::set_persistent(&env, &proposal_key, &proposal);
        ProposalExecutedEvent { proposal_id }.publish(&env);

        AdminProposalStatus::Executed
    }

    // Panics unless `signer` is in the configured signer set
    fn require_signer(signers: &Vec<Address>, signer: &Address) {
        if !signers.contains(signer) {
            panic!("Not an authorized admin signer");
        }
    }

    // Sanity-check a multisig configuration, used at init and on UpdateConfig
    fn validate_config(signers: &Vec<Address>, threshold: u32, proposal_window: u32) {
        // Need at least one signer, a non-zero threshold, and a threshold that
        // can actually be reached (not more than the number of signers).
        // The cast silences clippy, since len() is already u32 on this SDK version
        #[allow(clippy::unnecessary_cast)]
        if signers.is_empty() || threshold == 0 || threshold > signers.len() as u32 {
            panic!("Invalid admin multisig configuration");
        }

        // A zero window would make every proposal expire immediately
        if proposal_window == 0 {
            panic!("Proposal window must be greater than zero");
        }
    }
}

// Keys for the contract's storage entries
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AdminMultisigDataKey {
    // The AdminMultisigConfig (instance storage)
    AdminConfig,
    // One AdminProposal per proposal id (persistent storage)
    AdminProposal(String),
    // Address of the certificate contract that actions are forwarded to (instance storage)
    CertificateContractId,
    // Flag per removed issuer (persistent storage)
    RemovedIssuer(Address),
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    // A threshold larger than the number of signers could never be reached,
    // so init must reject it
    #[test]
    #[should_panic(expected = "Invalid admin multisig configuration")]
    fn test_init_rejects_threshold_above_signer_count() {
        // Fresh test environment, with the contract registered in it
        let env = Env::default();
        let contract_id = env.register(AdminMultisigContract, ());
        let client = AdminMultisigContractClient::new(&env, &contract_id);

        // Three randomly generated signer addresses
        let signers = soroban_sdk::vec![
            &env,
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ]; // 3 signers

        client.init_admin_multisig(&5u32, &signers, &100u32); // threshold 5 > 3 -> panics
    }
}