use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};
use anchor_spl::token::Mint;

use crate::state::{Auction, Vault};
use crate::errors::AuctionError;

#[derive(Accounts)]
pub struct ClaimSol<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"auction", mint.key().as_ref()],
        bump = auction.bump,
    )]
    pub auction: Account<'info, Auction>,
    #[account(
        seeds = [b"vault", mint.key().as_ref()],
        bump = auction_vault.bump,
    )]
    pub auction_vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimSol<'info> {
    pub fn claim_sol(&mut self) -> Result<()> {
        let maker_key = self.maker.key();
        require!(maker_key == self.auction.maker, AuctionError::NotMaker);
        let time_elapsed = Clock::get()?.unix_timestamp - self.auction.start_time;
        require!(time_elapsed >= self.auction.deadline, AuctionError::AuctionNotEnded);
        let current_bid = self.auction.current_bid.unwrap_or(0);
        if current_bid != 0 {
            let cpi_ctx = CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.auction_vault.to_account_info(),
                    to: self.maker.to_account_info(),
                },
            );
            transfer(cpi_ctx, current_bid)?;
        }
        Ok(())
    }
}

