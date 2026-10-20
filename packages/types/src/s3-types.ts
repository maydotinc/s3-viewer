import { Role } from "./server-types";

type S3Bucket = {
   name: string;
   creationDate: string | null;
   userRole: Role;
   folders: string[] | null;
};

// existing is set when the owner put a bucket that already existed back on an allow-listed server.
type CreatedBucket = { bucket: S3Bucket; existing?: true };

type S3Object = {
   key: string;
   isFolder: boolean;
   eTag: string | null;
   lastModified: string | null;
   size: number | null;
};

type S3ObjectListPage = {
   objects: S3Object[];
   nextToken: string | null;
};

type S3ObjectMetadata = {
   contentType: string;
   contentLength: number;
   lastModified: string | null;
   storageClass: string | null;
   eTag: string | null;
};

type S3ObjectSettings = S3ObjectMetadata & {
   cacheControl: string | null;
   contentDisposition: string | null;
   contentEncoding: string | null;
   contentLanguage: string | null;
   expires: string | null;
   metadata: Record<string, string>;
   serverSideEncryption: string | null;
   sseKmsKeyId: string | null;
   versionId: string | null;
};

type S3PresignedUrl = {
   url: string;
   expiresAt: string;
};

type S3ObjectPreview = S3PresignedUrl & S3ObjectSettings;

type S3ObjectUploaded = { key: string; size: number; eTag: string | null };
type S3KeyFailure = {
   key: string;
   message: string;
   retryable: boolean;
   refused?: true;
};
type S3DeleteResult = { deleted: string[]; failed: S3KeyFailure[] };
type S3MoveResult = { moved: string[]; failed: S3KeyFailure[] };
type S3DeleteTarget = { key: string; expectedETag: string | null };
type S3KeysPage = {
   objects: (S3DeleteTarget & { size: number | null })[];
   nextToken: string | null;
};
type S3ObjectsExist = { existing: string[]; eTags: Record<string, string> };

export type {
   CreatedBucket,
   S3Bucket,
   S3DeleteResult,
   S3DeleteTarget,
   S3KeyFailure,
   S3MoveResult,
   S3Object,
   S3ObjectListPage,
   S3ObjectMetadata,
   S3ObjectPreview,
   S3ObjectSettings,
   S3KeysPage,
   S3ObjectUploaded,
   S3ObjectsExist,
   S3PresignedUrl,
};
