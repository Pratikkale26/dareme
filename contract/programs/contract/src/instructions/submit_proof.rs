use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::DareMeError;
use crate::state::*;

pub fn handler(ctx: Context<SubmitProof>, proof_hash: [u8; 32]) -> Result<()> {
    let dare = &mut ctx.accounts.dare;
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    require!(dare.deadline > now, DareMeError::DareExpired);
    require!(ctx.accounts.submitter.key() != dare.challenger, DareMeError::CannotAcceptOwnDare);

    match dare.dare_type {
        DareType::DirectDare => {
            require!(
                dare.status == DareStatus::Active || dare.status == DareStatus::Rejected,
                DareMeError::InvalidDareStatus
            );
            require!(
                dare.has_daree && ctx.accounts.submitter.key() == dare.daree,
                DareMeError::UnauthorizedDaree
            );
        }
        DareType::PublicBounty => {
            require!(
                dare.status == DareStatus::Created || dare.status == DareStatus::Rejected,
                DareMeError::InvalidDareStatus
            );
            // For PublicBounty, set the daree when proof is submitted
            dare.daree = ctx.accounts.submitter.key();
            dare.has_daree = true;
        }
    }

    dare.proof_hash = proof_hash;
    dare.has_proof = true;
    dare.status = DareStatus::ProofSubmitted;

    // Initialize submitter stats
    let stats = &mut ctx.accounts.submitter_stats;
    if stats.user == Pubkey::default() {
        stats.user = ctx.accounts.submitter.key();
        stats.bump = ctx.bumps.submitter_stats;
    }
    
    // For PublicBounty, also increment dares_accepted since they're accepting by submitting
    if dare.dare_type == DareType::PublicBounty {
        stats.dares_accepted += 1;
    }

    msg!("Proof submitted for dare {} by {}", dare.dare_id, ctx.accounts.submitter.key());
    Ok(())
}

#[derive(Accounts)]
pub struct SubmitProof<'info> {
    #[account(mut)]
    pub submitter: Signer<'info>,

    #[account(
        mut,
        seeds = [DARE_SEED, dare.challenger.as_ref(), &dare.dare_id.to_le_bytes()],
        bump = dare.bump,
    )]
    pub dare: Account<'info, Dare>,

    #[account(
        init_if_needed,
        payer = submitter,
        space = UserStats::SPACE,
        seeds = [USER_STATS_SEED, submitter.key().as_ref()],
        bump,
    )]
    pub submitter_stats: Account<'info, UserStats>,

    pub system_program: Program<'info, System>,
}
