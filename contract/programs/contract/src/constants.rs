pub const DARE_SEED: &[u8] = b"dare";
pub const VAULT_SEED: &[u8] = b"vault";
pub const USER_STATS_SEED: &[u8] = b"user_stats";

/// Maximum deadline duration: 30 days in seconds
pub const MAX_DEADLINE_DURATION: i64 = 30 * 24 * 60 * 60;

/// Dispute window: 72 hours
/// After proof is submitted, challenger has 72h to approve/reject.
/// If no action, anyone can call expire_dare to auto-release funds to daree.
pub const DISPUTE_WINDOW: i64 = 72 * 60 * 60;
