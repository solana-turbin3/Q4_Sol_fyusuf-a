use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{
        mpl_token_metadata::instructions::{
            ThawDelegatedAccountCpi, 
            ThawDelegatedAccountCpiAccounts
        }, 
        MasterEditionAccount, 
        Metadata
    }, 
    token::{
        revoke, 
        Mint, 
        Revoke, 
        Token, 
        TokenAccount
    }
};

#[derive(Accounts)]
pub struct Lol<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        seeds = [b"auction", mint.key().as_ref()],
        space = Auction::INIT_SPACE,
        bump,
    )]
    pub auction: Acc
}

#[account]
pub struct Auction {
    pub start_time: i64,
    pub deadline: i64,
    pub min_price: u64,
    pub current_bidder: Option<Pubkey>,
    pub current_bid: Option<u64>,
    pub min_increment: Option<u64>,
    pub mint: Pubkey,
    pub maker: Pubkey,
    pub bump: u8,
}

impl Space for Auction {
    const INIT_SPACE: usize = 8 + 8 + 8 + 8 + (1 + 4) + (1 + 8) + (1 + 8) + 4 + 4 + 1;
}
