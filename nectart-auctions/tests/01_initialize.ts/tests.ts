import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { admin } from '../nectart-auctions';
import { NectartAuctions } from "../../target/types/nectart_auctions";
import { expect } from "chai";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.NectartAuctions as Program<NectartAuctions>;

it("sucessfully initializes the program", async () => {
  let balance = await provider.connection.getBalance(admin.publicKey);
  if (balance === 0) {
    const signature = await provider.connection.requestAirdrop(admin.publicKey, web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature, "finalized");
  }
  const tx = await program.methods.initialize()
    .accounts({
      admin: admin.publicKey
    })
    .signers([admin])
    .rpc();
});

it("stores the admin address", async () => {
  const [pda] = web3.PublicKey.findProgramAddressSync([
    Buffer.from("config")
  ], program.programId);
  const accountInfo = await program.account.config.fetch(pda);
  expect(accountInfo.admin.equals(admin.publicKey));
});
