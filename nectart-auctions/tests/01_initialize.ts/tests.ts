import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { admin } from '../nectart-auctions';
import { NectartAuctions } from "../../target/types/nectart_auctions";
import { expect } from "chai";
import { airdrop_if_needed } from "../lib";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.NectartAuctions as Program<NectartAuctions>;

describe("Program initialization", () => {
  it("Program sucessfully initializes", async () => {
    await airdrop_if_needed(provider, admin.publicKey, 5);
    await program.methods.initialize()
      .accounts({
        admin: admin.publicKey
      })
      .signers([admin])
      .rpc();
  });

  it("After initialization, the program stores the admin address", async () => {
    const [pda] = web3.PublicKey.findProgramAddressSync([
      Buffer.from("config")
    ], program.programId);
    const accountInfo = await program.account.config.fetch(pda);
    expect(accountInfo.admin.equals(admin.publicKey));
  });
});
