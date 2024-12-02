import { web3 } from "@coral-xyz/anchor";

export const admin = web3.Keypair.generate();
export const auctioneer = web3.Keypair.generate();
