import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { auditChainKeySchema } from "./audit-chain-key";
import { encryptionPublicKey } from "./encryption";
import { persistSecretFile } from "./secrets";
import { prisma } from "@s3-viewer/db";
import { isMissingTable, isUniqueViolation } from "@s3-viewer/db/errors";
import {
   createHash,
   createPublicKey,
   hkdfSync,
   randomBytes,
   scryptSync,
} from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ENCRYPTION_KEY = "encryption-key";
const AUTH_SECRET = "auth-secret";
const AUDIT_CHAIN = "audit-chain-key";
const AUTH_SECRET_SALT = "s3-viewer/auth-secret";
const AUDIT_CHAIN_KEY_SALT = "s3-viewer/audit-chain-key";
const FINGERPRINT_SCRYPT = {
   N: 2 ** 15,
   r: 8,
   p: 1,
   maxmem: 64 * 1024 * 1024,
};

const LEGACY_AUDIT_CHAIN_INFO = "s3-viewer audit chain";
const AUDIT_CHAIN_KEY_BYTES = 32;
const AUDIT_CHAIN_KEY_FILE = "audit-chain-key";

const legacyAuditChainKey = (authSecret: string): Buffer =>
   Buffer.from(
      hkdfSync(
         "sha256",
         authSecret,
         "",
         LEGACY_AUDIT_CHAIN_INFO,
         AUDIT_CHAIN_KEY_BYTES
      )
   );

const encryptionKeyFingerprint = (): string =>
   createHash("sha256")
      .update(
         createPublicKey(encryptionPublicKey()).export({
            type: "spki",
            format: "der",
         })
      )
      .digest("hex");

const authSecretFingerprint = (secret: string): string =>
   scryptSync(secret, AUTH_SECRET_SALT, 32, FINGERPRINT_SCRYPT).toString("hex");

const auditChainKeyFingerprint = (key: Buffer): string =>
   scryptSync(key, AUDIT_CHAIN_KEY_SALT, 32, FINGERPRINT_SCRYPT).toString(
      "hex"
   );

const recorded = async (name: string, fingerprint: string): Promise<string> => {
   const find = () =>
      prisma.instanceSecret.findUnique({
         where: { name },
         select: { fingerprint: true },
      });
   const existing = await find();
   if (existing) return existing.fingerprint;
   try {
      await prisma.instanceSecret.create({ data: { name, fingerprint } });
      return fingerprint;
   } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await find();
      if (!winner) throw error;
      return winner.fingerprint;
   }
};

const record = (name: string, fingerprint: string) =>
   prisma.instanceSecret.update({ where: { name }, data: { fingerprint } });

type FingerprintPolicy = {
   acceptNew: boolean;
   mismatchMessage?: string;
   acceptedWarning: string;
};

const assertRecordedFingerprint = async (
   name: string,
   current: string,
   { acceptNew, mismatchMessage, acceptedWarning }: FingerprintPolicy
): Promise<void> => {
   const known = await recorded(name, current);
   if (known === current) return;
   if (!acceptNew) throw new Error(mismatchMessage);
   await record(name, current);
   logger.warn(acceptedWarning);
};

const ENCRYPTION_KEY_MISMATCH = [
   "ENCRYPTION_PRIVATE_KEY is not the key this database's credentials were encrypted with.",
   "If this is one of several API replicas, every replica must share the same DATA_DIR volume or be given the same ENCRYPTION_PRIVATE_KEY and BETTER_AUTH_SECRET.",
   "If the previous key is gone for good, set ACCEPT_NEW_ENCRYPTION_KEY=true for one boot: every stored credential becomes unreadable and each server's owner must enter its credentials again.",
].join(" ");

const checkEncryptionKey = (): Promise<void> =>
   assertRecordedFingerprint(ENCRYPTION_KEY, encryptionKeyFingerprint(), {
      acceptNew: env.ACCEPT_NEW_ENCRYPTION_KEY,
      mismatchMessage: ENCRYPTION_KEY_MISMATCH,
      acceptedWarning:
         "ACCEPT_NEW_ENCRYPTION_KEY=true: recorded a new encryption key; credentials stored under the previous key can no longer be read. Unset it again.",
   });

const checkAuthSecret = (secret: string): Promise<void> =>
   assertRecordedFingerprint(AUTH_SECRET, authSecretFingerprint(secret), {
      acceptNew: true,
      acceptedWarning:
         "BETTER_AUTH_SECRET differs from the one this database last saw: sessions issued by the other value are now invalid. If this is one of several replicas, give every replica the same secret.",
   });

