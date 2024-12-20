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
        Mint, revoke, Revoke, Token, TokenAccount, transfer, Transfer
    },
    associated_token::AssociatedToken,
};

use crate::state::{Auction, VaultState};
use crate::errors::AuctionError;

#[derive(Accounts)]
pub struct ClaimNFT<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub signer_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub auctioneer: SystemAccount<'info>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = auctioneer,
    )]
    pub auctioneer_ata: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
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
        mut,
        seeds = [b"auction", mint.key().as_ref()],
        bump = auction.bump,
    )]
    pub auction: Account<'info, Auction>,
    #[account(
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
    pub token_program: Program<'info, Token>,
    pub metadata_program: Program<'info, Metadata>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> ClaimNFT<'info> {
    pub fn claim_nft(&mut self) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        require!(current_time >= self.auction.deadline, AuctionError::AuctionNotEnded);
        match self.auction.current_bidder {
            Some(bidder) => {
                require!(
                    self.signer.to_account_info().key() == bidder,
                    AuctionError::BadAccount,
                );
            }
            None => {
                require!(
                    self.signer.to_account_info().key() == self.auction.maker,
                    AuctionError::BadAccount,
                );
            }
        }

        let seeds = &[
            b"auction",
            self.mint.to_account_info().key.as_ref(),
            &[self.auction.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let delegate = &self.auction.to_account_info();
        let token_account = &self.auctioneer_ata.to_account_info();
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

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            Transfer {
                from: self.auctioneer_ata.to_account_info(),
                to: self.signer_ata.to_account_info(),
                authority: self.auction.to_account_info(),
            },
            signer_seeds
        );
        transfer(cpi_ctx, 1)?;

        // exceeds compute budget
        //let cpi_ctx = CpiContext::new(
            //self.token_program.to_account_info(),
            //Revoke {
                //source: self.auctioneer_ata.to_account_info(),
                //authority: self.signer.to_account_info(),
            //},
        //);
        //revoke(cpi_ctx)?;

        Ok(())
    }
}

