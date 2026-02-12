use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::DareMeError;
use crate::state::*;

pub fn handler(ctx: Context<RejectDare>) -> Result<()> {
    let dare = &mut ctx.accounts.dare;

    require!(dare.status == DareStatus::ProofSubmitted, DareMeError::InvalidDareStatus);

    dare.status = DareStatus::Rejected;
    dare.proof_hash = [0u8; 32];
    dare.has_proof = false;

    msg!("Dare {} proof rejected. Daree can re-submit.", dare.dare_id);
    Ok(())
}

#[derive(Accounts)]
pub struct RejectDare<'info> {
    pub challenger: Signer<'info>,

    #[account(
        mut,
        seeds = [DARE_SEED, dare.challenger.as_ref(), &dare.dare_id.to_le_bytes()],
        bump = dare.bump,
        has_one = challenger,
    )]
    pub dare: Account<'info, Dare>,
}
