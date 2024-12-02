import fs from 'fs';
import { createGenericFile, KeypairSigner } from "@metaplex-foundation/umi";
import type { Umi } from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { generateSigner, percentAmount } from "@metaplex-foundation/umi";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";

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

export async function mintNft(umi: Umi, metadataUri: string): Promise<KeypairSigner> {
  const publicKey = umi.identity.publicKey;
  try {
    const mint = generateSigner(umi);
    await createNft(umi, {
      mint,
      name: 'NFT',
      symbol: 'NFT',
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      creators: [{ address: publicKey, verified: true, share: 100 }],
    }).sendAndConfirm(umi);
    return mint;
  } catch (error) {
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
