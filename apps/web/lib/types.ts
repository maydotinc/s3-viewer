type BucketTarget = { userId: string; serverId: string; bucketName: string };

type KeyChangeInput = BucketTarget & {
   objectKey: string;
   newObjectKey: string;
   expectedETag: string;
};

export type { BucketTarget, KeyChangeInput };
