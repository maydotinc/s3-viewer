import useSessionStore from "@/lib/stores/session-store";
import type { BucketTarget } from "@/lib/types";
import { DAY_MS, MAX_MULTIPART_PARTS } from "@s3-viewer/types";
import type { UploadTarget } from "./multipart-api";
import { withMultipartStorageLock } from "./multipart-locks";

const STORAGE_KEY = "s3-viewer.multipart-uploads";
const SESSION_TTL_MS = 7 * DAY_MS;
const MAX_SESSIONS = 50;
const DIGESTS_PER_CHUNK = 64;
const SESSION_REFRESH_MS = 60_000;

type PartDigest = { eTag: string; sha256: string };
type MultipartSession = BucketTarget & {
   objectKey: string;
   uploadId: string;
   partSize: number;
   partCount: number;
   fileName: string;
   fileSize: number;
   lastModified: number;
   expectedETag: string | null;
   savedAt: number;
   partDigests?: Record<number, PartDigest>;
};
type StoredSession = MultipartSession & { digestStorage?: "chunks" };

const sessionKey = ({
   serverId,
   bucketName,
   objectKey,
}: UploadTarget): string => JSON.stringify([serverId, bucketName, objectKey]);

const digestKey = (session: MultipartSession, chunk: number): string =>
   `${STORAGE_KEY}.parts.${JSON.stringify([session.userId, sessionKey(session), session.uploadId, chunk])}`;

const chunkCount = (session: MultipartSession): number =>
   Math.ceil(session.partCount / DIGESTS_PER_CHUNK);

const chunkOf = (partNumber: number): number =>
   Math.floor((partNumber - 1) / DIGESTS_PER_CHUNK);

const store = (): Storage | null => {
   try {
      return typeof localStorage === "undefined" ? null : localStorage;
   } catch {
      return null;
   }
};

const isSession = (value: unknown): value is StoredSession => {
   const session = value as Partial<StoredSession> | null;
   return (
      typeof session === "object" &&
      session !== null &&
      typeof session.userId === "string" &&
      typeof session.serverId === "string" &&
      typeof session.bucketName === "string" &&
      typeof session.uploadId === "string" &&
      typeof session.objectKey === "string" &&
      typeof session.partSize === "number" &&
      Number.isSafeInteger(session.partCount) &&
      session.partCount! >= 1 &&
      session.partCount! <= MAX_MULTIPART_PARTS &&
      typeof session.fileSize === "number" &&
      typeof session.lastModified === "number" &&
      typeof session.savedAt === "number"
   );
};

const readSessions = (storage: Storage): Record<string, StoredSession> => {
   const raw = storage.getItem(STORAGE_KEY);
   if (!raw) return {};
   const parsed = JSON.parse(raw) as Record<string, unknown>;
   return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, StoredSession] =>
         isSession(entry[1])
      )
   );
};

const removeDigests = (storage: Storage, session: MultipartSession): void => {
   for (let chunk = 0; chunk < chunkCount(session); chunk++)
      try {
         storage.removeItem(digestKey(session, chunk));
      } catch {
         // a refused cleanup cannot restore the catalog entry already removed.
      }
};

const writeSessions = (
   storage: Storage,
   sessions: Record<string, StoredSession>
): void => {
   const fresh = Date.now() - SESSION_TTL_MS;
   const entries = Object.entries(sessions);
   const kept = entries
      .filter(([, session]) => session.savedAt > fresh)
      .sort(([, left], [, right]) => right.savedAt - left.savedAt)
      .slice(0, MAX_SESSIONS);
   storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)));
   const retained = new Set(kept.map(([, session]) => session));
   for (const [, session] of entries) {
      if (!retained.has(session)) removeDigests(storage, session);
   }
};

