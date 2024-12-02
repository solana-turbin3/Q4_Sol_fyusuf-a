import fs from 'fs';
import { createGenericFile } from "@metaplex-foundation/umi";
import type { Umi } from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import { amountToString, generateSigner, percentAmount, sol } from "@metaplex-foundation/umi";

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
    console.log(`Uploaded metadata: ${metadataUri}`);
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
    console.log(`Uploaded image: ${imgUri}`);
    return imgUri;
  } catch (error) {
    throw error;
  }
}

export async function mintNft(umi: Umi, metadataUri: string) {
  const publicKey = umi.identity.publicKey;
  try {
    const mint = generateSigner(umi);
    await umi.rpc.airdrop(publicKey, sol(5));
    const balance = await umi.rpc.getBalance(publicKey);
    console.log(`Mint: ${amountToString(balance)}`);
    await createNft(umi, {
      mint,
      name: 'NFT',
      symbol: 'NFT',
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      creators: [{ address: publicKey, verified: true, share: 100 }],
    }).sendAndConfirm(umi);
    console.log(`Created NFT: ${mint.publicKey.toString()}`);
  } catch (error) {
    throw error;
  }
}

