use anchor_lang::prelude::*;

// ============================================================================
// Enums
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DareStatus {
    Created,
    Active,
    ProofSubmitted,
    Completed,
    Expired,
    Cancelled,
    Rejected,
    Refused,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum DareType {
    DirectDare,
    PublicBounty,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum WinnerSelection {
    ChallengerSelect,
    CommunityVote,
}

// ============================================================================
// Accounts
// ============================================================================

/// Main Dare account — stores all dare metadata and state on-chain
/// Seeds: ["dare", challenger.key(), dare_id.to_le_bytes()]
#[account]
pub struct Dare {
    pub challenger: Pubkey,           // 32
    pub daree: Pubkey,                // 32
    pub has_daree: bool,              // 1
    pub dare_id: u64,                 // 8
    pub description_hash: [u8; 32],   // 32
    pub amount: u64,                  // 8
    pub status: DareStatus,           // 1
    pub dare_type: DareType,          // 1
    pub winner_selection: WinnerSelection, // 1
    pub proof_hash: [u8; 32],         // 32
    pub has_proof: bool,              // 1
    pub created_at: i64,              // 8
    pub deadline: i64,                // 8
    pub accepted_at: i64,             // 8
    pub completed_at: i64,            // 8
    pub bump: u8,                     // 1
    pub vault_bump: u8,               // 1
}

impl Dare {
    // 8 (discriminator) + 183 fields = 191
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 8 + 32 + 8 + 1 + 1 + 1 + 32 + 1 + 8 + 8 + 8 + 8 + 1 + 1;
}

/// Per-user reputation stats
/// Seeds: ["user_stats", user.key()]
#[account]
pub struct UserStats {
    pub user: Pubkey,                 // 32
    pub dares_created: u32,           // 4
    pub dares_accepted: u32,          // 4
    pub dares_completed: u32,         // 4
    pub dares_failed: u32,            // 4
    pub total_earned: u64,            // 8
    pub total_spent: u64,             // 8
    pub bump: u8,                     // 1
}

impl UserStats {
    // 8 (discriminator) + 65 fields = 73
    pub const SPACE: usize = 8 + 32 + 4 + 4 + 4 + 4 + 8 + 8 + 1;
}
