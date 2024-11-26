import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import { expect } from "chai";
import { BN } from "bn.js";

const AMOUNT_DEPOSITED = 8 * 10 ** 9;
let vaultPda: null | anchor.web3.PublicKey = null;

describe("escrow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program<Escrow>;
  const payer = (program.provider as anchor.AnchorProvider).wallet;
  const payee = web3.Keypair.generate();

  //const [global] = web3.PublicKey.findProgramAddressSync(
    //[Buffer.from("escrow")], program.programId
  //);

  describe("initialize", () => {
    it("creates a pda with the correct name", async () => {
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
      const [pda] = web3.PublicKey.findProgramAddressSync([
        Buffer.from("state"),
        payer.publicKey.toBuffer(),
        payee.publicKey.toBuffer(), ], program.programId);
      vaultPda = pda;

      const accountInfo = await program.account.vaultState.fetch(pda);
      expect(!!accountInfo).to.be.true;
    });
  });

  describe("deposit", async () => {
    it ("should deposit funds into the escrow account", async () => {
      await program.methods.deposit(new BN(AMOUNT_DEPOSITED))
        .accounts({
          payer: payer.publicKey,
          payee: payee.publicKey,
          vaultState: {
            pda: {
              seeds: [Buffer.from("state"), payer.publicKey.toBuffer(), payee.publicKey.toBuffer()],
            },
          },
        })
        .rpc();
      console.log('deposited!');

      const [pda] = web3.PublicKey.findProgramAddressSync([
        Buffer.from("state"),
        payer.publicKey.toBuffer(),
        payee.publicKey.toBuffer(), ], program.programId);
      const balance = await provider.connection.getBalance(pda);
      expect(balance).to.be.equal(new BN(AMOUNT_DEPOSITED));
    });

    //try {
      //const tx = await program.methods.deposit(100)
    //it(
  });
});
