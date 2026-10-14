import type { AuditQuery } from "@s3-viewer/types";

type AuditFilters = Pick<AuditQuery, "action" | "actor" | "bucket" | "q"> & {
   from?: string;
   to?: string;
};

const server = (userId: string, serverId: string) =>
   ["user", userId, "server", serverId] as const;

const bucket = (userId: string, serverId: string, bucketName: string) =>
   [...server(userId, serverId), "bucket", bucketName] as const;

const bucketSuggestions = (
   userId: string,
   serverId: string,
   bucketName: string
) => [...bucket(userId, serverId, bucketName), "objects"] as const;

const object = (
   userId: string,
   serverId: string,
   bucketName: string,
   objectKey: string
) => [...bucket(userId, serverId, bucketName), "object", objectKey] as const;

const objectPreview = (...args: Parameters<typeof object>) =>
   [...object(...args), "preview"] as const;

const auditLogs = (userId: string, serverId: string) =>
   [...server(userId, serverId), "audit"] as const;

const sentInvites = (userId: string, serverId: string) =>
   [...server(userId, serverId), "invites"] as const;

const queryKeys = {
   instanceConfig: ["instance-config"] as const,
   servers: (userId: string) => ["user", userId, "servers"] as const,
   serverInfo: (userId: string, serverId: string) =>
      ["user", userId, "servers", serverId] as const,
   server,
   members: (userId: string, serverId: string) =>
      [...server(userId, serverId), "members"] as const,
   sentInvites,
   receivedInvites: (userId: string) => ["user", userId, "invites"] as const,
   auditLogs,
   auditLog: (userId: string, serverId: string, filters: AuditFilters = {}) =>
      [...auditLogs(userId, serverId), filters] as const,
   auditSettings: (userId: string, serverId: string) =>
      [...server(userId, serverId), "audit-settings"] as const,
   sessions: (userId: string) => ["user", userId, "sessions"] as const,
   accountSummary: (userId: string) =>
      ["user", userId, "account-summary"] as const,
   hasPassword: (userId: string) => ["user", userId, "has-password"] as const,
   buckets: (userId: string, serverId: string) =>
      [...server(userId, serverId), "buckets"] as const,
   bucket,
   bucketSuggestions,
   objectKeySuggestions: (
      userId: string,
      serverId: string,
      bucketName: string,
      prefix: string
   ) => [...bucketSuggestions(userId, serverId, bucketName), prefix] as const,
   multipartUploads: (
      userId: string,
      serverId: string,
      bucketName: string,
      prefix?: string
   ) =>
      [
         ...bucket(userId, serverId, bucketName),
         "multipart-uploads",
         ...(prefix === undefined ? [] : [prefix]),
      ] as const,
   objectContent: (...args: Parameters<typeof object>) =>
      [...object(...args), "content"] as const,
   objectSettings: (...args: Parameters<typeof object>) =>
      [...object(...args), "settings"] as const,
   objectPreview,
   objectPreviewBody: (
      userId: string,
      serverId: string,
      bucketName: string,
      objectKey: string,
      version?: string
   ) =>
      [
         ...objectPreview(userId, serverId, bucketName, objectKey),
         "body",
         ...(version === undefined ? [] : [version]),
      ] as const,
};

// matchers read keys positionally, so they derive their offsets from the builders above
const BUCKETS_KEY = queryKeys.buckets("", "");
const OBJECT_SEGMENT = bucket("", "", "").length;

const isBucketsKey = (queryKey: readonly unknown[]): boolean =>
   queryKey.length === BUCKETS_KEY.length &&
   BUCKETS_KEY.every(
      (segment, index) => segment === "" || queryKey[index] === segment
   );

const objectKeyOf = (queryKey: readonly unknown[]): string | undefined => {
   const objectKey = queryKey[OBJECT_SEGMENT + 1];
   return queryKey[OBJECT_SEGMENT] === "object" && typeof objectKey === "string"
      ? objectKey
      : undefined;
};

export { isBucketsKey, objectKeyOf, queryKeys };
export type { AuditFilters };
