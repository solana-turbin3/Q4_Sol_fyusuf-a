import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, KeypairSigner, Pda, PublicKey, signerIdentity, Umi } from "@metaplex-foundation/umi";
import { findMasterEditionPda, findMetadataPda, mplTokenMetadata, TokenStandard, transferV1 } from "@metaplex-foundation/mpl-token-metadata";
import { mockStorage } from '@metaplex-foundation/umi-storage-mock';
import { airdrop_if_needed, createNft } from '../lib';
import { NectartAuctions } from "../../target/types/nectart_auctions";
import { getAssociatedTokenAddressSync} from "@solana/spl-token";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { Keypair } from "@solana/web3.js";
import { BN } from "bn.js";
import assert from "node:assert/strict";
import { fetchToken, findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";

const provider_ = anchor.AnchorProvider.env();

const provider = new anchor.AnchorProvider(
  provider_.connection,
  provider_.wallet,
  {
    commitment: 'confirmed',
  }
);

async function howManyTokensHasOwner(umi: Umi, owner: PublicKey<string>, mint: PublicKey<string>): Promise<bigint> {
  try {
    let result = findAssociatedTokenPda(umi, { owner, mint });
    associatedToken = result[0];
    let ata = await fetchToken(umi, associatedToken);
    return ata.amount;
  } catch (e) {
    return BigInt(0);
  }
}

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
let associatedToken: PublicKey<string>;

let auctionStart: number;
let auctionEnd: number;

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
  let auctioneerTokenNumberBefore: bigint;
  let bidderTokenNumberBefore: bigint;

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

  describe("before the end of the auction", () => {
    it("nobody can claim the NFT", async () => {
      for (const signer of [
        web3JsAuctioneerSigner,
        web3JsBidder1Signer,
        web3JsSomebodySigner,
      ]) {
        await assert.rejects(async () => {
          await program.methods.claimNft()
            .accounts({
              signer: signer.publicKey,
              auctioneer: auctioneer.publicKey,
              auctioneerAta,
              mint: nftMint.publicKey,
              edition: toWeb3JsPublicKey(nftEdition[0]),
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

    it("nobody can claim the NFT...", async () => {
      for (const signer of [
        web3JsAuctioneerSigner,
        web3JsSomebodySigner
      ]) {
        await assert.rejects(async () => {
          await program.methods.claimNft()
            .accounts({
              signer: signer.publicKey,
              auctioneer: auctioneer.publicKey,
              auctioneerAta,
              mint: nftMint.publicKey,
              edition: toWeb3JsPublicKey(nftEdition[0]),
              auction,
              vault,
              vaultState,
            })
            .signers([signer])
            .rpc();
        }, () => true, "Claim should fail");
      }
    });

    it("...except the highest bidder", async () => {
      auctioneerTokenNumberBefore = await howManyTokensHasOwner(umi, auctioneer.publicKey, nftMint.publicKey);
      bidderTokenNumberBefore = await howManyTokensHasOwner(umi, bidder1.publicKey, nftMint.publicKey);
      await program.methods.claimNft()
        .accounts({
          signer: bidder1.publicKey,
          auctioneer: auctioneer.publicKey,
          auctioneerAta,
          mint: nftMint.publicKey,
          edition: toWeb3JsPublicKey(nftEdition[0]),
          auction,
          vault,
          vaultState,
        })
        .signers([web3JsBidder1Signer])
        .rpc();
    });

    it("The balance of the auctioneer is decremented", async () => {
      const auctioneerTokenNumberAfter = await howManyTokensHasOwner(umi, auctioneer.publicKey, nftMint.publicKey);
      assert.strictEqual(Number(auctioneerTokenNumberBefore), 1);
      assert.strictEqual(Number(auctioneerTokenNumberAfter), 0);
    });

    it("The balance of the bidder is incremented", async () => {
      const bidderTokenNumberAfter = await howManyTokensHasOwner(umi, bidder1.publicKey, nftMint.publicKey);
      assert.strictEqual(Number(bidderTokenNumberBefore), 0);
      assert.strictEqual(Number(bidderTokenNumberAfter), 1);
    });

    it("After the claim, the token is not frozen", async () => {
      await (transferV1(umi, {
        mint: nftMint.publicKey,
        authority: bidder1,
        tokenOwner: bidder1.publicKey,
        destinationOwner: somebody.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      }).sendAndConfirm(umi));
    });

  });
});

describe("If no bid is made", () => {
  let auctioneerTokenNumberBefore: bigint;

  before(async () => {
    await initializeAuction();
  });

  describe("Before the end of the auction,", () => {
    it("nobody can claim the NFT", async () => {
      for (const signer of [
        web3JsAuctioneerSigner,
        web3JsSomebodySigner,
      ]) {
        await assert.rejects(async () => {
          await program.methods.claimNft()
            .accounts({
              signer: signer.publicKey,
              auctioneer: auctioneer.publicKey,
              auctioneerAta,
              mint: nftMint.publicKey,
              edition: toWeb3JsPublicKey(nftEdition[0]),
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

  describe("After the end of the auction,", () => {
    before(async () => {
      const now = new Date().getTime();
      await new Promise((resolve) => setTimeout(resolve, auctionEnd * 1000 - now + 1500));
    });

    it("nobody can claim the NFT...", async () => {
      for (const signer of [somebody]) {
        await assert.rejects(async () => {
          await program.methods.claimNft()
            .accounts({
              signer: signer.publicKey,
              auctioneer: auctioneer.publicKey,
              auctioneerAta,
              mint: nftMint.publicKey,
              edition: toWeb3JsPublicKey(nftEdition[0]),
              auction,
              vault,
              vaultState,
            })
            .signers([web3JsAuctioneerSigner])
            .rpc();
        }, () => true, "Claim should fail");
      }
    });

    it("...except the auctioneer", async () => {
      auctioneerTokenNumberBefore = await howManyTokensHasOwner(umi, auctioneer.publicKey, nftMint.publicKey);
      await program.methods.claimNft()
        .accounts({
          signer: auctioneer.publicKey,
          auctioneer: auctioneer.publicKey,
          auctioneerAta,
          mint: nftMint.publicKey,
          edition: toWeb3JsPublicKey(nftEdition[0]),
          auction,
          vault,
          vaultState,
        })
        .signers([web3JsAuctioneerSigner])
        .rpc();
    });

    it("The balance of the auctioneer is the same", async () => {
      const auctioneerTokenNumberAfter = await howManyTokensHasOwner(umi, auctioneer.publicKey, nftMint.publicKey);
      assert.strictEqual(Number(auctioneerTokenNumberBefore), 1);
      assert.strictEqual(Number(auctioneerTokenNumberAfter), 1);
    });

    it("After the claim, the token is not frozen", async () => {
      await (transferV1(umi, {
        mint: nftMint.publicKey,
        authority: auctioneer,
        tokenOwner: auctioneer.publicKey,
        destinationOwner: somebody.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      }).sendAndConfirm(umi));
    });
  });
});
