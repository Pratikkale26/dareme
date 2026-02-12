use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::error::DareMeError;
use crate::state::*;

/// Targeted daree refuses a DirectDare, triggering a refund to challenger.
/// Only works on dares where has_daree=true (targeted) and status=Created.
pub fn handler(ctx: Context<RefuseDare>) -> Result<()> {
    // Capture values before mutable borrow
    let dare_key = ctx.accounts.dare.key();
    let vault_bump = ctx.accounts.dare.vault_bump;
    let dare_amount = ctx.accounts.dare.amount;
    let dare_id = ctx.accounts.dare.dare_id;

    let dare = &mut ctx.accounts.dare;

    // Must be a DirectDare (PublicBounty doesn't target anyone)
    require!(dare.dare_type == DareType::DirectDare, DareMeError::InvalidDareType);
    // Must still be in Created status (not yet accepted/active)
    require!(dare.status == DareStatus::Created, DareMeError::InvalidDareStatus);
    // Must have a target daree set
    require!(dare.has_daree, DareMeError::NotTargetedDare);
    // Signer must be the targeted daree
    require!(
        ctx.accounts.daree.key() == dare.daree,
        DareMeError::UnauthorizedDaree
    );

    dare.status = DareStatus::Refused;

    // Refund SOL from vault to challenger
    let vault_seeds: &[&[u8]] = &[VAULT_SEED, dare_key.as_ref(), &[vault_bump]];
    let vault_lamports = ctx.accounts.vault.lamports();

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.challenger.to_account_info(),
            },
            &[vault_seeds],
        ),
        vault_lamports,
    )?;

    // Update challenger stats (refund the spent amount)
    let stats = &mut ctx.accounts.challenger_stats;
    stats.total_spent = stats.total_spent.saturating_sub(dare_amount);

    msg!("Dare {} refused by {}. {} lamports refunded to challenger.", dare_id, ctx.accounts.daree.key(), vault_lamports);
    Ok(())
}

#[derive(Accounts)]
pub struct RefuseDare<'info> {
    /// The targeted daree who is refusing the dare
    #[account(mut)]
    pub daree: Signer<'info>,

    #[account(
        mut,
        seeds = [DARE_SEED, dare.challenger.as_ref(), &dare.dare_id.to_le_bytes()],
        bump = dare.bump,
    )]
    pub dare: Account<'info, Dare>,

    /// CHECK: Vault PDA validated by seeds
    #[account(
        mut,
        seeds = [VAULT_SEED, dare.key().as_ref()],
        bump = dare.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: The challenger who gets the refund — validated via has_one
    #[account(
        mut,
        constraint = challenger.key() == dare.challenger @ DareMeError::UnauthorizedChallenger,
    )]
    pub challenger: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [USER_STATS_SEED, dare.challenger.as_ref()],
        bump = challenger_stats.bump,
    )]
    pub challenger_stats: Account<'info, UserStats>,

    pub system_program: Program<'info, System>,
}
