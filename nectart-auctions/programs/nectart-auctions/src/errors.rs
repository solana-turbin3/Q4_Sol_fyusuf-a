use anchor_lang::prelude::*;

#[error_code]
pub enum AuctionError {
    #[msg("Auction has not started")]
    AuctionNotStarted,
    #[msg("Auction has ended")]
    AuctionEnded,
    #[msg("Auction has not ended")]
    AuctionNotEnded,
    #[msg("Bid is too low")]
    BidTooLow,
    #[msg("Only the maker can claim the funds")]
    NotMaker,
    #[msg("Preceding bidder is not correct")]
    BadPrecedingBidder,
}
