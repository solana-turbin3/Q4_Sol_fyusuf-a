import * as anchor from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { auctioneer } from "../nectart-auctions";
import { keypairIdentity } from "@metaplex-foundation/umi";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mockStorage } from '@metaplex-foundation/umi-storage-mock';
import { mintNft, nftDetail, uploadImage, uploadMetadata } from '../lib';

const provider = anchor.AnchorProvider.env();
const umi = createUmi(provider.connection);
const wallet = umi.eddsa.createKeypairFromSecretKey(auctioneer.secretKey);
umi.use(keypairIdentity(wallet));
umi.use(mplTokenMetadata());
umi.use(mockStorage());
anchor.setProvider(provider);

it("mints nft", async () => {
  const imageUri = await uploadImage(umi, nftDetail);
  console.log(`Image URI: ${imageUri}`);
  const metadataUri = await uploadMetadata(umi, nftDetail, imageUri);
  console.log(`Metadata URI: ${metadataUri}`);
  await mintNft(umi, metadataUri);
});
