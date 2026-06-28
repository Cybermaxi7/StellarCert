use soroban_sdk::{Env, IntoVal, Val};

/// Default TTL duration (example: 30 days in ledger blocks)
pub const DEFAULT_TTL: u32 = 30 * 24 * 60 * 60; // adjust based on your block time

/// Extend TTL for a given persistent storage key
pub fn extend_ttl<K>(env: &Env, key: &K, ttl: Option<u32>)
where
    K: IntoVal<Env, Val>,
{
    let ttl_duration = ttl.unwrap_or(DEFAULT_TTL).min(env.storage().max_ttl());
    env.storage()
        .persistent()
        .extend_ttl(key, ttl_duration, ttl_duration);
}

/// Extend TTL for the current contract instance and code.
pub fn extend_instance_ttl(env: &Env, ttl: Option<u32>) {
    let ttl_duration = ttl.unwrap_or(DEFAULT_TTL).min(env.storage().max_ttl());
    env.storage()
        .instance()
        .extend_ttl(ttl_duration, ttl_duration);
}
