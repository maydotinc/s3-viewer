import { createPrivateKey } from "node:crypto";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureDataDirSecrets } from "./secrets";

const hooks = vi.hoisted(() => ({
   beforeWrite: null as ((path: string) => void) | null,
   failWith: null as Error | null,
   modulusLengths: [] as number[],
}));

// a 4096-bit key takes most of a second to generate; record the size asked for and make a small one.
vi.mock("node:crypto", async (importOriginal) => {
   const actual = await importOriginal<typeof import("node:crypto")>();
   const generateKeyPairSync = ((
      type: "rsa",
      options: { modulusLength: number }
   ) => {
      hooks.modulusLengths.push(options.modulusLength);
      return actual.generateKeyPairSync(type, {
         ...options,
         modulusLength: 1024,
      });
   }) as typeof actual.generateKeyPairSync;
   return { ...actual, generateKeyPairSync };
});

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

// the secrets are read back as opaque text, so any PEM-shaped value will do.
const PEM =
   "-----BEGIN PRIVATE KEY-----\npersisted\n-----END PRIVATE KEY-----\n";

afterEach(() => {
   hooks.beforeWrite = null;
   hooks.failWith = null;
   hooks.modulusLengths = [];
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

   it("generates both secrets into DATA_DIR with mode 0600", () => {
      const dir = join(tempDir(), "nested");
      const env: NodeJS.ProcessEnv = { DATA_DIR: dir };
      ensureDataDirSecrets(env);

      const secret = env.BETTER_AUTH_SECRET ?? "";
      expect(Buffer.from(secret, "base64")).toHaveLength(32);
      expect(secret.length).toBeGreaterThanOrEqual(32);

      const key = createPrivateKey(env.ENCRYPTION_PRIVATE_KEY ?? "");
      expect(key.asymmetricKeyType).toBe("rsa");
      expect(hooks.modulusLengths).toEqual([4096]);

      for (const [file, value] of [
         ["auth-secret", secret],
         ["encryption-private-key.pem", env.ENCRYPTION_PRIVATE_KEY],
      ] as const) {
         const path = join(dir, file);
         expect(statSync(path).mode & 0o777).toBe(0o600);
         expect(readFileSync(path, "utf8").trim()).toBe(value?.trim());
      }
   });

   it("reads the persisted secrets back on the next boot", () => {
      const dir = tempDir();
      writeFileSync(join(dir, "auth-secret"), "persisted-secret\n");
      writeFileSync(join(dir, "encryption-private-key.pem"), PEM);

      const env: NodeJS.ProcessEnv = { DATA_DIR: dir };
      ensureDataDirSecrets(env);
      expect(env.BETTER_AUTH_SECRET).toBe("persisted-secret");
      expect(env.ENCRYPTION_PRIVATE_KEY).toBe(PEM.trim());
   });

   it("adopts the value another replica wrote when the create races", () => {
      const dir = tempDir();
      writeFileSync(join(dir, "encryption-private-key.pem"), PEM);
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
      expect(env.ENCRYPTION_PRIVATE_KEY).toBe(PEM.trim());
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
