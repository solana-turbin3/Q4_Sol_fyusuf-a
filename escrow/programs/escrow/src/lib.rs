use anchor_lang::prelude::*;
use instructions::initialize::*;

pub mod instructions;

declare_id!("6aA7C6zCcrqYkdhbvRy3AvpAaerktEN3NmuPEzCTBQ1P");

#[program]
pub mod escrow {

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}
