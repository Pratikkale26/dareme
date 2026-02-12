use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::error::DareMeError;
use crate::state::*;

pub fn handler(ctx: Context<ExpireDare>) -> Result<()> {
    // Capture values before mutable borrow
    let dare_key = ctx.accounts.dare.key();
    let vault_bump = ctx.accounts.dare.vault_bump;
    let dare_amount = ctx.accounts.dare.amount;
    let dare_id = ctx.accounts.dare.dare_id;

    let dare = &mut ctx.accounts.dare;
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    match dare.status {
        DareStatus::Created | DareStatus::Active | DareStatus::Rejected => {
            require!(now > dare.deadline, DareMeError::DareNotExpired);

            dare.status = DareStatus::Expired;

            // Verify recipient is the challenger (refund)
            require!(
                ctx.accounts.recipient.key() == dare.challenger,
                DareMeError::UnauthorizedChallenger
            );

            // Refund SOL from vault to challenger using CPI with PDA signer
            let vault_seeds: &[&[u8]] = &[VAULT_SEED, dare_key.as_ref(), &[vault_bump]];
            let vault_lamports = ctx.accounts.vault.lamports();

            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.recipient.to_account_info(),
                    },
                    &[vault_seeds],
                ),
                vault_lamports,
            )?;

            // Update challenger stats (refund)
            let challenger_stats = &mut ctx.accounts.challenger_stats;
            challenger_stats.total_spent = challenger_stats.total_spent.saturating_sub(dare_amount);

            // Update daree stats if daree exists (they failed)
            if dare.has_daree {
                require!(
                    ctx.accounts.daree_stats.is_some(),
                    DareMeError::MissingDareeStats
                );
                if let Some(daree_stats) = &mut ctx.accounts.daree_stats {
                    daree_stats.dares_failed += 1;
                }
            }

            msg!("Dare {} expired. {} lamports refunded to challenger.", dare_id, vault_lamports);
        }

        DareStatus::ProofSubmitted => {
            require!(
                now > dare.deadline + DISPUTE_WINDOW,
                DareMeError::DisputeWindowActive
            );

            // Verify recipient is the daree (auto-approve)
            require!(
                dare.has_daree && ctx.accounts.recipient.key() == dare.daree,
                DareMeError::UnauthorizedDaree
            );

            dare.status = DareStatus::Completed;
            dare.completed_at = now;

            // Release SOL from vault to daree using CPI with PDA signer
            let vault_seeds: &[&[u8]] = &[VAULT_SEED, dare_key.as_ref(), &[vault_bump]];
            let vault_lamports = ctx.accounts.vault.lamports();

            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.recipient.to_account_info(),
                    },
                    &[vault_seeds],
                ),
                vault_lamports,
            )?;

            // Update daree stats (they completed it)
            require!(
                ctx.accounts.daree_stats.is_some(),
                DareMeError::MissingDareeStats
            );
            if let Some(daree_stats) = &mut ctx.accounts.daree_stats {
                daree_stats.dares_completed += 1;
                daree_stats.total_earned = daree_stats.total_earned
                    .checked_add(dare_amount)
                    .ok_or(DareMeError::ArithmeticOverflow)?;
            }

            msg!("Dare {} auto-approved. {} lamports released to daree.", dare_id, vault_lamports);
        }

        _ => {
            return Err(DareMeError::InvalidDareStatus.into());
        }
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ExpireDare<'info> {
    /// Anyone can call this (permissionless crank)
    #[account(mut)]
    pub payer: Signer<'info>,

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

    /// CHECK: Must be challenger (refund) or daree (auto-approve) — validated in handler
    #[account(mut)]
    pub recipient: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [USER_STATS_SEED, dare.challenger.as_ref()],
        bump = challenger_stats.bump,
    )]
    pub challenger_stats: Account<'info, UserStats>,

    /// Optional: only needed when dare has a daree
    #[account(
        mut,
        seeds = [USER_STATS_SEED, dare.daree.as_ref()],
        bump,
    )]
    pub daree_stats: Option<Account<'info, UserStats>>,

    pub system_program: Program<'info, System>,
}