const readChunk = (
   storage: Storage,
   session: MultipartSession,
   chunk: number
): Record<number, PartDigest> => {
   const raw = storage.getItem(digestKey(session, chunk));
   if (!raw) return {};
   const parsed: unknown = JSON.parse(raw);
   if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
   const values: Record<number, PartDigest> = {};
   const start = chunk * DIGESTS_PER_CHUNK + 1;
   for (
      let part = start;
      part < Math.min(start + DIGESTS_PER_CHUNK, session.partCount + 1);
      part++
   ) {
      const digest = (parsed as Record<number, PartDigest>)[part];
      if (digest) values[part] = digest;
   }
   return values;
};

const rememberSessionUnlocked = (session: MultipartSession): boolean => {
   const storage = store();
   let catalogSaved = false;
   try {
      if (!storage || useSessionStore.getState().userId !== session.userId)
         return false;
      const sessions = readSessions(storage);
      const key = sessionKey(session);
      const previous = sessions[key];
      const chunks = new Map<number, Record<number, PartDigest>>();
      for (const [number, digest] of Object.entries(
         session.partDigests ?? {}
      )) {
         const partNumber = Number(number);
         if (
            !Number.isInteger(partNumber) ||
            partNumber < 1 ||
            partNumber > session.partCount
         )
            continue;
         const chunk = chunkOf(partNumber);
         const values = chunks.get(chunk) ?? {};
         values[partNumber] = digest;
         chunks.set(chunk, values);
      }
      for (let chunk = 0; chunk < chunkCount(session); chunk++) {
         const values = chunks.get(chunk);
         if (values)
            storage.setItem(digestKey(session, chunk), JSON.stringify(values));
         else storage.removeItem(digestKey(session, chunk));
      }
      const { partDigests: _digests, ...metadata } = session;
      writeSessions(storage, {
         ...sessions,
         [key]: { ...metadata, digestStorage: "chunks" },
      });
      catalogSaved = true;
      if (
         previous &&
         (previous.uploadId !== session.uploadId ||
            previous.userId !== session.userId)
      )
         removeDigests(storage, previous);
      return true;
   } catch {
      if (storage && !catalogSaved) removeDigests(storage, session);
      return false;
   }
};

const writePartDigest = (
   session: MultipartSession,
   partNumber: number,
   digest?: PartDigest
): boolean => {
   try {
      const storage = store();
      if (!storage) return false;
      const sessions = readSessions(storage);
      const key = sessionKey(session);
      const saved = sessions[key];
      if (
         !saved ||
         saved.uploadId !== session.uploadId ||
         saved.userId !== session.userId
      )
         return true;
      if (saved.digestStorage !== "chunks") return false;
      const chunk = chunkOf(partNumber);
      const values = readChunk(storage, session, chunk);
      if (digest) values[partNumber] = digest;
      else delete values[partNumber];
      const storageKey = digestKey(session, chunk);
      if (Object.keys(values).length)
         storage.setItem(storageKey, JSON.stringify(values));
      else storage.removeItem(storageKey);
      if (digest && Date.now() - saved.savedAt >= SESSION_REFRESH_MS) {
         saved.savedAt = Date.now();
         writeSessions(storage, sessions);
      }
      return true;
   } catch {
      return false;
   }
};

const rememberPartDigestUnlocked = (
   session: MultipartSession,
   partNumber: number,
   digest: PartDigest
): void => {
   if (useSessionStore.getState().userId !== session.userId) return;
   (session.partDigests ??= {})[partNumber] = digest;
   writePartDigest(session, partNumber, digest);
};

const forgetPartDigestUnlocked = (
   session: MultipartSession,
   partNumber: number
): boolean => {
   if (!writePartDigest(session, partNumber)) return false;
   delete session.partDigests?.[partNumber];
   return true;
};

const forgetSessionUnlocked = (
   target: UploadTarget,
   uploadId?: string
): void => {
   try {
      const storage = store();
      if (!storage) return;
      const sessions = readSessions(storage);
      const key = sessionKey(target);
      const session = sessions[key];
      if (!session || (uploadId && session.uploadId !== uploadId)) return;
      delete sessions[key];
      writeSessions(storage, sessions);
      removeDigests(storage, session);
   } catch {
      // local storage cleanup cannot abort the remote upload; manual cleanup may be needed.
   }
};

