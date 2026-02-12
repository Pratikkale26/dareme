use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::error::DareMeError;
use crate::state::*;

pub fn handler(ctx: Context<ApproveDare>) -> Result<()> {
    // Capture values before mutable borrow
    let dare_key = ctx.accounts.dare.key();
    let vault_bump = ctx.accounts.dare.vault_bump;
    let dare_amount = ctx.accounts.dare.amount;
    let dare_id = ctx.accounts.dare.dare_id;

    let dare = &mut ctx.accounts.dare;
    require!(dare.status == DareStatus::ProofSubmitted, DareMeError::InvalidDareStatus);

    let clock = Clock::get()?;
    dare.status = DareStatus::Completed;
    dare.completed_at = clock.unix_timestamp;

    // Transfer all SOL from vault to daree using CPI with PDA signer
    let vault_seeds: &[&[u8]] = &[VAULT_SEED, dare_key.as_ref(), &[vault_bump]];
    let vault_lamports = ctx.accounts.vault.lamports();

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.daree.to_account_info(),
            },
            &[vault_seeds],
        ),
        vault_lamports,
    )?;

    // Update daree stats
    let daree_stats = &mut ctx.accounts.daree_stats;
    daree_stats.dares_completed += 1;
    daree_stats.total_earned = daree_stats.total_earned
        .checked_add(dare_amount)
        .ok_or(DareMeError::ArithmeticOverflow)?;

    msg!("Dare {} approved! {} lamports released.", dare_id, vault_lamports);
    Ok(())
}

#[derive(Accounts)]
pub struct ApproveDare<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        mut,
        seeds = [DARE_SEED, dare.challenger.as_ref(), &dare.dare_id.to_le_bytes()],
        bump = dare.bump,
        has_one = challenger,
    )]
    pub dare: Account<'info, Dare>,

    /// CHECK: Vault PDA validated by seeds
    #[account(
        mut,
        seeds = [VAULT_SEED, dare.key().as_ref()],
        bump = dare.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// CHECK: Must be the daree stored in the dare account
    #[account(
        mut,
        constraint = dare.has_daree && daree.key() == dare.daree @ DareMeError::UnauthorizedDaree,
    )]
    pub daree: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [USER_STATS_SEED, daree.key().as_ref()],
        bump = daree_stats.bump,
    )]
    pub daree_stats: Account<'info, UserStats>,

    pub system_program: Program<'info, System>,
}
