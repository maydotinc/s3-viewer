import { generateKeyPairSync, hkdfSync } from "node:crypto";
import {
   chmodSync,
   mkdirSync,
   mkdtempSync,
   readFileSync,
   rmSync,
   statSync,
   symlinkSync,
   writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
   afterEach,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

const state = vi.hoisted(() => ({
   privateKey: "",
   acceptNewKey: false,
   auditChainKey: undefined as string | undefined,
   acceptNewAuditChainKey: false,
   rows: new Map<string, string>(),
   findUnique: vi.fn(),
   create: vi.fn(),
   update: vi.fn(),
   auditLogFindFirst: vi.fn(),
   warn: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
   env: {
      get ENCRYPTION_PRIVATE_KEY() {
         return state.privateKey;
      },
      get ACCEPT_NEW_ENCRYPTION_KEY() {
         return state.acceptNewKey;
      },
      get AUDIT_CHAIN_KEY() {
         return state.auditChainKey;
      },
      get ACCEPT_NEW_AUDIT_CHAIN_KEY() {
         return state.acceptNewAuditChainKey;
      },
      BETTER_AUTH_SECRET: "regression-test-secret-at-least-thirty-two-chars",
   },
}));
vi.mock("@/lib/logger", () => ({
   logger: { warn: state.warn, info: vi.fn() },
}));
vi.mock("@s3-viewer/db", () => ({
   prisma: {
      instanceSecret: {
         findUnique: state.findUnique,
         create: state.create,
         update: state.update,
      },
      auditLog: {
         findFirst: state.auditLogFindFirst,
      },
   },
}));

class PrismaKnownError extends Error {
   constructor(public readonly code: string) {
      super(code);
   }
}
vi.mock("@prisma/client", () => ({
   Prisma: { PrismaClientKnownRequestError: PrismaKnownError },
}));

const {
   assertInstanceSecrets,
   auditChainKeyFingerprint,
   encryptionKeyFingerprint,
} = await import("./instance-secrets");

const generateKey = () =>
   generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
   }).privateKey;

// duplicated on purpose so a change to either derivation fails here.
const legacyAuditChainKey = (authSecret: string): Buffer =>
   Buffer.from(hkdfSync("sha256", authSecret, "", "s3-viewer audit chain", 32));

const tempDir = (): string =>
   mkdtempSync(join(tmpdir(), "s3v-instance-secrets-"));

beforeAll(() => {
   state.privateKey = generateKey();
});

beforeEach(() => {
   state.rows.clear();
   state.acceptNewKey = false;
   state.auditChainKey = undefined;
   state.acceptNewAuditChainKey = false;
   state.warn.mockReset();
   delete process.env.DATA_DIR;
   state.findUnique.mockReset().mockImplementation(async ({ where }) => {
      const fingerprint = state.rows.get(where.name);
      return fingerprint === undefined ? null : { fingerprint };
   });
   state.create.mockReset().mockImplementation(async ({ data }) => {
      if (state.rows.has(data.name)) throw new PrismaKnownError("P2002");
      state.rows.set(data.name, data.fingerprint);
      return data;
   });
   state.update.mockReset().mockImplementation(async ({ where, data }) => {
      state.rows.set(where.name, data.fingerprint);
      return data;
   });
   state.auditLogFindFirst.mockReset().mockResolvedValue(null);
});

afterEach(() => {
   delete process.env.DATA_DIR;
});

