import * as anchor from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { auctioneer } from "../nectart-auctions";
import { keypairIdentity } from "@metaplex-foundation/umi";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mockStorage } from '@metaplex-foundation/umi-storage-mock';
import { airdrop_if_needed, mintNft, nftDetail, uploadImage, uploadMetadata } from '../lib';

const provider = anchor.AnchorProvider.env();
const umi = createUmi(provider.connection);
const wallet = umi.eddsa.createKeypairFromSecretKey(auctioneer.secretKey);
umi.use(keypairIdentity(wallet));
umi.use(mplTokenMetadata());
umi.use(mockStorage());
anchor.setProvider(provider);

it("mints nft", async () => {
  await airdrop_if_needed(provider, auctioneer.publicKey, 5);
  const imageUri = await uploadImage(umi, nftDetail);
  const metadataUri = await uploadMetadata(umi, nftDetail, imageUri);
  await mintNft(umi, metadataUri);
});
