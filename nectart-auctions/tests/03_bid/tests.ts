import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, KeypairSigner, signerIdentity } from "@metaplex-foundation/umi";
import { findMasterEditionPda, findMetadataPda, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mockStorage } from '@metaplex-foundation/umi-storage-mock';
import { airdrop_if_needed, createNft, ONE_SECOND, ONE_MINUTE} from '../lib';
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

const bidder2 = generateSigner({ eddsa: umi.eddsa });
const web3JsBidder2Signer = Keypair.fromSecretKey(bidder2.secretKey);


umi.use(mplTokenMetadata());
umi.use(mockStorage());
anchor.setProvider(provider);

const program = anchor.workspace.NectartAuctions as Program<NectartAuctions>;

let collectionMint: KeypairSigner;
let nftMint: KeypairSigner;
let auction: anchor.web3.PublicKey;
let vault: anchor.web3.PublicKey;
let vaultState: anchor.web3.PublicKey;
let auctionStart: number;
let auctionEnd: number;

describe("Bids", () => {
  before(async () => {
    umi.use(signerIdentity(auctioneer));
    await airdrop_if_needed(provider, toWeb3JsPublicKey(auctioneer.publicKey), 5);
    const mint  = await createNft(umi);
    collectionMint = mint.collectionMint;
    nftMint = mint.nftMint;
    auction = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('auction'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];
    vault = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('vault'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];
    vaultState = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('state'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];

    await airdrop_if_needed(provider, toWeb3JsPublicKey(bidder1.publicKey), 5);
    await airdrop_if_needed(provider, toWeb3JsPublicKey(bidder2.publicKey), 5);

    const mintAta = getAssociatedTokenAddressSync(toWeb3JsPublicKey(nftMint.publicKey), toWeb3JsPublicKey(auctioneer.publicKey));
    const nftEdition = findMasterEditionPda(umi, { mint: nftMint.publicKey });
    const nftMetadata = findMetadataPda(umi, { mint: nftMint.publicKey });

    const time = Math.round(new Date().getTime() / 1000);
    auctionStart = time + 1;
    auctionEnd = time + 10;
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
  });

  describe("Before the beginning of the auction", () => {
    it("No bet can be made", async () => {
      umi.use(signerIdentity(bidder1));
      await assert.rejects(async () => {
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
      }, () => true, "Bid should fail");
    });
  });

  describe("After the beginning of the auction", () => {
    let balanceBefore: number;
    before(async () => {
      balanceBefore = await provider.connection.getBalance(vault);
      const now = new Date().getTime();
      await new Promise((resolve) => setTimeout(resolve, auctionStart * 1000 - now + 1500));
    });

    it("A bet can be made", async () => {
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

    it("The vault balance should increase", async () => {
      const balanceAfter = await provider.connection.getBalance(vault);
      assert(balanceAfter > balanceBefore, "The vault balance should have increased");
    });

    it("A bet cannot be made if its amount is lesser or equal than the current bet", async () => {
      umi.use(signerIdentity(bidder2));
      await assert.rejects(async () => {
        await program.methods.bid(new BN(1))
          .accountsPartial({
            bidder: bidder2.publicKey,
            mint: nftMint.publicKey,
            auction,
            vault,
            vaultState,
            precedingBidder: bidder1.publicKey,
          })
          .signers([web3JsBidder2Signer])
          .rpc();
      }, () => true, "Bid should fail");
    });

    it("A bet can be made if its amount is greater than the current bet", async () => {
        umi.use(signerIdentity(bidder2));
        await program.methods.bid(new BN(2))
          .accountsPartial({
            bidder: bidder2.publicKey,
            mint: nftMint.publicKey,
            auction,
            vault,
            vaultState,
            precedingBidder: toWeb3JsPublicKey(bidder1.publicKey),
          })
          .signers([web3JsBidder2Signer])
          .rpc();
    });
  });

  describe("After the end of the auction", () => {
    before(async () => {
      const now = new Date().getTime();
      await new Promise((resolve) => setTimeout(resolve, auctionEnd * 1000 - now + 1500));
    });

    it("No bet can be made", async () => {
      umi.use(signerIdentity(bidder1));
      await assert.rejects(async () => {
        await program.methods.bid(new BN(100))
          .accounts({
            bidder: bidder1.publicKey,
            mint: nftMint.publicKey,
            auction,
            vault,
            vaultState,
            precedingBidder: bidder2.publicKey,
          })
          .signers([web3JsBidder1Signer])
          .rpc();
      }, () => true, "Bid should fail");
    });
  });
});