describe("instance secrets", () => {
   it("records both fingerprints on a first boot and accepts them on the next", async () => {
      await assertInstanceSecrets();
      expect(state.rows.get("encryption-key")).toBe(encryptionKeyFingerprint());
      expect(state.rows.get("auth-secret")).toMatch(/^[0-9a-f]{64}$/);
      state.create.mockClear();
      await assertInstanceSecrets();
      expect(state.create).not.toHaveBeenCalled();
      expect(state.warn).not.toHaveBeenCalled();
   });

   it("never stores the auth secret itself", async () => {
      await assertInstanceSecrets(
         "a-secret-nobody-should-find-in-the-database"
      );
      for (const fingerprint of state.rows.values()) {
         expect(fingerprint).not.toContain("nobody-should-find");
      }
   });

   it("refuses to boot with a key the database has never seen", async () => {
      state.rows.set("encryption-key", "someone-elses-key");
      await expect(assertInstanceSecrets()).rejects.toThrow(
         /not the key this database's credentials were encrypted with/
      );
      expect(state.update).not.toHaveBeenCalled();
   });

   it("re-records the key when the operator has accepted losing the old one", async () => {
      state.rows.set("encryption-key", "someone-elses-key");
      state.acceptNewKey = true;
      await assertInstanceSecrets();
      expect(state.rows.get("encryption-key")).toBe(encryptionKeyFingerprint());
      expect(state.warn).toHaveBeenCalledWith(
         expect.stringContaining("ACCEPT_NEW_ENCRYPTION_KEY")
      );
   });

   it("warns about a divergent auth secret but keeps serving, once AUDIT_CHAIN_KEY decouples the audit log from it", async () => {
      state.auditChainKey = Buffer.alloc(32, 3).toString("base64");
      await assertInstanceSecrets(
         "first-secret-at-least-thirty-two-characters"
      );
      await assertInstanceSecrets(
         "second-secret-at-least-thirty-two-characters"
      );
      expect(state.warn).toHaveBeenCalledWith(
         expect.stringContaining("BETTER_AUTH_SECRET differs")
      );
   });

   it("reads the winner's row when two replicas record the first boot at once", async () => {
      state.findUnique.mockImplementationOnce(async () => null);
      state.rows.set("encryption-key", "the-other-replica");
      await expect(assertInstanceSecrets()).rejects.toThrow(
         /not the key this database/
      );
   });

   it("only warns when the table has not been migrated yet", async () => {
      state.findUnique.mockRejectedValue(new PrismaKnownError("P2021"));
      await expect(assertInstanceSecrets()).resolves.toEqual(
         legacyAuditChainKey("regression-test-secret-at-least-thirty-two-chars")
      );
      expect(state.warn).toHaveBeenCalledWith(
         expect.stringContaining("instance_secret table is missing")
      );
   });

   it("surfaces any other database failure", async () => {
      state.findUnique.mockRejectedValue(new Error("connection refused"));
      await expect(assertInstanceSecrets()).rejects.toThrow(
         "connection refused"
      );
   });
});

