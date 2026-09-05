import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureDataDirSecrets } from "./secrets";

const KEY_GENERATION_TIMEOUT_MS = 120_000;

// lets a test stand in for a second replica winning the create, or for a
// DATA_DIR the container has no write access to
const hooks = vi.hoisted(() => ({
   beforeWrite: null as ((path: string) => void) | null,
   failWith: null as Error | null,
}));

vi.mock("node:fs", async (importOriginal) => {
   const actual = await importOriginal<typeof import("node:fs")>();
   const writeFileSync: typeof actual.writeFileSync = (path, data, options) => {
      if (hooks.failWith) throw hooks.failWith;
      hooks.beforeWrite?.(String(path));
      actual.writeFileSync(path, data, options);
   };
   return { ...actual, writeFileSync };
});

const tempDir = (): string => mkdtempSync(join(tmpdir(), "s3v-secrets-"));

const rsaPem = (): string =>
   generateKeyPairSync("rsa", { modulusLength: 2048 })
      .privateKey.export({ type: "pkcs8", format: "pem" })
      .toString();

afterEach(() => {
   hooks.beforeWrite = null;
   hooks.failWith = null;
   vi.restoreAllMocks();
});

describe("ensureDataDirSecrets", () => {
   it("does nothing without DATA_DIR", () => {
      const env: NodeJS.ProcessEnv = {};
      ensureDataDirSecrets(env);
      expect(env).toEqual({});
   });

   it("leaves configured secrets alone and writes nothing", () => {
      const dir = tempDir();
      const env: NodeJS.ProcessEnv = {
         DATA_DIR: dir,
         BETTER_AUTH_SECRET: "already-set",
         ENCRYPTION_PRIVATE_KEY: "already-set",
      };
      ensureDataDirSecrets(env);
      expect(env.BETTER_AUTH_SECRET).toBe("already-set");
      expect(() => statSync(join(dir, "auth-secret"))).toThrow();
      expect(() => statSync(join(dir, "encryption-private-key.pem"))).toThrow();
   });

   it(
      "generates both secrets into DATA_DIR with mode 0600",
      { timeout: KEY_GENERATION_TIMEOUT_MS },
      () => {
         const dir = join(tempDir(), "nested");
         const env: NodeJS.ProcessEnv = { DATA_DIR: dir };
         ensureDataDirSecrets(env);

         const secret = env.BETTER_AUTH_SECRET ?? "";
         expect(Buffer.from(secret, "base64")).toHaveLength(32);
         expect(secret.length).toBeGreaterThanOrEqual(32);

         const key = createPrivateKey(env.ENCRYPTION_PRIVATE_KEY ?? "");
         expect(key.asymmetricKeyType).toBe("rsa");
         expect(key.asymmetricKeyDetails?.modulusLength).toBe(4096);

         for (const [file, value] of [
            ["auth-secret", secret],
            ["encryption-private-key.pem", env.ENCRYPTION_PRIVATE_KEY],
         ] as const) {
            const path = join(dir, file);
            expect(statSync(path).mode & 0o777).toBe(0o600);
            expect(readFileSync(path, "utf8").trim()).toBe(value?.trim());
         }
      }
   );

   it("reads the persisted secrets back on the next boot", () => {
      const dir = tempDir();
      const pem = rsaPem();
      writeFileSync(join(dir, "auth-secret"), "persisted-secret\n");
      writeFileSync(join(dir, "encryption-private-key.pem"), pem);

      const env: NodeJS.ProcessEnv = { DATA_DIR: dir };
      ensureDataDirSecrets(env);
      expect(env.BETTER_AUTH_SECRET).toBe("persisted-secret");
      expect(env.ENCRYPTION_PRIVATE_KEY).toBe(pem.trim());
   });

   // two replicas booting against one fresh volume: both find nothing, both
   // generate, and only one create can win
   it("adopts the value another replica wrote when the create races", () => {
      const dir = tempDir();
      const pem = rsaPem();
      writeFileSync(join(dir, "encryption-private-key.pem"), pem);
      hooks.beforeWrite = (path) => {
         hooks.beforeWrite = null;
         writeFileSync(path, "the-other-replica\n");
      };

      const env: NodeJS.ProcessEnv = { DATA_DIR: dir };
      ensureDataDirSecrets(env);
      expect(env.BETTER_AUTH_SECRET).toBe("the-other-replica");
      expect(readFileSync(join(dir, "auth-secret"), "utf8")).toBe(
         "the-other-replica\n"
      );
      expect(env.ENCRYPTION_PRIVATE_KEY).toBe(pem.trim());
   });

   it("names DATA_DIR, the file and the uid when the volume is read-only", () => {
      const dir = tempDir();
      const denied: NodeJS.ErrnoException = new Error(
         "EACCES: permission denied, open"
      );
      denied.code = "EACCES";
      hooks.failWith = denied;

      let thrown: unknown;
      try {
         ensureDataDirSecrets({ DATA_DIR: dir });
      } catch (error) {
         thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      const { message, cause } = thrown as Error;
      expect(message).toContain("DATA_DIR");
      expect(message).toContain(dir);
      expect(message).toContain(join(dir, "auth-secret"));
      expect(message).toContain(
         process.getuid ? `uid ${String(process.getuid())}` : "this user"
      );
      expect(message).not.toContain("EACCES");
      expect(cause).toBe(denied);
   });
});
