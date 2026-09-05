import { logger } from "@/lib/logger";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE_MODE = 0o600;
const AUTH_SECRET_BYTES = 32;
const KEY_MODULUS_BITS = 4096;

type Secret = {
   variable: string;
   file: string;
   generate: () => string;
   warning: string;
};

const SECRETS: readonly Secret[] = [
   {
      variable: "BETTER_AUTH_SECRET",
      file: "auth-secret",
      generate: () => randomBytes(AUTH_SECRET_BYTES).toString("base64"),
      warning: "back this file up; losing it signs every session out",
   },
   {
      variable: "ENCRYPTION_PRIVATE_KEY",
      file: "encryption-private-key.pem",
      generate: () =>
         generateKeyPairSync("rsa", { modulusLength: KEY_MODULUS_BITS })
            .privateKey.export({ type: "pkcs8", format: "pem" })
            .toString(),
      warning:
         "back this file up; losing it makes every stored credential unreadable",
   },
];

const readSecret = (path: string): string | undefined => {
   try {
      return readFileSync(path, "utf8").trim() || undefined;
   } catch {
      return undefined;
   }
};

const isExists = (error: unknown): boolean =>
   error instanceof Error && (error as NodeJS.ErrnoException).code === "EEXIST";

const runAs = (): string =>
   typeof process.getuid === "function"
      ? `uid ${String(process.getuid())}`
      : "this user";

const unusable = (dir: string, path: string, cause: unknown): Error =>
   new Error(
      `Could not persist ${path}: DATA_DIR (${dir}) must be readable and writable by the user this process runs as (${runAs()}). Fix the ownership of the directory or volume mounted there and restart.`,
      { cause }
   );

// `wx` makes the create atomic, so two replicas booting against the same fresh
// volume can't each generate a secret and overwrite the other: the loser reads
// back what the winner wrote.
const ensureSecret = (dir: string, secret: Secret): string => {
   const path = join(dir, secret.file);
   const existing = readSecret(path);
   if (existing) return existing;
   const value = secret.generate().trim();
   try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, `${value}\n`, { mode: FILE_MODE, flag: "wx" });
      chmodSync(path, FILE_MODE);
   } catch (error) {
      const written = isExists(error) ? readSecret(path) : undefined;
      if (written) return written;
      throw unusable(dir, path, error);
   }
   logger.warn(`generated ${secret.variable} into ${path} — ${secret.warning}`);
   return value;
};

// DATA_DIR is what makes a zero-config install work: the secrets a self-hoster
// would otherwise have to invent are generated once into the volume and read
// back on every later boot. Must run before validation, so zod sees the
// resolved values, and before packages/auth reads BETTER_AUTH_SECRET at import
const ensureDataDirSecrets = (env: NodeJS.ProcessEnv = process.env): void => {
   const dir = env.DATA_DIR?.trim();
   if (!dir) return;
   for (const secret of SECRETS) {
      if (env[secret.variable]?.trim()) continue;
      env[secret.variable] = ensureSecret(dir, secret);
   }
};

export { ensureDataDirSecrets };
