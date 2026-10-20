
use soroban_sdk::{Env, IntoVal, Val};

/// Default TTL: approximately 30 days at 5 seconds per ledger.
pub const DEFAULT_TTL: u32 = 518_400;

/// Renewal threshold: approximately 7 days at 5 seconds per ledger.
pub const TTL_RENEWAL_THRESHOLD: u32 = 120_960;

/// Returns a TTL duration capped at the environment's maximum TTL.
fn effective_ttl(env: &Env, ttl: Option<u32>) -> u32 {
    ttl.unwrap_or(DEFAULT_TTL)
        .min(env.storage().max_ttl())
}

/// Extends the TTL of a persistent storage entry.
///
/// Call this when writing or updating a persistent storage entry.
pub fn extend_ttl<K>(env: &Env, key: &K, ttl: Option<u32>)
where
    K: IntoVal<Env, Val>,
{
    let ttl_duration = effective_ttl(env, ttl);

    env.storage()
        .persistent()
        .extend_ttl(key, ttl_duration, ttl_duration);
}

/// Renews a persistent storage entry when its remaining TTL falls
/// below the renewal threshold.
pub fn bump_ttl_on_get<K>(env: &Env, key: &K)
where
    K: IntoVal<Env, Val>,
{
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_RENEWAL_THRESHOLD, DEFAULT_TTL.min(env.storage().max_ttl()));
}

/// Extends the TTL of the current contract instance.
///
/// Call this when updating instance storage.
pub fn extend_instance_ttl(env: &Env, ttl: Option<u32>) {
    let ttl_duration = effective_ttl(env, ttl);

    env.storage()
        .instance()
        .extend_ttl(ttl_duration, ttl_duration);
}