const readAuditChainKeyFile = (dir: string): Buffer | undefined => {
   const path = join(dir, AUDIT_CHAIN_KEY_FILE);
   let raw: string;
   try {
      raw = readFileSync(path, "utf8").trim();
   } catch (error) {
      if (
         error instanceof Error &&
         (error as NodeJS.ErrnoException).code === "ENOENT" &&
         !lstatSync(path, { throwIfNoEntry: false })
      ) {
         return undefined;
      }
      throw new Error(
         `Could not read ${path}: the persisted AUDIT_CHAIN_KEY must be readable by the user this process runs as.`,
         { cause: error }
      );
   }
   const parsed = auditChainKeySchema.safeParse(raw);
   if (!parsed.success) {
      throw new Error(
         `Invalid persisted AUDIT_CHAIN_KEY in ${path}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`
      );
   }
   return Buffer.from(parsed.data, "base64");
};

const persistAuditChainKey = (dir: string): Buffer => {
   const existing = readAuditChainKeyFile(dir);
   if (existing) return existing;
   const key = randomBytes(AUDIT_CHAIN_KEY_BYTES);
   const path = join(dir, AUDIT_CHAIN_KEY_FILE);
   const raced = persistSecretFile(
      dir,
      path,
      `${key.toString("base64")}\n`,
      () => readAuditChainKeyFile(dir)
   );
   if (raced) return raced;
   logger.warn(
      `generated AUDIT_CHAIN_KEY into ${path} — back this file up; losing it makes audit rows written from now on unverifiable (they stay readable)`
   );
   return key;
};

// existing audit history must keep its legacy key; generate a new key only where DATA_DIR can persist it.
const resolveAuditChainKey = async (
   authSecret: string,
   dataDir: string | undefined
): Promise<Buffer> => {
   const hasAuditHistory =
      (await prisma.auditLog.findFirst({ select: { id: true } })) !== null;
   if (hasAuditHistory || !dataDir) return legacyAuditChainKey(authSecret);
   return persistAuditChainKey(dataDir);
};

const AUDIT_CHAIN_KEY_MISMATCH = [
   "The active audit chain key does not match the one this database last saw, so every existing audit row would fail verification.",
   "If BETTER_AUTH_SECRET was rotated and AUDIT_CHAIN_KEY is still unset: unset AUDIT_CHAIN_KEY still derives the chain key from BETTER_AUTH_SECRET, so a rotation looks identical to tampering. Restore the previous BETTER_AUTH_SECRET, or set AUDIT_CHAIN_KEY explicitly (e.g. `openssl rand -base64 32`) so future rotations of BETTER_AUTH_SECRET no longer touch the audit chain.",
   "If this is one of several API replicas, every replica must share the same DATA_DIR volume or be given the same AUDIT_CHAIN_KEY.",
   "If the previous key is gone for good and you accept that audit rows written before now can no longer be verified, set ACCEPT_NEW_AUDIT_CHAIN_KEY=true for one boot.",
].join(" ");

const checkAuditChainKey = (key: Buffer): Promise<void> =>
   assertRecordedFingerprint(AUDIT_CHAIN, auditChainKeyFingerprint(key), {
      acceptNew: env.ACCEPT_NEW_AUDIT_CHAIN_KEY,
      mismatchMessage: AUDIT_CHAIN_KEY_MISMATCH,
      acceptedWarning:
         "ACCEPT_NEW_AUDIT_CHAIN_KEY=true: recorded a new audit chain key; audit rows written under the previous key can no longer be verified. Unset it again.",
   });

const assertInstanceSecrets = async (
   authSecret: string = env.BETTER_AUTH_SECRET
): Promise<Buffer> => {
   // read the key before database checks so pending migrations can't bypass file validation.
   const dataDir = process.env.DATA_DIR?.trim();
   let auditChainKey = env.AUDIT_CHAIN_KEY
      ? Buffer.from(env.AUDIT_CHAIN_KEY, "base64")
      : dataDir
        ? readAuditChainKeyFile(dataDir)
        : undefined;
   try {
      await checkEncryptionKey();
      await checkAuthSecret(authSecret);
      auditChainKey ??= await resolveAuditChainKey(authSecret, dataDir);
      await checkAuditChainKey(auditChainKey);
   } catch (error) {
      // RUN_MIGRATIONS=false replicas may boot before the migrating replica creates this table.
      if (!isMissingTable(error)) throw error;
      logger.warn(
         "instance_secret table is missing; run the pending database migrations so replicas can verify they share one encryption key"
      );
   }
   return auditChainKey ?? legacyAuditChainKey(authSecret);
};

export {
   assertInstanceSecrets,
   auditChainKeyFingerprint,
   encryptionKeyFingerprint,
};
