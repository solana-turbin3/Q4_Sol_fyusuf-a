import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { expect } from "chai";

describe("escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Escrow as Program<Escrow>;
  const payer = (program.provider as anchor.AnchorProvider).wallet;
  const payee = web3.Keypair.generate();

  //const [global] = web3.PublicKey.findProgramAddressSync(
    //[Buffer.from("escrow")], program.programId
  //);

  describe("initialize", () => {
    it("Initialization creates a pda with the correct name", async () => {
      try {
        const tx = await program.methods.initialize()
          .accounts({
            payer: payer.publicKey,
            payee: payee.publicKey,
          })
          .rpc();
        console.log("Your transaction signature", tx);
      } catch(e) {
        console.log('hello');
        console.log(e);
      }
      const [pda, _] = web3.PublicKey.findProgramAddressSync([
        Buffer.from("state"),
        payer.publicKey.toBuffer(),
        payee.publicKey.toBuffer(),
      ], program.programId);

      const accountInfo = await program.account.vaultState.fetch(pda);
      expect(!!accountInfo).to.be.true;
    });
  });
});
