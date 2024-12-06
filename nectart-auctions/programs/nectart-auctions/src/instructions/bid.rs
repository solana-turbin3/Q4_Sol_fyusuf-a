use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};
use anchor_spl::token::Mint;

use crate::state::{Auction, VaultState};
use crate::errors::AuctionError;

#[derive(Accounts)]
pub struct Bid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
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
    /// The account of the preceding bidder. A check is made to ensure its public key is the right
    /// one.
    #[account(mut)]
    pub preceding_bidder: Option<AccountInfo<'info>>,
    pub system_program: Program<'info, System>,
}

impl<'info> Bid<'info> {
    pub fn bid(&mut self, lamports: u64) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        let time_elapsed = current_time - self.auction.start_time;
        require!(time_elapsed >= 0, AuctionError::AuctionNotStarted);
        require!(current_time < self.auction.deadline, AuctionError::AuctionEnded);
        let minimum = match self.auction.current_bid {
            Some(current_bid) => current_bid + self.auction.min_increment,
            None => self.auction.min_price,
        };
        require!(lamports > minimum, AuctionError::BidTooLow);
        require!(self.auction.current_bidder == self.preceding_bidder.clone().map(|x| x.key()), AuctionError::BadPrecedingBidder);
        if self.auction.current_bidder.is_some() {
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
                    to: self.preceding_bidder.clone().unwrap(),
                },
                signer_seeds,
            );
            let current_bid = self.auction.current_bid.unwrap();
            transfer(cpi_ctx, current_bid)?;
        }
        let cpi_ctx = CpiContext::new(
            self.system_program.to_account_info(),
            Transfer {
                from: self.bidder.to_account_info(),
                to: self.vault.to_account_info(),
            },
        );
        transfer(cpi_ctx, lamports)?;
        self.auction.current_bid = Some(lamports);
        self.auction.current_bidder = Some(*self.bidder.key);
        Ok(())
    }
}
