use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};
use anchor_spl::{
    metadata::{
        mpl_token_metadata::instructions::{
            FreezeDelegatedAccountCpi, FreezeDelegatedAccountCpiAccounts
        }, 
        MasterEditionAccount, 
        Metadata
    }, 
    token::{
        Mint, Token, TokenAccount
    }
};

use crate::state::{Auction, Vault};

#[error_code]
enum BidError {
    #[msg("Auction has not started")]
    AuctionNotStarted,
    #[msg("Auction has ended")]
    AuctionEnded,
    #[msg("Bid is too low")]
    BidTooLow,
    #[msg("Preceding bidder is incorrect")]
    NotPrecedingBidder,
}

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
    pub preceding_bidder: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Bid<'info> {
    pub fn bid(&mut self, lamports: u64) -> Result<()> {
        let time_elapsed = Clock::get()?.unix_timestamp - self.auction.start_time;
        require!(time_elapsed >= 0, BidError::AuctionNotStarted);
        require!(time_elapsed < self.auction.deadline, BidError::AuctionEnded);
        let current_bid = self.auction.current_bid.unwrap_or(0);
        let min_increment = self.auction.min_increment.unwrap_or(0);
        require!(lamports > current_bid + min_increment, BidError::BidTooLow);
        
        if self.auction.current_bidder.is_some() {
            require!(
                self.auction.current_bidder.unwrap() != self.preceding_bidder.key(),
                BidError::BidTooLow,
            );
            let cpi_ctx = CpiContext::new(
                self.system_program.to_account_info(),
                Transfer {
                    from: self.auction_vault.to_account_info(),
                    to: self.preceding_bidder.to_account_info(),
                },
            );
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

