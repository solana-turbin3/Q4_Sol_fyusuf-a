use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{
        mpl_token_metadata::instructions::{
            ThawDelegatedAccountCpi, ThawDelegatedAccountCpiAccounts
        }, 
        MasterEditionAccount, 
        Metadata
    }, 
    token::{
        Mint, revoke, Revoke, Token, TokenAccount
    }
};

use crate::state::{Auction, Vault};
use crate::errors::AuctionError;

#[derive(Accounts)]
pub struct ClaimNFT<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub mint_ata: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            mint.key().as_ref(),
            b"edition",
        ],
        seeds::program = metadata_program.key(),
        bump
    )]
    pub edition: Account<'info, MasterEditionAccount>,
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
    pub token_program: Program<'info, Token>,
    pub metadata_program: Program<'info, Metadata>,
}

impl<'info> ClaimNFT<'info> {
    pub fn claim_nft(&mut self) -> Result<()> {
        let time_elapsed = Clock::get()?.unix_timestamp - self.auction.start_time;
        require!(time_elapsed >= self.auction.deadline, AuctionError::AuctionNotEnded);
        match self.auction.current_bidder {
            Some(bidder) => {
                require!(
                    self.signer.to_account_info().key() == bidder,
                    AuctionError::BadSigner,
                );
            }
            None => {
                require!(
                    self.signer.to_account_info().key() == self.auction.maker,
                    AuctionError::BadSigner,
                );
            }
        }

        let seeds = &[
            b"auction",
            self.mint.to_account_info().key.as_ref(),
        ];
        let signer_seeds = &[&seeds[..]];
        let delegate = &self.auction.to_account_info();
        let token_account = &self.mint_ata.to_account_info();
        let edition = &self.edition.to_account_info();
        let mint = &self.mint.to_account_info();
        let token_program = &self.token_program.to_account_info();
        let metadata_program = &self.metadata_program.to_account_info();
        ThawDelegatedAccountCpi::new(
            metadata_program,
            ThawDelegatedAccountCpiAccounts {
                delegate,
                token_account,
                edition,
                mint,
                token_program,
            },
        ).invoke_signed(signer_seeds)?;

        let cpi_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            Revoke {
                source: self.mint_ata.to_account_info(),
                authority: self.signer.to_account_info(),
            },
        );
        revoke(cpi_ctx)?;
        Ok(())
    }
}

