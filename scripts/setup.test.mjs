import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generate = vi.hoisted(() => vi.fn());
vi.mock("node:crypto", async (importOriginal) => {
   const crypto = await importOriginal();
   generate.mockImplementation((type) =>
      crypto.generateKeyPairSync(type, { modulusLength: 1024 })
   );
   return { ...crypto, generateKeyPairSync: generate };
});
const { clearComposeProfiles, resolveSecrets } = await import("./setup.mjs");

const pem = generateKeyPairSync("rsa", { modulusLength: 1024 })
   .privateKey.export({ type: "pkcs8", format: "pem" })
   .trim();
const secret = "a".repeat(44);

beforeEach(() => {
   generate.mockClear();
   vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

describe("setup secrets", () => {
   it("keeps the secrets an existing database was set up with", () => {
      expect(
         resolveSecrets({
            BETTER_AUTH_SECRET: secret,
            ENCRYPTION_PRIVATE_KEY: pem,
            AUDIT_CHAIN_KEY: "audit",
         })
      ).toEqual({
         betterAuthSecret: secret,
         encryptionPrivateKey: pem,
         auditChainKey: "audit",
      });
      expect(generate).not.toHaveBeenCalled();
   });

   it.each([
      ["no env file", null],
      [
         "the example's placeholders",
         {
            BETTER_AUTH_SECRET: "your_secret_here",
            ENCRYPTION_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----...",
         },
      ],
      [
         "a key that does not parse",
         { BETTER_AUTH_SECRET: secret, ENCRYPTION_PRIVATE_KEY: "nope" },
      ],
   ])("generates new secrets for %s", (_, existing) => {
      const secrets = resolveSecrets(existing);
      expect(generate).toHaveBeenCalledOnce();
      expect(secrets.betterAuthSecret).toHaveLength(44);
      expect(secrets.encryptionPrivateKey).toMatch(
         /^-----BEGIN PRIVATE KEY-----/
      );
      expect(secrets.auditChainKey).toBe("");
   });
});

describe("setup --no-docker with existing env", () => {
   const cleared =
      "A=1\n\n# Docker services the dev scripts manage for you (docker-compose.dev.yml).\nCOMPOSE_PROFILES=\n";

   it.each([
      [
         "key present",
         "A=1\n\n# Docker services the dev scripts manage for you (docker-compose.dev.yml).\nCOMPOSE_PROFILES=core,demo\n",
      ],
      ["key absent", "A=1\n"],
      ["no trailing newline", "A=1\nCOMPOSE_PROFILES=core"],
      [
         "duplicate key",
         "COMPOSE_PROFILES=core\nA=1\nexport COMPOSE_PROFILES=core\n",
      ],
   ])("leaves exactly one empty COMPOSE_PROFILES (%s)", (_, content) => {
      expect(clearComposeProfiles(content)).toBe(cleared);
   });
});
