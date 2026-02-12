import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Contract } from "../target/types/contract";
import { expect } from "chai";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import BN from "bn.js";

// ============================================================================
// Helpers
// ============================================================================

const DARE_SEED = Buffer.from("dare");
const VAULT_SEED = Buffer.from("vault");
const USER_STATS_SEED = Buffer.from("user_stats");

function getDarePDA(
  programId: PublicKey,
  challenger: PublicKey,
  dareId: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DARE_SEED, challenger.toBuffer(), dareId.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

function getVaultPDA(
  programId: PublicKey,
  dareKey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, dareKey.toBuffer()],
    programId
  );
}

function getUserStatsPDA(
  programId: PublicKey,
  user: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_STATS_SEED, user.toBuffer()],
    programId
  );
}

/** Returns a unix timestamp N seconds from now */
function futureTimestamp(seconds: number): BN {
  return new BN(Math.floor(Date.now() / 1000) + seconds);
}

/** Airdrops SOL to a keypair and confirms */
async function airdrop(
  connection: anchor.web3.Connection,
  to: PublicKey,
  amount: number = 10 * LAMPORTS_PER_SOL
) {
  const sig = await connection.requestAirdrop(to, amount);
  await connection.confirmTransaction(sig, "confirmed");
}

/** A fake 32-byte hash for testing */
function fakeHash(seed: number = 1): number[] {
  return Array(32).fill(seed);
}

// ============================================================================
// Tests
// ============================================================================

