use anchor_lang::prelude::*;

declare_id!("GPsjvXc4SHaSuTsYcdJdpXfHkwbyHZC6Vd8HLiqgikg6");

/// AtopyPass on-chain program (stretch goal beyond Memo-only MVP).
/// Stores non-sensitive proof/consent events on-chain.
/// NO personal health info is ever stored here.

#[program]
pub mod atopypass {
    use super::*;

    /// Commit a record hash on-chain (proof of existence).
    pub fn commit_record(ctx: Context<CommitRecord>, record_hash: [u8; 32]) -> Result<()> {
        let record = &mut ctx.accounts.record_account;
        record.owner = ctx.accounts.owner.key();
        record.record_hash = record_hash;
        record.timestamp = Clock::get()?.unix_timestamp;
        msg!("AP1|RECORD committed: {:?}", record_hash);
        Ok(())
    }

    /// Grant a doctor access to a record (consent).
    pub fn grant_consent(
        ctx: Context<GrantConsent>,
        record_hash: [u8; 32],
        doctor: Pubkey,
        expiry_ts: i64,
    ) -> Result<()> {
        let consent = &mut ctx.accounts.consent_account;
        consent.owner = ctx.accounts.owner.key();
        consent.record_hash = record_hash;
        consent.doctor = doctor;
        consent.expiry_ts = expiry_ts;
        consent.revoked = false;
        msg!("AP1|GRANT: doctor={}, expiry={}", doctor, expiry_ts);
        Ok(())
    }

    /// Revoke a doctor's access to a record.
    pub fn revoke_consent(ctx: Context<RevokeConsent>) -> Result<()> {
        let consent = &mut ctx.accounts.consent_account;
        require!(!consent.revoked, AtopyPassError::AlreadyRevoked);
        require!(consent.owner == ctx.accounts.owner.key(), AtopyPassError::Unauthorized);
        consent.revoked = true;
        msg!("AP1|REVOKE: doctor={}", consent.doctor);
        Ok(())
    }
}

// ── Accounts ──

#[derive(Accounts)]
#[instruction(record_hash: [u8; 32])]
pub struct CommitRecord<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + RecordAccount::INIT_SPACE,
        seeds = [b"record", owner.key().as_ref(), &record_hash],
        bump,
    )]
    pub record_account: Account<'info, RecordAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(record_hash: [u8; 32], doctor: Pubkey)]
pub struct GrantConsent<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + ConsentAccount::INIT_SPACE,
        seeds = [b"consent", owner.key().as_ref(), &record_hash, doctor.as_ref()],
        bump,
    )]
    pub consent_account: Account<'info, ConsentAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeConsent<'info> {
    #[account(
        mut,
        has_one = owner,
    )]
    pub consent_account: Account<'info, ConsentAccount>,
    pub owner: Signer<'info>,
}

// ── State ──

#[account]
#[derive(InitSpace)]
pub struct RecordAccount {
    pub owner: Pubkey,         // 32
    pub record_hash: [u8; 32], // 32
    pub timestamp: i64,        // 8
}

#[account]
#[derive(InitSpace)]
pub struct ConsentAccount {
    pub owner: Pubkey,         // 32
    pub record_hash: [u8; 32], // 32
    pub doctor: Pubkey,        // 32
    pub expiry_ts: i64,        // 8
    pub revoked: bool,         // 1
}

// ── Errors ──

#[error_code]
pub enum AtopyPassError {
    #[msg("Consent already revoked")]
    AlreadyRevoked,
    #[msg("Unauthorized")]
    Unauthorized,
}
