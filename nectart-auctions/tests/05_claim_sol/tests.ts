import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, KeypairSigner, Pda, signerIdentity, SolAmount } from "@metaplex-foundation/umi";
import { findMasterEditionPda, findMetadataPda, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mockStorage } from '@metaplex-foundation/umi-storage-mock';
import { airdrop_if_needed, createNft } from '../lib';
import { NectartAuctions } from "../../target/types/nectart_auctions";
import { getAssociatedTokenAddressSync} from "@solana/spl-token";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { Keypair } from "@solana/web3.js";
import { BN } from "bn.js";
import assert from "node:assert/strict";

const provider_ = anchor.AnchorProvider.env();

const provider = new anchor.AnchorProvider(
  provider_.connection,
  provider_.wallet,
  {
    commitment: 'confirmed',
  }
);

const umi = createUmi(provider.connection);
const auctioneer = generateSigner({ eddsa: umi.eddsa });
const secretKey = auctioneer.secretKey;
const web3JsAuctioneerSigner = Keypair.fromSecretKey(secretKey);

const bidder1 = generateSigner({ eddsa: umi.eddsa });
const web3JsBidder1Signer = Keypair.fromSecretKey(bidder1.secretKey);

const somebody = generateSigner({ eddsa: umi.eddsa });
const web3JsSomebodySigner = Keypair.fromSecretKey(somebody.secretKey);

umi.use(mplTokenMetadata());
umi.use(mockStorage());
anchor.setProvider(provider);

const program = anchor.workspace.NectartAuctions as Program<NectartAuctions>;

let collectionMint: KeypairSigner;
let nftMint: KeypairSigner;
let auction: anchor.web3.PublicKey;
let vault: anchor.web3.PublicKey;
let vaultState: anchor.web3.PublicKey;
let nftEdition: Pda<string, number>;
let auctioneerAta: anchor.web3.PublicKey;

let auctionStart: number;
let auctionEnd: number;

let balanceBefore: SolAmount;

before(async () => {
  umi.use(signerIdentity(auctioneer));
  await airdrop_if_needed(provider, toWeb3JsPublicKey(auctioneer.publicKey), 5);
  await airdrop_if_needed(provider, toWeb3JsPublicKey(bidder1.publicKey), 5);
});

const initializeAuction = async () => {
  umi.use(signerIdentity(auctioneer));
  const mint  = await createNft(umi);
  collectionMint = mint.collectionMint;
  nftMint = mint.nftMint;
  auctioneerAta = getAssociatedTokenAddressSync(toWeb3JsPublicKey(nftMint.publicKey), toWeb3JsPublicKey(auctioneer.publicKey));
  auction = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('auction'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];
  vault = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('vault'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];
  vaultState = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('state'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];

  const mintAta = getAssociatedTokenAddressSync(toWeb3JsPublicKey(nftMint.publicKey), toWeb3JsPublicKey(auctioneer.publicKey));
  nftEdition = findMasterEditionPda(umi, { mint: nftMint.publicKey });
  const nftMetadata = findMetadataPda(umi, { mint: nftMint.publicKey });

  const time = Math.round(new Date().getTime() / 1000);
  auctionStart = time;
  auctionEnd = time + 5;
  await program.methods.createAuction(new BN(auctionStart), new BN(auctionEnd), new BN(0), new BN(0))
    .accounts({
      payer: auctioneer.publicKey,
      mint: nftMint.publicKey,
      collectionMint: collectionMint.publicKey,
      mintAta,
      metadata: toWeb3JsPublicKey(nftMetadata[0]),
      edition: toWeb3JsPublicKey(nftEdition[0]),
      auction,
      vault,
      vaultState,
    })
    .signers([web3JsAuctioneerSigner])
    .rpc();

  let now = new Date().getTime();
  await new Promise((resolve) => setTimeout(resolve, auctionStart * 1000 - now + 1500));
}

describe("If a bid is made,", () => {
  before(async () => {
    await initializeAuction();
    await program.methods.bid(new BN(1))
      .accounts({
        bidder: bidder1.publicKey,
        mint: nftMint.publicKey,
        auction,
        vault,
        vaultState,
        precedingBidder: null,
      })
      .signers([web3JsBidder1Signer])
      .rpc();
  });

  describe("before the end of the auction,", () => {
    it("nobody can claim the SOL", async () => {
      for (const signer of [
        web3JsAuctioneerSigner,
        web3JsBidder1Signer,
        web3JsSomebodySigner,
      ]) {
        await assert.rejects(async () => {
          await program.methods.claimSol()
            .accounts({
              signer: signer.publicKey,
              mint: nftMint.publicKey,
              auction,
              vault,
              vaultState,
            })
            .signers([signer])
            .rpc();
        }, () => true, "Claim should fail");
      }
    });
  });

  describe("after the end of the auction,", () => {
    before(async () => {
      const now = new Date().getTime();
      await new Promise((resolve) => setTimeout(resolve, auctionEnd * 1000 - now + 1500));
    });

    it("nobody can claim the SOL...", async () => {
      for (const signer of [
        web3JsBidder1Signer,
        web3JsSomebodySigner,
      ]) {
        await assert.rejects(async () => {
          await program.methods.claimSol()
            .accounts({
              signer: signer.publicKey,
              mint: nftMint.publicKey,
              auction,
              vault,
              vaultState,
            })
            .signers([signer])
            .rpc();
        }, () => true, "Claim should fail");
      }
    });

    it("...except the auctioneer", async () => {
      umi.use(signerIdentity(auctioneer));
      balanceBefore = await umi.rpc.getBalance(auctioneer.publicKey);
      await program.methods.claimSol()
        .accounts({
          signer: web3JsAuctioneerSigner.publicKey,
          mint: nftMint.publicKey,
          auction,
          vault,
          vaultState,
        })
        .signers([web3JsAuctioneerSigner])
        .rpc();
    });

    it("The auctioneer balance in SOL should increase", async () => {
      const balanceAfter = await umi.rpc.getBalance(auctioneer.publicKey);
      assert(Number(balanceAfter.basisPoints) - Number(balanceBefore.basisPoints) == 1, "Balance should increase");
    });
  });
});
