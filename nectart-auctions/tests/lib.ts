import fs from 'fs';
import { createGenericFile, KeypairSigner, percentAmount } from "@metaplex-foundation/umi";
import type { Umi } from "@metaplex-foundation/umi";
import { generateSigner } from "@metaplex-foundation/umi";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { createNft as metaplexCreateNft } from "@metaplex-foundation/mpl-token-metadata";
import { findMasterEditionPda, findMetadataPda, verifySizedCollectionItem } from "@metaplex-foundation/mpl-token-metadata";

export const ONE_SECOND = 1000;
export const ONE_MINUTE = ONE_SECOND * 60;

type NFTDetail = {
  name: string;
  symbol: string;
  uri: string;
  royalties: number;
  description: string;
  imgType: string;
  attributes: string[];
}

export const nftDetail: NFTDetail = {
  name: "NFT",
  symbol: "NFT",
  uri: "https://example.com",
  royalties: 0,
  description: "NFT",
  imgType: "image/png",
  attributes: [],
};

export async function uploadMetadata(umi: Umi, nftDetail: NFTDetail, imageUri: string): Promise<string> {
  try {
    const metadata = {
      name: nftDetail.name,
      description: nftDetail.description,
      image: imageUri,
      atributes: nftDetail.attributes,
      properties: {
        files: [
          {
            uri: imageUri,
            type: nftDetail.imgType,
          },
        ],
      },
    };
    const metadataUri = await umi.uploader.uploadJson(metadata);
    return metadataUri;
  } catch (e) {
    throw e;
  }
}


export async function uploadImage(umi: Umi, nftDetail: NFTDetail): Promise<string> {
  try {
    const imgDirectory = './uploads';
    const imgName = 'image.png';
    const filePath = `${imgDirectory}/${imgName}`;
    const fileBuffer = fs.readFileSync(filePath);
    const image = createGenericFile(
      fileBuffer,
      imgName,
      {
        uniqueName: nftDetail.name,
        contentType: nftDetail.imgType,
      }
    );
    const [imgUri] = await umi.uploader.upload([image]);
    return imgUri;
  } catch (error) {
    throw error;
  }
}

export async function createNft(umi: Umi): Promise<{
  collectionMint: KeypairSigner,
  nftMint: KeypairSigner
}> {
  try {
    const collectionMint = generateSigner(umi);
    // creates a collection mint
    await metaplexCreateNft(umi, {
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

    // creates an NFT
    const nftMint = generateSigner(umi);
    await metaplexCreateNft(umi, {
      mint: nftMint,
      name: "GM",
      symbol: "GM",
      uri: "https://arweave.net/123",
      sellerFeeBasisPoints: percentAmount(5.5),
      collection: {verified: false, key: collectionMint.publicKey},
      creators: null,
    }).sendAndConfirm(umi);

    // verifies metadata
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
    return {
      collectionMint,
      nftMint,
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function airdrop_if_needed(provider: AnchorProvider, publicKey: PublicKey, amount: number) {
  const balance = await provider.connection.getBalance(publicKey);
  if (balance === 0) {
    const signature = await provider.connection.requestAirdrop(publicKey, amount * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature, "finalized");
  }
}
