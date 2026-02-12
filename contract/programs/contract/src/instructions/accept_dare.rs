use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::DareMeError;
use crate::state::*;

pub fn handler(ctx: Context<AcceptDare>) -> Result<()> {
    let dare = &mut ctx.accounts.dare;
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    require!(dare.dare_type == DareType::DirectDare, DareMeError::InvalidDareType);
    require!(dare.status == DareStatus::Created, DareMeError::InvalidDareStatus);
    require!(ctx.accounts.daree.key() != dare.challenger, DareMeError::CannotAcceptOwnDare);
    require!(dare.deadline > now, DareMeError::DareExpired);

    // If dare has a target, only that person can accept
    if dare.has_daree {
        require!(
            ctx.accounts.daree.key() == dare.daree,
            DareMeError::UnauthorizedDaree
        );
    }

    dare.daree = ctx.accounts.daree.key();
    dare.has_daree = true;
    dare.status = DareStatus::Active;
    dare.accepted_at = now;

    let stats = &mut ctx.accounts.daree_stats;
    if stats.user == Pubkey::default() {
        stats.user = ctx.accounts.daree.key();
        stats.bump = ctx.bumps.daree_stats;
    }
    stats.dares_accepted += 1;

    msg!("Dare accepted by: {}", ctx.accounts.daree.key());
    Ok(())
}

#[derive(Accounts)]
pub struct AcceptDare<'info> {
    #[account(mut)]
    pub daree: Signer<'info>,

    #[account(
        mut,
        seeds = [DARE_SEED, dare.challenger.as_ref(), &dare.dare_id.to_le_bytes()],
        bump = dare.bump,
    )]
    pub dare: Account<'info, Dare>,

    #[account(
        init_if_needed,
        payer = daree,
        space = UserStats::SPACE,
        seeds = [USER_STATS_SEED, daree.key().as_ref()],
        bump,
    )]
    pub daree_stats: Account<'info, UserStats>,

    pub system_program: Program<'info, System>,
}
