use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::error::DareMeError;
use crate::state::*;

pub fn handler(
    ctx: Context<CreateDare>,
    dare_id: u64,
    description_hash: [u8; 32],
    amount: u64,
    deadline: i64,
    dare_type: DareType,
    winner_selection: WinnerSelection,
    target_daree: Pubkey,
) -> Result<()> {
    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    require!(amount > 0, DareMeError::InvalidAmount);
    require!(deadline > now, DareMeError::DeadlinePassed);
    require!(deadline <= now + MAX_DEADLINE_DURATION, DareMeError::DeadlineTooFar);

    // If a target is specified, it can't be the challenger themselves
    let has_target = target_daree != Pubkey::default();
    if has_target {
        require!(target_daree != ctx.accounts.challenger.key(), DareMeError::CannotAcceptOwnDare);
    }

    let dare = &mut ctx.accounts.dare;
    dare.challenger = ctx.accounts.challenger.key();
    dare.dare_id = dare_id;
    dare.description_hash = description_hash;
    dare.amount = amount;
    dare.status = DareStatus::Created;
    dare.dare_type = dare_type;
    dare.winner_selection = winner_selection;
    dare.proof_hash = [0u8; 32];
    dare.has_proof = false;
    dare.created_at = now;
    dare.deadline = deadline;
    dare.accepted_at = 0;
    dare.completed_at = 0;
    dare.bump = ctx.bumps.dare;
    dare.vault_bump = ctx.bumps.vault;

    // Set target daree if specified (for targeted DirectDares)
    if has_target {
        dare.daree = target_daree;
        dare.has_daree = true;
    } else {
        dare.daree = Pubkey::default();
        dare.has_daree = false;
    }

    // Transfer SOL from challenger to vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update challenger stats
    let stats = &mut ctx.accounts.challenger_stats;
    if stats.user == Pubkey::default() {
        stats.user = ctx.accounts.challenger.key();
        stats.bump = ctx.bumps.challenger_stats;
    }
    stats.dares_created += 1;
    stats.total_spent = stats.total_spent.checked_add(amount).ok_or(DareMeError::ArithmeticOverflow)?;

    msg!("Dare created: id={}, amount={}, type={:?}, target={}", dare_id, amount, dare_type, target_daree);
    Ok(())
}

#[derive(Accounts)]
#[instruction(dare_id: u64)]
pub struct CreateDare<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        init,
        payer = challenger,
        space = Dare::SPACE,
        seeds = [DARE_SEED, challenger.key().as_ref(), &dare_id.to_le_bytes()],
        bump,
    )]
    pub dare: Account<'info, Dare>,

    /// CHECK: Vault PDA — just receives SOL, no data. Validated by seeds.
    #[account(
        mut,
        seeds = [VAULT_SEED, dare.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = challenger,
        space = UserStats::SPACE,
        seeds = [USER_STATS_SEED, challenger.key().as_ref()],
        bump,
    )]
    pub challenger_stats: Account<'info, UserStats>,

    pub system_program: Program<'info, System>,
}
