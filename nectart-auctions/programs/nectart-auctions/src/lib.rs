use anchor_lang::prelude::*;
pub use instructions::*;

mod instructions;
mod state;

declare_id!("4zoHXad7ksVtaDgP2YqgCzx8DErSiXgDVsLBaodHpHuh");

#[program]
pub mod nectart_auctions {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    pub fn create_an_auction(ctx: Context<CreateAuction>, start_time: i64, deadline: i64, min_price: u64, min_increment: Option<u64>) -> Result<()> {
        ctx.accounts.freeze()?;
        ctx.accounts.create(start_time, deadline, min_price, min_increment, &ctx.bumps)
    }
}
