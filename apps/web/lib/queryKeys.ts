const server = (userId: string, serverId: string) =>
   ["user", userId, "server", serverId] as const;

const bucket = (userId: string, serverId: string, bucketName: string) =>
   [...server(userId, serverId), "bucket", bucketName] as const;

const bucketObjects = (userId: string, serverId: string, bucketName: string) =>
   [...bucket(userId, serverId, bucketName), "objects"] as const;

const queryKeys = {
   servers: (userId: string) => ["user", userId, "servers"] as const,
   server,
   members: (userId: string, serverId: string) =>
      [...server(userId, serverId), "members"] as const,
   sentInvites: (userId: string, serverId: string) =>
      [...server(userId, serverId), "invites"] as const,
   receivedInvites: (userId: string) => ["user", userId, "invites"] as const,
   sentInvitesAll: (userId: string) =>
      ["user", userId, "sent-invites"] as const,
   buckets: (userId: string, serverId: string) =>
      [...server(userId, serverId), "buckets"] as const,
   bucket,
   bucketObjects,
   objects: (
      userId: string,
      serverId: string,
      bucketName: string,
      prefix: string
   ) => [...bucketObjects(userId, serverId, bucketName), prefix] as const,
   objectMetadata: (
      userId: string,
      serverId: string,
      bucketName: string,
      objectKey: string
   ) =>
      [
         ...bucket(userId, serverId, bucketName),
         "object",
         objectKey,
         "metadata",
      ] as const,
   objectPreview: (
      userId: string,
      serverId: string,
      bucketName: string,
      objectKey: string
   ) =>
      [
         ...bucket(userId, serverId, bucketName),
         "object",
         objectKey,
         "preview",
      ] as const,
};

export { queryKeys };
