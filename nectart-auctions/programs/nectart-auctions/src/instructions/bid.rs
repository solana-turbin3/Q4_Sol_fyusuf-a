use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};
use anchor_spl::token::Mint;

use crate::state::{Auction, Vault};
use crate::errors::AuctionError;

#[derive(Accounts)]
pub struct Bid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,
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
    /// The account of the preceding bidder. A check is made to ensure its public key is the right
    /// one.
    pub preceding_bidder: Option<AccountInfo<'info>>,
    pub system_program: Program<'info, System>,
}

impl<'info> Bid<'info> {
    pub fn bid(&mut self, lamports: u64) -> Result<()> {
        let time_elapsed = Clock::get()?.unix_timestamp - self.auction.start_time;
        require!(time_elapsed >= 0, AuctionError::AuctionNotStarted);
        require!(time_elapsed < self.auction.deadline, AuctionError::AuctionEnded);
        let minimum = match self.auction.current_bid {
            Some(current_bid) => current_bid + self.auction.min_increment.unwrap_or(0),
            None => self.auction.min_price,
        };
        require!(lamports > minimum, AuctionError::BidTooLow);
        require!(self.auction.current_bidder == self.preceding_bidder.clone().map(|x| x.key()), AuctionError::BadPrecedingBidder);
        if self.auction.current_bidder.is_some() {
            let cpi_ctx = CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.auction_vault.to_account_info(),
                    to: self.preceding_bidder.clone().unwrap(),
                },
            );
            let current_bid = self.auction.current_bid.unwrap();
            transfer(cpi_ctx, current_bid)?;
            let cpi_ctx = CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.bidder.to_account_info(),
                    to: self.auction_vault.to_account_info(),
                },
            );
            transfer(cpi_ctx, lamports)?;
        }
        self.auction.current_bid = Some(lamports);
        self.auction.current_bidder = Some(*self.bidder.key);
        Ok(())
    }
}
