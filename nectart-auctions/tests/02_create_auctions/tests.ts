import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, signerIdentity } from "@metaplex-foundation/umi";
import { findMasterEditionPda, findMetadataPda, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mockStorage } from '@metaplex-foundation/umi-storage-mock';
import { airdrop_if_needed, createNft, ONE_MINUTE, ONE_SECOND, } from '../lib';
import { NectartAuctions } from "../../target/types/nectart_auctions";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync} from "@solana/spl-token";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { Keypair } from "@solana/web3.js";


const provider = anchor.AnchorProvider.env();

const umi = createUmi(provider.connection);
const auctioneer = generateSigner({ eddsa: umi.eddsa });
const secretKey = auctioneer.secretKey;
const web3JsSigner = Keypair.fromSecretKey(secretKey);


umi.use(signerIdentity(auctioneer));
umi.use(mplTokenMetadata());
umi.use(mockStorage());
anchor.setProvider(provider);

const program = anchor.workspace.NectartAuctions as Program<NectartAuctions>;

it("Creates an auction", async () => {
  await airdrop_if_needed(provider, toWeb3JsPublicKey(auctioneer.publicKey), 5);
  const { collectionMint, nftMint } = await createNft(umi);
  const THIRTY_SECONDS = 30 * ONE_SECOND;
  const mintAta = getAssociatedTokenAddressSync(toWeb3JsPublicKey(nftMint.publicKey), toWeb3JsPublicKey(auctioneer.publicKey));
  const nftEdition = findMasterEditionPda(umi, { mint: nftMint.publicKey });
  const auction = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('auction'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];
  const auctionVault = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('vault'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];
  const nftMetadata = findMetadataPda(umi, { mint: nftMint.publicKey });

  await program.methods.createAuction(new BN(THIRTY_SECONDS), new BN(ONE_MINUTE), new BN(0), new BN(0))
    .accounts({
      payer: auctioneer.publicKey,
      mint: nftMint.publicKey,
      collectionMint: collectionMint.publicKey,
      mintAta,
      metadata: toWeb3JsPublicKey(nftMetadata[0]),
      edition: toWeb3JsPublicKey(nftEdition[0]),
      auction,
      auctionVault,
    })
    .signers([web3JsSigner])
    .rpc();
});
