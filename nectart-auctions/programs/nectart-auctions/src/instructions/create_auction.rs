use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{
        mpl_token_metadata::instructions::{
            FreezeDelegatedAccountCpi, FreezeDelegatedAccountCpiAccounts
        }, 
        MasterEditionAccount, 
        Metadata,
        MetadataAccount
    }, 
    token::{
        approve, Approve, Mint, Token, TokenAccount
    }
};

use crate::state::{Auction, Vault};

#[derive(Accounts)]
pub struct CreateAuction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    pub collection_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub mint_ata: Account<'info, TokenAccount>,
    #[account(
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            mint.key().as_ref(),
        ],
        seeds::program = metadata_program.key(),
        bump,
        constraint = metadata.collection.as_ref().unwrap().key.as_ref() == collection_mint.key().as_ref(),
        constraint = metadata.collection.as_ref().unwrap().verified == true,
    )]
    pub metadata: Account<'info, MetadataAccount>,
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
        init,
        payer = payer,
        seeds = [b"auction", mint.key().as_ref()],
        space = 8 + Auction::INIT_SPACE,
        bump,
    )]
    pub auction: Account<'info, Auction>,
    #[account(
        init,
        payer = payer,
        seeds = [b"vault", mint.key().as_ref()],
        space = 8 + Vault::INIT_SPACE,
        bump,
    )]
    pub auction_vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub metadata_program: Program<'info, Metadata>,
}

impl<'info> CreateAuction<'info> {
    pub fn approve(&mut self) -> Result<()> {
        let cpi_ctx  = CpiContext::new(
            self.token_program.to_account_info(),
            Approve {
                to: self.mint_ata.to_account_info(),
                delegate: self.auction.to_account_info(),
                authority: self.payer.to_account_info(),
            },
        );
        approve(cpi_ctx, 1)?;
        Ok(())
    }

    pub fn freeze(&mut self) -> Result<()> {
        let delegate = &self.auction.to_account_info();
        let token_account = &self.mint_ata.to_account_info();
        let edition = &self.edition.to_account_info();
        let mint = &self.mint.to_account_info();
        let token_program = &self.token_program.to_account_info();
        let metadata_program = &self.metadata_program.to_account_info();

        let seeds = &[
            b"auction",
            self.mint.to_account_info().key.as_ref(),
            &[self.auction.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        FreezeDelegatedAccountCpi::new(
            metadata_program,
            FreezeDelegatedAccountCpiAccounts {
                delegate,
                token_account,
                edition,
                mint,
                token_program,
            },
        ).invoke_signed(signer_seeds)?;
        Ok(())
    }

    pub fn create(&mut self, start_time: i64, deadline: i64, min_price: u64, min_increment: Option<u64>, bumps: &CreateAuctionBumps) -> Result<()> {
        self.auction.set_inner(Auction {
            start_time,
            deadline,
            min_price,
            current_bidder: None,
            current_bid: None,
            min_increment,
            mint: self.mint.key(),
            maker: self.payer.key(),
            bump: bumps.auction,
        });
        Ok(())
    }
}

