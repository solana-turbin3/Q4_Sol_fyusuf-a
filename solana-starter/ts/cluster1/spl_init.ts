import { Keypair, Connection, Commitment, PublicKey, Signer } from "@solana/web3.js";
import { createMint } from '@solana/spl-token';
import wallet from "../wba-wallet.json"

// Import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);

(async () => {
    let publicKey: PublicKey;
    try {
      publicKey = await createMint(connection, keypair, keypair.publicKey, null, 6);
      console.log(publicKey.toBase58());
    } catch (error) {
      console.error(error);
    }
})()
