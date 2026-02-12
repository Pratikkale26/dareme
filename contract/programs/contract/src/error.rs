use anchor_lang::prelude::*;

#[error_code]
pub enum DareMeError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Deadline must be in the future")]
    DeadlinePassed,
    #[msg("Deadline is too far in the future (max 30 days)")]
    DeadlineTooFar,
    #[msg("Dare is not in the expected status")]
    InvalidDareStatus,
    #[msg("You cannot accept your own dare")]
    CannotAcceptOwnDare,
    #[msg("Only the challenger can perform this action")]
    UnauthorizedChallenger,
    #[msg("Only the daree can perform this action")]
    UnauthorizedDaree,
    #[msg("The dare has expired")]
    DareExpired,
    #[msg("The dare has not expired yet")]
    DareNotExpired,
    #[msg("The dispute window has not passed yet")]
    DisputeWindowActive,
    #[msg("This dare type does not support this action")]
    InvalidDareType,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    #[msg("Daree stats account is required but missing")]
    MissingDareeStats,
    #[msg("This dare does not have a target daree to refuse")]
    NotTargetedDare,
}
