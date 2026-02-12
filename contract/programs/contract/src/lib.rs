use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;
use state::*;

declare_id!("8Vg3ximsFxoaEveSLQNe49i8tkSaeNubnxa54ypwXiD8");

#[program]
pub mod contract {
    use super::*;

    /// Create a new dare with SOL escrow
    /// `target_daree` — set to Pubkey::default() for open dares, or a specific pubkey for targeted DirectDares
    pub fn create_dare(
        ctx: Context<CreateDare>,
        dare_id: u64,
        description_hash: [u8; 32],
        amount: u64,
        deadline: i64,
        dare_type: DareType,
        winner_selection: WinnerSelection,
        target_daree: Pubkey,
    ) -> Result<()> {
        instructions::create_dare::handler(ctx, dare_id, description_hash, amount, deadline, dare_type, winner_selection, target_daree)
    }

    /// Accept a P2P dare (DirectDare only)
    pub fn accept_dare(ctx: Context<AcceptDare>) -> Result<()> {
        instructions::accept_dare::handler(ctx)
    }

    /// Submit proof for a dare
    pub fn submit_proof(ctx: Context<SubmitProof>, proof_hash: [u8; 32]) -> Result<()> {
        instructions::submit_proof::handler(ctx, proof_hash)
    }

    /// Challenger approves proof and releases escrow to daree
    pub fn approve_dare(ctx: Context<ApproveDare>) -> Result<()> {
        instructions::approve_dare::handler(ctx)
    }

    /// Challenger rejects proof (daree can re-submit)
    pub fn reject_dare(ctx: Context<RejectDare>) -> Result<()> {
        instructions::reject_dare::handler(ctx)
    }

    /// Challenger cancels dare before acceptance (refund)
    pub fn cancel_dare(ctx: Context<CancelDare>) -> Result<()> {
        instructions::cancel_dare::handler(ctx)
    }

    /// Permissionless crank: handle expired dares
    pub fn expire_dare(ctx: Context<ExpireDare>) -> Result<()> {
        instructions::expire_dare::handler(ctx)
    }

    /// Targeted daree refuses a DirectDare (refund to challenger)
    pub fn refuse_dare(ctx: Context<RefuseDare>) -> Result<()> {
        instructions::refuse_dare::handler(ctx)
    }
}