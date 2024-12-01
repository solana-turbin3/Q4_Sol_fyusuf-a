use anchor_lang::prelude::*;
use instructions::initialize::*;

pub mod instructions;
pub mod state;

declare_id!("4zoHXad7ksVtaDgP2YqgCzx8DErSiXgDVsLBaodHpHuh");

#[program]
pub mod nectart_auctions {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }
}
