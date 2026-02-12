use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::error::DareMeError;
use crate::state::*;

pub fn handler(ctx: Context<CancelDare>) -> Result<()> {
    // Capture values before mutable borrow
    let dare_key = ctx.accounts.dare.key();
    let vault_bump = ctx.accounts.dare.vault_bump;
    let dare_amount = ctx.accounts.dare.amount;
    let dare_id = ctx.accounts.dare.dare_id;

    let dare = &mut ctx.accounts.dare;
    require!(dare.status == DareStatus::Created, DareMeError::InvalidDareStatus);
    dare.status = DareStatus::Cancelled;

    // Refund SOL from vault to challenger using CPI with PDA signer
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

    // Update stats
    let stats = &mut ctx.accounts.challenger_stats;
    stats.total_spent = stats.total_spent.saturating_sub(dare_amount);

    msg!("Dare {} cancelled. {} lamports refunded.", dare_id, vault_lamports);
    Ok(())
}

#[derive(Accounts)]
pub struct CancelDare<'info> {
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

    #[account(
        mut,
        seeds = [USER_STATS_SEED, challenger.key().as_ref()],
        bump = challenger_stats.bump,
    )]
    pub challenger_stats: Account<'info, UserStats>,

    pub system_program: Program<'info, System>,
}