describe("DareMe Contract", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.contract as Program<Contract>;
  const connection = provider.connection;

  // Test wallets
  let challenger: Keypair;
  let daree: Keypair;
  let outsider: Keypair;

  // Shared state for sequential tests
  let dareIdCounter = 0;

  beforeEach(async () => {
    challenger = Keypair.generate();
    daree = Keypair.generate();
    outsider = Keypair.generate();

    await Promise.all([
      airdrop(connection, challenger.publicKey),
      airdrop(connection, daree.publicKey),
      airdrop(connection, outsider.publicKey),
    ]);
  });

  // --------------------------------------------------------------------------
  // create_dare
  // --------------------------------------------------------------------------

  describe("create_dare", () => {
    it("creates a DirectDare (open, no target) and escrows SOL", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(LAMPORTS_PER_SOL); // 1 SOL
      const deadline = futureTimestamp(86400); // 24h from now

      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [statsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      await program.methods
        .createDare(
          dareId,
          fakeHash(1),
          amount,
          deadline,
          { directDare: {} },
          { challengerSelect: {} },
          PublicKey.default  // no target
        )
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: statsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // Verify dare state
      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.challenger.toBase58()).to.equal(challenger.publicKey.toBase58());
      expect(dareAccount.hasDaree).to.be.false;
      expect(dareAccount.dareId.toNumber()).to.equal(dareId.toNumber());
      expect(dareAccount.amount.toNumber()).to.equal(LAMPORTS_PER_SOL);
      expect(dareAccount.status).to.deep.equal({ created: {} });
      expect(dareAccount.dareType).to.deep.equal({ directDare: {} });
      expect(dareAccount.hasProof).to.be.false;

      // Verify vault has SOL
      const vaultBalance = await connection.getBalance(vaultPDA);
      expect(vaultBalance).to.equal(LAMPORTS_PER_SOL);

      // Verify challenger stats
      const stats = await program.account.userStats.fetch(statsPDA);
      expect(stats.daresCreated).to.equal(1);
      expect(stats.totalSpent.toNumber()).to.equal(LAMPORTS_PER_SOL);
    });

    it("creates a targeted DirectDare with daree pre-set", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(LAMPORTS_PER_SOL);
      const deadline = futureTimestamp(86400);

      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [statsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      await program.methods
        .createDare(
          dareId,
          fakeHash(1),
          amount,
          deadline,
          { directDare: {} },
          { challengerSelect: {} },
          daree.publicKey  // targeted daree
        )
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: statsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.hasDaree).to.be.true;
      expect(dareAccount.daree.toBase58()).to.equal(daree.publicKey.toBase58());
      expect(dareAccount.status).to.deep.equal({ created: {} });
    });

    it("creates a PublicBounty dare", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(0.5 * LAMPORTS_PER_SOL);
      const deadline = futureTimestamp(86400);

      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [statsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      await program.methods
        .createDare(
          dareId,
          fakeHash(2),
          amount,
          deadline,
          { publicBounty: {} },
          { challengerSelect: {} },
          PublicKey.default
        )
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: statsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.dareType).to.deep.equal({ publicBounty: {} });
      expect(dareAccount.status).to.deep.equal({ created: {} });
    });

    it("rejects zero amount", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [statsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      try {
        await program.methods
          .createDare(
            dareId,
            fakeHash(3),
            new BN(0),
            futureTimestamp(86400),
            { directDare: {} },
            { challengerSelect: {} },
            PublicKey.default
          )
          .accounts({
            challenger: challenger.publicKey,
            dare: darePDA,
            vault: vaultPDA,
            challengerStats: statsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();
        expect.fail("Should have thrown InvalidAmount");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidAmount");
      }
    });

    it("rejects deadline too far in the future (>30 days)", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [statsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      try {
        await program.methods
          .createDare(
            dareId,
            fakeHash(4),
            new BN(LAMPORTS_PER_SOL),
            futureTimestamp(31 * 24 * 60 * 60), // 31 days
            { directDare: {} },
            { challengerSelect: {} },
            PublicKey.default
          )
          .accounts({
            challenger: challenger.publicKey,
            dare: darePDA,
            vault: vaultPDA,
            challengerStats: statsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();
        expect.fail("Should have thrown DeadlineTooFar");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("DeadlineTooFar");
      }
    });

    it("rejects targeting yourself", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [statsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      try {
        await program.methods
          .createDare(
            dareId,
            fakeHash(5),
            new BN(LAMPORTS_PER_SOL),
            futureTimestamp(86400),
            { directDare: {} },
            { challengerSelect: {} },
            challenger.publicKey  // target yourself
          )
          .accounts({
            challenger: challenger.publicKey,
            dare: darePDA,
            vault: vaultPDA,
            challengerStats: statsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();
        expect.fail("Should have thrown CannotAcceptOwnDare");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("CannotAcceptOwnDare");
      }
    });
  });

  // --------------------------------------------------------------------------
  // accept_dare
  // --------------------------------------------------------------------------

  describe("accept_dare", () => {
    it("daree accepts an open DirectDare", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(LAMPORTS_PER_SOL);
      const deadline = futureTimestamp(86400);

      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);

      // Create an open DirectDare
      await program.methods
        .createDare(dareId, fakeHash(10), amount, deadline, { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // Accept the dare
      await program.methods
        .acceptDare()
        .accounts({
          daree: daree.publicKey,
          dare: darePDA,
          dareeStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ active: {} });
      expect(dareAccount.hasDaree).to.be.true;
      expect(dareAccount.daree.toBase58()).to.equal(daree.publicKey.toBase58());

      const stats = await program.account.userStats.fetch(dareeStatsPDA);
      expect(stats.daresAccepted).to.equal(1);
    });

    it("targeted daree accepts a targeted DirectDare", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);

      // Create a targeted DirectDare
      await program.methods
        .createDare(dareId, fakeHash(10), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, daree.publicKey)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // Target accepts
      await program.methods
        .acceptDare()
        .accounts({
          daree: daree.publicKey,
          dare: darePDA,
          dareeStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ active: {} });
    });

    it("rejects non-target accepting a targeted dare", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [outsiderStatsPDA] = getUserStatsPDA(program.programId, outsider.publicKey);

      // Create targeted at daree
      await program.methods
        .createDare(dareId, fakeHash(10), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, daree.publicKey)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      try {
        // Outsider tries to accept a dare targeted at someone else
        await program.methods
          .acceptDare()
          .accounts({
            daree: outsider.publicKey,
            dare: darePDA,
            dareeStats: outsiderStatsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([outsider])
          .rpc();
        expect.fail("Should have thrown UnauthorizedDaree");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("UnauthorizedDaree");
      }
    });

    it("rejects self-acceptance", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [statsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(11), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: statsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      try {
        await program.methods
          .acceptDare()
          .accounts({
            daree: challenger.publicKey, // same as challenger
            dare: darePDA,
            dareeStats: statsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();
        expect.fail("Should have thrown CannotAcceptOwnDare");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("CannotAcceptOwnDare");
      }
    });

    it("rejects accepting a PublicBounty", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(12), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { publicBounty: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      try {
        await program.methods
          .acceptDare()
          .accounts({
            daree: daree.publicKey,
            dare: darePDA,
            dareeStats: dareeStatsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([daree])
          .rpc();
        expect.fail("Should have thrown InvalidDareType");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidDareType");
      }
    });
  });

  // --------------------------------------------------------------------------
  // refuse_dare
  // --------------------------------------------------------------------------

  describe("refuse_dare", () => {
    it("targeted daree refuses a DirectDare and challenger gets refund", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(LAMPORTS_PER_SOL);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      // Create a targeted DirectDare
      await program.methods
        .createDare(dareId, fakeHash(80), amount, futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, daree.publicKey)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // Verify vault has SOL
      let vaultBalance = await connection.getBalance(vaultPDA);
      expect(vaultBalance).to.equal(LAMPORTS_PER_SOL);

      const challengerBalanceBefore = await connection.getBalance(challenger.publicKey);

      // Daree refuses
      await program.methods
        .refuseDare()
        .accounts({
          daree: daree.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challenger: challenger.publicKey,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      // Verify dare status is Refused
      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ refused: {} });

      // Verify SOL refunded to challenger
      const challengerBalanceAfter = await connection.getBalance(challenger.publicKey);
      expect(challengerBalanceAfter - challengerBalanceBefore).to.equal(LAMPORTS_PER_SOL);

      // Verify vault is empty
      vaultBalance = await connection.getBalance(vaultPDA);
      expect(vaultBalance).to.equal(0);

      // Verify stats: total_spent should be back to 0
      const stats = await program.account.userStats.fetch(challengerStatsPDA);
      expect(stats.totalSpent.toNumber()).to.equal(0);
    });

    it("rejects refuse from someone who is not the target", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(81), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, daree.publicKey)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      try {
        // Outsider tries to refuse a dare targeted at daree
        await program.methods
          .refuseDare()
          .accounts({
            daree: outsider.publicKey,
            dare: darePDA,
            vault: vaultPDA,
            challenger: challenger.publicKey,
            challengerStats: challengerStatsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([outsider])
          .rpc();
        expect.fail("Should have thrown UnauthorizedDaree");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("UnauthorizedDaree");
      }
    });

    it("rejects refuse on an open (non-targeted) dare", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      // Create an open DirectDare (no target)
      await program.methods
        .createDare(dareId, fakeHash(82), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      try {
        await program.methods
          .refuseDare()
          .accounts({
            daree: daree.publicKey,
            dare: darePDA,
            vault: vaultPDA,
            challenger: challenger.publicKey,
            challengerStats: challengerStatsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([daree])
          .rpc();
        expect.fail("Should have thrown NotTargetedDare");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("NotTargetedDare");
      }
    });

    it("rejects refuse on a PublicBounty", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(83), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { publicBounty: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey,
          dare: darePDA,
          vault: vaultPDA,
          challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      try {
        await program.methods
          .refuseDare()
          .accounts({
            daree: daree.publicKey,
            dare: darePDA,
            vault: vaultPDA,
            challenger: challenger.publicKey,
            challengerStats: challengerStatsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([daree])
          .rpc();
        expect.fail("Should have thrown InvalidDareType");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidDareType");
      }
    });
  });

  // --------------------------------------------------------------------------
  // submit_proof
  // --------------------------------------------------------------------------

  describe("submit_proof", () => {
    it("daree submits proof for a DirectDare", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);

      // Create + Accept
      await program.methods
        .createDare(dareId, fakeHash(20), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      await program.methods
        .acceptDare()
        .accounts({
          daree: daree.publicKey, dare: darePDA, dareeStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      // Submit proof
      const proofHash = fakeHash(42);
      await program.methods
        .submitProof(proofHash)
        .accounts({
          submitter: daree.publicKey, dare: darePDA, submitterStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ proofSubmitted: {} });
      expect(dareAccount.hasProof).to.be.true;
      expect(dareAccount.proofHash).to.deep.equal(proofHash);
    });

    it("anyone submits proof for a PublicBounty", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [outsiderStatsPDA] = getUserStatsPDA(program.programId, outsider.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(21), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { publicBounty: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // Outsider submits proof directly (no accept step needed)
      await program.methods
        .submitProof(fakeHash(43))
        .accounts({
          submitter: outsider.publicKey, dare: darePDA, submitterStats: outsiderStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([outsider])
        .rpc();

      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ proofSubmitted: {} });
      expect(dareAccount.hasDaree).to.be.true;
      expect(dareAccount.daree.toBase58()).to.equal(outsider.publicKey.toBase58());

      // Check dares_accepted was incremented for PublicBounty
      const stats = await program.account.userStats.fetch(outsiderStatsPDA);
      expect(stats.daresAccepted).to.equal(1);
    });

    it("rejects proof from non-daree on DirectDare", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);
      const [outsiderStatsPDA] = getUserStatsPDA(program.programId, outsider.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(22), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      await program.methods
        .acceptDare()
        .accounts({
          daree: daree.publicKey, dare: darePDA, dareeStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      try {
        await program.methods
          .submitProof(fakeHash(44))
          .accounts({
            submitter: outsider.publicKey, dare: darePDA, submitterStats: outsiderStatsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([outsider])
          .rpc();
        expect.fail("Should have thrown UnauthorizedDaree");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("UnauthorizedDaree");
      }
    });
  });

  // --------------------------------------------------------------------------
  // approve_dare
  // --------------------------------------------------------------------------

  describe("approve_dare", () => {
    it("challenger approves and SOL goes to daree", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(LAMPORTS_PER_SOL);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);

      // Create → Accept → Submit Proof
      await program.methods
        .createDare(dareId, fakeHash(30), amount, futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      await program.methods.acceptDare()
        .accounts({
          daree: daree.publicKey, dare: darePDA, dareeStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      await program.methods.submitProof(fakeHash(45))
        .accounts({
          submitter: daree.publicKey, dare: darePDA, submitterStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      // Record balances before approval
      const dareeBalanceBefore = await connection.getBalance(daree.publicKey);

      // Approve
      await program.methods.approveDare()
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          daree: daree.publicKey, dareeStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // Verify dare completed
      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ completed: {} });
      expect(dareAccount.completedAt.toNumber()).to.be.greaterThan(0);

      // Verify SOL transferred to daree
      const dareeBalanceAfter = await connection.getBalance(daree.publicKey);
      expect(dareeBalanceAfter - dareeBalanceBefore).to.equal(LAMPORTS_PER_SOL);

      // Verify vault is empty
      const vaultBalance = await connection.getBalance(vaultPDA);
      expect(vaultBalance).to.equal(0);

      // Verify daree stats
      const stats = await program.account.userStats.fetch(dareeStatsPDA);
      expect(stats.daresCompleted).to.equal(1);
      expect(stats.totalEarned.toNumber()).to.equal(LAMPORTS_PER_SOL);
    });

    it("rejects approval from non-challenger", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);
      const [outsiderStatsPDA] = getUserStatsPDA(program.programId, outsider.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(31), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      await program.methods.acceptDare()
        .accounts({ daree: daree.publicKey, dare: darePDA, dareeStats: dareeStatsPDA, systemProgram: SystemProgram.programId })
        .signers([daree])
        .rpc();

      await program.methods.submitProof(fakeHash(46))
        .accounts({ submitter: daree.publicKey, dare: darePDA, submitterStats: dareeStatsPDA, systemProgram: SystemProgram.programId })
        .signers([daree])
        .rpc();

      try {
        // Outsider tries to approve
        await program.methods.approveDare()
          .accounts({
            challenger: outsider.publicKey, dare: darePDA, vault: vaultPDA,
            daree: daree.publicKey, dareeStats: dareeStatsPDA,
            systemProgram: SystemProgram.programId,
          })
          .signers([outsider])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // has_one constraint will fail
        expect(err).to.exist;
      }
    });
  });

  // --------------------------------------------------------------------------
  // reject_dare
  // --------------------------------------------------------------------------

  describe("reject_dare", () => {
    it("challenger rejects proof and daree can re-submit", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);

      // Create → Accept → Submit Proof
      await program.methods
        .createDare(dareId, fakeHash(40), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      await program.methods.acceptDare()
        .accounts({ daree: daree.publicKey, dare: darePDA, dareeStats: dareeStatsPDA, systemProgram: SystemProgram.programId })
        .signers([daree])
        .rpc();

      await program.methods.submitProof(fakeHash(47))
        .accounts({ submitter: daree.publicKey, dare: darePDA, submitterStats: dareeStatsPDA, systemProgram: SystemProgram.programId })
        .signers([daree])
        .rpc();

      // Reject proof
      await program.methods.rejectDare()
        .accounts({ challenger: challenger.publicKey, dare: darePDA })
        .signers([challenger])
        .rpc();

      let dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ rejected: {} });
      expect(dareAccount.hasProof).to.be.false;

      // Re-submit proof with new hash
      const newProofHash = fakeHash(99);
      await program.methods.submitProof(newProofHash)
        .accounts({ submitter: daree.publicKey, dare: darePDA, submitterStats: dareeStatsPDA, systemProgram: SystemProgram.programId })
        .signers([daree])
        .rpc();

      dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ proofSubmitted: {} });
      expect(dareAccount.hasProof).to.be.true;
      expect(dareAccount.proofHash).to.deep.equal(newProofHash);
    });
  });

  // --------------------------------------------------------------------------
  // cancel_dare
  // --------------------------------------------------------------------------

  describe("cancel_dare", () => {
    it("challenger cancels and gets refund", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(LAMPORTS_PER_SOL);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [statsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(50), amount, futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: statsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      const balanceBefore = await connection.getBalance(challenger.publicKey);

      await program.methods.cancelDare()
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: statsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // Verify refund
      const balanceAfter = await connection.getBalance(challenger.publicKey);
      // Balance should increase by ~1 SOL (minus tx fee)
      expect(balanceAfter - balanceBefore).to.be.greaterThan(0.99 * LAMPORTS_PER_SOL);

      // Verify dare state
      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ cancelled: {} });

      // Verify stats: total_spent should be back to 0
      const stats = await program.account.userStats.fetch(statsPDA);
      expect(stats.totalSpent.toNumber()).to.equal(0);
    });

    it("rejects cancel after dare is accepted", async () => {
      const dareId = new BN(++dareIdCounter);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);

      await program.methods
        .createDare(dareId, fakeHash(51), new BN(LAMPORTS_PER_SOL), futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      await program.methods.acceptDare()
        .accounts({ daree: daree.publicKey, dare: darePDA, dareeStats: dareeStatsPDA, systemProgram: SystemProgram.programId })
        .signers([daree])
        .rpc();

      try {
        await program.methods.cancelDare()
          .accounts({
            challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
            challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
          })
          .signers([challenger])
          .rpc();
        expect.fail("Should have thrown InvalidDareStatus");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidDareStatus");
      }
    });
  });

  // --------------------------------------------------------------------------
  // Full lifecycle tests
  // --------------------------------------------------------------------------

  describe("full lifecycle", () => {
    it("DirectDare: create → accept → proof → approve", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(2 * LAMPORTS_PER_SOL);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [dareeStatsPDA] = getUserStatsPDA(program.programId, daree.publicKey);

      const dareeBalanceBefore = await connection.getBalance(daree.publicKey);

      // 1. Create
      await program.methods
        .createDare(dareId, fakeHash(60), amount, futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // 2. Accept
      await program.methods.acceptDare()
        .accounts({ daree: daree.publicKey, dare: darePDA, dareeStats: dareeStatsPDA, systemProgram: SystemProgram.programId })
        .signers([daree])
        .rpc();

      // 3. Submit proof
      await program.methods.submitProof(fakeHash(61))
        .accounts({ submitter: daree.publicKey, dare: darePDA, submitterStats: dareeStatsPDA, systemProgram: SystemProgram.programId })
        .signers([daree])
        .rpc();

      // 4. Approve
      await program.methods.approveDare()
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          daree: daree.publicKey, dareeStats: dareeStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // Final verification
      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ completed: {} });

      const dareeBalanceAfter = await connection.getBalance(daree.publicKey);
      const dareeGain = dareeBalanceAfter - dareeBalanceBefore;
      expect(dareeGain).to.be.greaterThan(1.99 * LAMPORTS_PER_SOL);

      // Stats
      const dareeStats = await program.account.userStats.fetch(dareeStatsPDA);
      expect(dareeStats.daresAccepted).to.equal(1);
      expect(dareeStats.daresCompleted).to.equal(1);
      expect(dareeStats.totalEarned.toNumber()).to.equal(2 * LAMPORTS_PER_SOL);
    });

    it("PublicBounty: create → proof → approve", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(LAMPORTS_PER_SOL);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);
      const [outsiderStatsPDA] = getUserStatsPDA(program.programId, outsider.publicKey);

      // 1. Create PublicBounty
      await program.methods
        .createDare(dareId, fakeHash(70), amount, futureTimestamp(86400), { publicBounty: {} }, { challengerSelect: {} }, PublicKey.default)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // 2. Outsider submits proof directly (skips accept)
      await program.methods.submitProof(fakeHash(71))
        .accounts({ submitter: outsider.publicKey, dare: darePDA, submitterStats: outsiderStatsPDA, systemProgram: SystemProgram.programId })
        .signers([outsider])
        .rpc();

      // 3. Challenger approves
      await program.methods.approveDare()
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          daree: outsider.publicKey, dareeStats: outsiderStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ completed: {} });
      expect(dareAccount.daree.toBase58()).to.equal(outsider.publicKey.toBase58());
    });

    it("Targeted DirectDare: create → refuse (refund lifecycle)", async () => {
      const dareId = new BN(++dareIdCounter);
      const amount = new BN(LAMPORTS_PER_SOL);
      const [darePDA] = getDarePDA(program.programId, challenger.publicKey, dareId);
      const [vaultPDA] = getVaultPDA(program.programId, darePDA);
      const [challengerStatsPDA] = getUserStatsPDA(program.programId, challenger.publicKey);

      const challengerBefore = await connection.getBalance(challenger.publicKey);

      // 1. Create targeted dare
      await program.methods
        .createDare(dareId, fakeHash(90), amount, futureTimestamp(86400), { directDare: {} }, { challengerSelect: {} }, daree.publicKey)
        .accounts({
          challenger: challenger.publicKey, dare: darePDA, vault: vaultPDA,
          challengerStats: challengerStatsPDA, systemProgram: SystemProgram.programId,
        })
        .signers([challenger])
        .rpc();

      // 2. Daree refuses
      await program.methods.refuseDare()
        .accounts({
          daree: daree.publicKey, dare: darePDA, vault: vaultPDA,
          challenger: challenger.publicKey, challengerStats: challengerStatsPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([daree])
        .rpc();

      // Verify final state
      const dareAccount = await program.account.dare.fetch(darePDA);
      expect(dareAccount.status).to.deep.equal({ refused: {} });

      const vaultBalance = await connection.getBalance(vaultPDA);
      expect(vaultBalance).to.equal(0);

      const stats = await program.account.userStats.fetch(challengerStatsPDA);
      expect(stats.totalSpent.toNumber()).to.equal(0);
    });
  });
});
