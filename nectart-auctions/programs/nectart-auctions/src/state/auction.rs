use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
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
