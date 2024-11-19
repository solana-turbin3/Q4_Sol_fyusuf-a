use anchor_lang::prelude::*;

declare_id!("9KGS7ihVcXQkyyFtULxZjs7mJu8AySZednB7Q7iYLKUe");

#[program]
pub mod nectart_auctions {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