describe("audit chain key", () => {
   const AUTH_SECRET = "regression-test-secret-at-least-thirty-two-chars";

   it("falls back to the legacy BETTER_AUTH_SECRET derivation when unset and no dedicated key is recorded yet", async () => {
      const key = await assertInstanceSecrets();
      expect(key).toEqual(legacyAuditChainKey(AUTH_SECRET));
      expect(state.rows.get("audit-chain-key")).toBe(
         auditChainKeyFingerprint(legacyAuditChainKey(AUTH_SECRET))
      );
   });

   it("keeps deriving from BETTER_AUTH_SECRET across reboots so existing audit rows keep verifying", async () => {
      await assertInstanceSecrets();
      state.create.mockClear();
      const key = await assertInstanceSecrets();
      expect(key).toEqual(legacyAuditChainKey(AUTH_SECRET));
      expect(state.create).not.toHaveBeenCalled();
      expect(state.warn).not.toHaveBeenCalled();
   });

   it("refuses to boot when BETTER_AUTH_SECRET rotates while still relying on the legacy derivation", async () => {
      await assertInstanceSecrets(AUTH_SECRET);
      await expect(
         assertInstanceSecrets(
            "a-different-secret-of-at-least-thirty-two-chars"
         )
      ).rejects.toThrow(/active audit chain key does not match/);
   });

   it("re-records the audit chain key when the operator has accepted losing verifiability of old rows", async () => {
      await assertInstanceSecrets(AUTH_SECRET);
      state.acceptNewAuditChainKey = true;
      const rotated = "a-different-secret-of-at-least-thirty-two-characters";
      const key = await assertInstanceSecrets(rotated);
      expect(key).toEqual(legacyAuditChainKey(rotated));
      expect(state.warn).toHaveBeenCalledWith(
         expect.stringContaining("ACCEPT_NEW_AUDIT_CHAIN_KEY")
      );
   });

   it("prefers an explicitly configured AUDIT_CHAIN_KEY over the legacy derivation", async () => {
      state.auditChainKey = Buffer.alloc(32, 7).toString("base64");
      const key = await assertInstanceSecrets(AUTH_SECRET);
      expect(key).toEqual(Buffer.alloc(32, 7));
      expect(key).not.toEqual(legacyAuditChainKey(AUTH_SECRET));
   });

   it("does not query for existing audit history once a dedicated key is configured", async () => {
      state.auditChainKey = Buffer.alloc(32, 9).toString("base64");
      await assertInstanceSecrets(AUTH_SECRET);
      expect(state.auditLogFindFirst).not.toHaveBeenCalled();
   });

   it("keeps the legacy derivation for an install with existing audit history, even with DATA_DIR available", async () => {
      const dir = tempDir();
      try {
         process.env.DATA_DIR = dir;
         state.auditLogFindFirst.mockResolvedValue({ id: "row-1" });
         const key = await assertInstanceSecrets(AUTH_SECRET);
         expect(key).toEqual(legacyAuditChainKey(AUTH_SECRET));
         expect(() => statSync(join(dir, "audit-chain-key"))).toThrow();
      } finally {
         rmSync(dir, { recursive: true, force: true });
      }
   });

   it("generates and persists a dedicated key into DATA_DIR for a fresh install with no audit history", async () => {
      const dir = tempDir();
      try {
         process.env.DATA_DIR = dir;
         const key = await assertInstanceSecrets(AUTH_SECRET);
         expect(key).not.toEqual(legacyAuditChainKey(AUTH_SECRET));
         const path = join(dir, "audit-chain-key");
         expect(statSync(path).mode & 0o777).toBe(0o600);
         expect(
            Buffer.from(readFileSync(path, "utf8").trim(), "base64")
         ).toEqual(key);
      } finally {
         rmSync(dir, { recursive: true, force: true });
      }
   });

   it("adopts the key another replica persisted while this one was booting", async () => {
      const dir = tempDir();
      try {
         process.env.DATA_DIR = dir;
         const theirs = Buffer.alloc(32, 9);
         state.auditLogFindFirst.mockImplementation(async () => {
            writeFileSync(
               join(dir, "audit-chain-key"),
               `${theirs.toString("base64")}\n`
            );
            return null;
         });
         expect(await assertInstanceSecrets(AUTH_SECRET)).toEqual(theirs);
         expect(state.warn).not.toHaveBeenCalledWith(
            expect.stringContaining("generated AUDIT_CHAIN_KEY")
         );
      } finally {
         rmSync(dir, { recursive: true, force: true });
      }
   });

   it.skipIf(process.getuid?.() === 0)(
      "names DATA_DIR, the file and the uid when the key cannot be persisted",
      async () => {
         const dir = tempDir();
         try {
            chmodSync(dir, 0o500);
            process.env.DATA_DIR = dir;
            await expect(assertInstanceSecrets(AUTH_SECRET)).rejects.toThrow(
               `Could not persist ${join(dir, "audit-chain-key")}: DATA_DIR (${dir}) must be readable and writable by the user this process runs as (uid ${String(process.getuid?.())})`
            );
         } finally {
            chmodSync(dir, 0o700);
            rmSync(dir, { recursive: true, force: true });
         }
      }
   );

   it("reads a key already persisted in DATA_DIR back on the next boot without touching the database", async () => {
      const dir = tempDir();
      try {
         process.env.DATA_DIR = dir;
         const first = await assertInstanceSecrets(AUTH_SECRET);
         state.auditLogFindFirst.mockClear();
         const second = await assertInstanceSecrets(AUTH_SECRET);
         expect(second).toEqual(first);
         expect(state.auditLogFindFirst).not.toHaveBeenCalled();
      } finally {
         rmSync(dir, { recursive: true, force: true });
      }
   });

   it("rejects a corrupt persisted key before missing-table checks can bypass validation", async () => {
      const dir = tempDir();
      try {
         process.env.DATA_DIR = dir;
         writeFileSync(join(dir, "audit-chain-key"), "!!!!");
         state.findUnique.mockRejectedValue(new PrismaKnownError("P2021"));
         await expect(assertInstanceSecrets()).rejects.toThrow(
            /Invalid persisted AUDIT_CHAIN_KEY/
         );
         expect(state.findUnique).not.toHaveBeenCalled();
         expect(state.warn).not.toHaveBeenCalled();
      } finally {
         rmSync(dir, { recursive: true, force: true });
      }
   });

   it.each(["persisted", "environment", "missing"])(
      "preserves the %s key choice when the instance-secret table is missing",
      async (source) => {
         const dir = tempDir();
         try {
            process.env.DATA_DIR = dir;
            const path = join(dir, "audit-chain-key");
            const key = Buffer.alloc(32, 7);
            if (source === "persisted") {
               writeFileSync(path, `${key.toString("base64")}\n`);
            } else if (source === "environment") {
               state.auditChainKey = key.toString("base64");
               writeFileSync(path, "!!!!");
            }
            state.findUnique.mockRejectedValue(new PrismaKnownError("P2021"));
            await expect(assertInstanceSecrets()).resolves.toEqual(
               source === "missing" ? legacyAuditChainKey(AUTH_SECRET) : key
            );
            expect(state.auditLogFindFirst).not.toHaveBeenCalled();
            expect(state.warn).toHaveBeenCalledWith(
               expect.stringContaining("instance_secret table is missing")
            );
            if (source === "missing") expect(() => statSync(path)).toThrow();
         } finally {
            rmSync(dir, { recursive: true, force: true });
         }
      }
   );

   it.each([
      ["non-base64", "!!!!"],
      ["empty", ""],
      ["whitespace", " \n\t"],
      ["short", Buffer.alloc(16, 1).toString("base64")],
      ["corrupt", `${Buffer.alloc(32, 1).toString("base64")}!`],
   ])(
      "rejects a %s persisted key even when key replacement is accepted",
      async (_name, contents) => {
         const dir = tempDir();
         try {
            process.env.DATA_DIR = dir;
            const path = join(dir, "audit-chain-key");
            writeFileSync(path, contents);
            for (const acceptReplacement of [false, true]) {
               state.acceptNewAuditChainKey = acceptReplacement;
               if (acceptReplacement) {
                  state.rows.set("audit-chain-key", "previous-fingerprint");
               }
               await expect(assertInstanceSecrets()).rejects.toThrow(
                  /Invalid persisted AUDIT_CHAIN_KEY/
               );
               expect(state.rows.get("audit-chain-key")).toBe(
                  acceptReplacement ? "previous-fingerprint" : undefined
               );
               expect(readFileSync(path, "utf8")).toBe(contents);
               expect(state.auditLogFindFirst).not.toHaveBeenCalled();
            }
         } finally {
            rmSync(dir, { recursive: true, force: true });
         }
      }
   );

   it.each(["directory", "broken symlink"])(
      "fails clearly for an unreadable persisted key (%s) instead of using the legacy key",
      async (kind) => {
         const dir = tempDir();
         try {
            process.env.DATA_DIR = dir;
            const path = join(dir, "audit-chain-key");
            if (kind === "directory") mkdirSync(path);
            else symlinkSync(join(dir, "missing-key"), path);
            state.auditLogFindFirst.mockResolvedValue({ id: "existing-row" });
            await expect(assertInstanceSecrets()).rejects.toThrow(
               /Could not read .*audit-chain-key: the persisted AUDIT_CHAIN_KEY must be readable/
            );
            expect(state.rows.has("audit-chain-key")).toBe(false);
            expect(state.auditLogFindFirst).not.toHaveBeenCalled();
         } finally {
            rmSync(dir, { recursive: true, force: true });
         }
      }
   );

   it("preserves a valid supplied key file across restarts and auth-secret rotation", async () => {
      const dir = tempDir();
      try {
         process.env.DATA_DIR = dir;
         const key = Buffer.alloc(48, 7);
         const path = join(dir, "audit-chain-key");
         const contents = ` ${key.toString("base64")}\n`;
         writeFileSync(path, contents);
         expect(await assertInstanceSecrets(AUTH_SECRET)).toEqual(key);
         expect(
            await assertInstanceSecrets("a-different-auth-secret-on-restart")
         ).toEqual(key);
         expect(readFileSync(path, "utf8")).toBe(contents);
         expect(state.auditLogFindFirst).not.toHaveBeenCalled();
      } finally {
         rmSync(dir, { recursive: true, force: true });
      }
   });
});
