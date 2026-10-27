import { logger } from "@/lib/logger";
import { optionalString } from "@s3-viewer/shared/env";
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
   // a reader that validates what it finds, for secrets a stray file must not silently replace.
   read?: (path: string) => string | undefined;
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

const persistSecretFile = <T>(
   dir: string,
   path: string,
   contents: string,
   readBack: () => T | undefined
): T | undefined => {
   try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, contents, { mode: FILE_MODE, flag: "wx" });
      chmodSync(path, FILE_MODE);
      return undefined;
   } catch (error) {
      const written = isExists(error) ? readBack() : undefined;
      if (written !== undefined) return written;
      throw unusable(dir, path, error);
   }
};

const ensureSecret = (dir: string, secret: Secret): string => {
   const read = secret.read ?? readSecret;
   const path = join(dir, secret.file);
   const existing = read(path);
   if (existing) return existing;
   const value = secret.generate().trim();
   const raced = persistSecretFile(dir, path, `${value}\n`, () => read(path));
   if (raced !== undefined) return raced;
   logger.warn(`generated ${secret.variable} into ${path} — ${secret.warning}`);
   return value;
};

const ensureDataDirSecrets = (env: NodeJS.ProcessEnv = process.env): void => {
   const dir = optionalString.parse(env.DATA_DIR);
   if (!dir) return;
   for (const secret of SECRETS) {
      if (env[secret.variable]?.trim()) continue;
      env[secret.variable] = ensureSecret(dir, secret);
   }
};

export { ensureDataDirSecrets, ensureSecret };
export type { Secret };
