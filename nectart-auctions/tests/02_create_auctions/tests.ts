import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { auctioneer } from "../nectart-auctions";
import { createSignerFromKeypair, generateSigner, keypairIdentity, KeypairSigner, percentAmount } from "@metaplex-foundation/umi";
import { createNft, findMasterEditionPda, findMetadataPda, mplTokenMetadata, verifySizedCollectionItem } from "@metaplex-foundation/mpl-token-metadata";
import { mockStorage } from '@metaplex-foundation/umi-storage-mock';
import { airdrop_if_needed, ONE_MINUTE, ONE_SECOND, } from '../lib';
import { NectartAuctions } from "../../target/types/nectart_auctions";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync} from "@solana/spl-token";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";


const provider = anchor.AnchorProvider.env();

const payer = provider.wallet as NodeWallet;

const umi = createUmi(provider.connection);
const wallet = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(payer.payer.secretKey));
const creator = createSignerFromKeypair(umi, wallet);
umi.use(keypairIdentity(creator));
umi.use(mplTokenMetadata());
umi.use(mockStorage());
anchor.setProvider(provider);

const program = anchor.workspace.NectartAuctions as Program<NectartAuctions>;

let nftMint: KeypairSigner = generateSigner(umi);
let collectionMint: KeypairSigner = generateSigner(umi);
it("mints collection NFT", async () => {
  await airdrop_if_needed(provider, auctioneer.publicKey, 5);
  await createNft(umi, {
      mint: collectionMint,
      name: "GM",
      symbol: "GM",
      uri: "https://arweave.net/123",
      sellerFeeBasisPoints: percentAmount(5.5),
      creators: null,
      collectionDetails: { 
        __kind: 'V1', size: 10,
      }
  }).sendAndConfirm(umi)
});

it("Mints NFT", async () => {
  await createNft(umi, {
    mint: nftMint,
    name: "GM",
    symbol: "GM",
    uri: "https://arweave.net/123",
    sellerFeeBasisPoints: percentAmount(5.5),
    collection: {verified: false, key: collectionMint.publicKey},
    creators: null,
  }).sendAndConfirm(umi);
});

  it("Verify Collection NFT", async () => {
    const collectionMetadata = findMetadataPda(umi, {mint: collectionMint.publicKey});
    const collectionMasterEdition = findMasterEditionPda(umi, {mint: collectionMint.publicKey});
    const nftMetadata = findMetadataPda(umi, {mint: nftMint.publicKey});
    await verifySizedCollectionItem(umi, {
      metadata: nftMetadata,
      collectionAuthority: umi.identity,
      collectionMint: collectionMint.publicKey,
      collection: collectionMetadata,
      collectionMasterEditionAccount: collectionMasterEdition,
     }).sendAndConfirm(umi)
  });

it("Creates an auction", async () => {
  const THIRTY_SECONDS = 30 * ONE_SECOND;
  const mintAta = getAssociatedTokenAddressSync(toWeb3JsPublicKey(nftMint.publicKey), provider.wallet.publicKey);
  const nftEdition = findMasterEditionPda(umi, { mint: nftMint.publicKey });
  const auction = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('auction'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];
  const auctionVault = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('vault'), toWeb3JsPublicKey(nftMint.publicKey).toBuffer()], program.programId)[0];
  const nftMetadata = findMetadataPda(umi, { mint: nftMint.publicKey });

  await program.methods.createAuction(new BN(THIRTY_SECONDS), new BN(ONE_MINUTE), new BN(0), new BN(0))
    .accountsPartial({
      payer: provider.wallet.publicKey,
      mint: nftMint.publicKey,
      collectionMint: collectionMint.publicKey,
      mintAta,
      metadata: toWeb3JsPublicKey(nftMetadata[0]),
      edition: toWeb3JsPublicKey(nftEdition[0]),
      auction,
      auctionVault,
    })
    .rpc();
});
