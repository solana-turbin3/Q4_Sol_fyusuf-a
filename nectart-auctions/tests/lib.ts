import fs from 'fs';
import { createGenericFile, KeypairSigner } from "@metaplex-foundation/umi";
import type { Umi } from "@metaplex-foundation/umi";
import { generateSigner } from "@metaplex-foundation/umi";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { createMint, createToken, mintTokensTo } from '@metaplex-foundation/mpl-toolbox';

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

export async function mintNft(umi: Umi): Promise<KeypairSigner> {
  const publicKey = umi.identity.publicKey;
  try {
    const mint = generateSigner(umi);
    await createMint(umi, {
      mint,
      decimals: 0,
      mintAuthority: umi.identity.publicKey,
      freezeAuthority: umi.identity.publicKey,
    }).sendAndConfirm(umi);
    const token = generateSigner(umi);
    await createToken(umi, { token, mint: mint.publicKey, owner: publicKey }).sendAndConfirm(umi);
    await mintTokensTo(umi, {
      mintAuthority: umi.identity,
      mint: mint.publicKey,
      amount: 1,
      token: token.publicKey,
    }).sendAndConfirm(umi);
    return mint;
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
