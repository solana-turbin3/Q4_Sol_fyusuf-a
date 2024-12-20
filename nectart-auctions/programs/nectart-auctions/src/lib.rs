use anchor_lang::prelude::*;
pub use instructions::*;

mod instructions;
mod state;
mod errors;

declare_id!("4zoHXad7ksVtaDgP2YqgCzx8DErSiXgDVsLBaodHpHuh");

#[program]
pub mod nectart_auctions {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    pub fn create_auction(ctx: Context<CreateAuction>, start_time: i64, deadline: i64, min_price: u64, min_increment: u64) -> Result<()> {
        ctx.accounts.create(start_time, deadline, min_price, min_increment, &ctx.bumps)?;
        ctx.accounts.approve()?;
        ctx.accounts.freeze()
    }

    pub fn bid(ctx: Context<Bid>, lamports: u64) -> Result<()> {
        ctx.accounts.bid(lamports)
    }

    pub fn claim_sol(ctx: Context<ClaimSol>) -> Result<()> {
        ctx.accounts.claim_sol()
    }

    pub fn claim_nft(ctx: Context<ClaimNFT>) -> Result<()> {
        ctx.accounts.claim_nft()
    }
}