type ResumeCandidate = {
   userId: string;
   target: UploadTarget;
   file: File;
   expectedETag: string | null;
};

const resumableSessionUnlocked = ({
   userId,
   target,
   file,
   expectedETag,
}: ResumeCandidate): MultipartSession | null => {
   try {
      const storage = store();
      if (!storage) return null;
      const session = readSessions(storage)[sessionKey(target)];
      if (
         !session ||
         session.savedAt <= Date.now() - SESSION_TTL_MS ||
         useSessionStore.getState().userId !== userId ||
         session.userId !== userId ||
         session.serverId !== target.serverId ||
         session.bucketName !== target.bucketName ||
         session.objectKey !== target.objectKey ||
         session.fileName !== file.name ||
         session.fileSize !== file.size ||
         session.lastModified !== file.lastModified ||
         session.expectedETag !== expectedETag
      )
         return null;
      if (session.digestStorage !== "chunks") {
         if (
            session.partDigests &&
            typeof session.partDigests === "object" &&
            !Array.isArray(session.partDigests)
         )
            rememberSessionUnlocked(session);
         return session;
      }
      const partDigests: Record<number, PartDigest> = {};
      for (let chunk = 0; chunk < chunkCount(session); chunk++)
         Object.assign(partDigests, readChunk(storage, session, chunk));
      return { ...session, partDigests };
   } catch {
      return null;
   }
};

const dropSessions = (drop: (session: StoredSession) => boolean): void => {
   try {
      const storage = store();
      if (!storage) return;
      const sessions = readSessions(storage);
      const removed = Object.values(sessions).filter(drop);
      const kept = Object.fromEntries(
         Object.entries(sessions).filter(([, session]) => !drop(session))
      );
      if (Object.keys(kept).length) writeSessions(storage, kept);
      else storage.removeItem(STORAGE_KEY);
      for (const session of removed) removeDigests(storage, session);
   } catch {
      // nothing to clear if storage is unavailable.
   }
};

const clearPreviousSessions = (): void => {
   const userId = useSessionStore.getState().userId;
   dropSessions((session) => session.userId !== userId);
};

// file names, keys and upload ids must not outlive an explicit sign-out on a shared device
const forgetAccountSessions = (userId: string): Promise<void> =>
   withMultipartStorageLock(undefined, () =>
      dropSessions((session) => session.userId === userId)
   );

const rememberSession = (session: MultipartSession): Promise<boolean> =>
   withMultipartStorageLock(false, () => rememberSessionUnlocked(session));

const rememberPartDigest = (
   session: MultipartSession,
   partNumber: number,
   digest: PartDigest
): Promise<void> =>
   withMultipartStorageLock(undefined, () =>
      rememberPartDigestUnlocked(session, partNumber, digest)
   );

const forgetPartDigest = (
   session: MultipartSession,
   partNumber: number
): Promise<boolean> =>
   withMultipartStorageLock(false, () =>
      forgetPartDigestUnlocked(session, partNumber)
   );

const forgetSession = (
   target: UploadTarget,
   uploadId?: string
): Promise<void> =>
   withMultipartStorageLock(undefined, () =>
      forgetSessionUnlocked(target, uploadId)
   );

const resumableSession = (
   candidate: ResumeCandidate
): Promise<MultipartSession | null> =>
   withMultipartStorageLock(null, () => resumableSessionUnlocked(candidate));

useSessionStore.subscribe((state, previous) => {
   if (state.userId !== previous.userId)
      void withMultipartStorageLock(undefined, clearPreviousSessions);
});

export {
   forgetAccountSessions,
   forgetPartDigest,
   forgetSession,
   rememberPartDigest,
   rememberSession,
   resumableSession,
   type MultipartSession,
};
