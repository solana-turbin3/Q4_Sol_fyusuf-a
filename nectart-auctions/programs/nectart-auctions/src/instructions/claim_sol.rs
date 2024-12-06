use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};
use anchor_spl::token::Mint;

use crate::state::{Auction, VaultState};
use crate::errors::AuctionError;

#[derive(Accounts)]
pub struct ClaimSol<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"auction", mint.key().as_ref()],
        bump = auction.bump,
    )]
    pub auction: Account<'info, Auction>,
    #[account(
        mut,
        seeds = [b"vault", mint.key().as_ref()],
        bump = vault_state.vault_bump,
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump = vault_state.state_bump,
    )]
    pub vault_state: Account<'info, VaultState>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimSol<'info> {
    pub fn claim_sol(&mut self) -> Result<()> {
        let maker_key = self.signer.key();
        require!(maker_key == self.auction.maker, AuctionError::BadAccount);
        let current_time = Clock::get()?.unix_timestamp;
        require!(current_time >= self.auction.deadline, AuctionError::AuctionNotEnded);
        let current_bid = self.auction.current_bid.unwrap_or(0);
        if current_bid != 0 {
            let seeds = [
                b"vault",
                self.mint.to_account_info().key.as_ref(),
                &[self.vault_state.vault_bump],
            ];
            let signer_seeds = &[&seeds[..]];
            let cpi_ctx = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.vault.to_account_info(),
                    to: self.signer.to_account_info(),
                },
                signer_seeds
            );
            transfer(cpi_ctx, current_bid)?;
        }
        Ok(())
    }
}

