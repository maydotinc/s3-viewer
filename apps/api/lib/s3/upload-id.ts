import { MAX_UPLOAD_ID_CHARS } from "@s3-viewer/shared";
import { createHash } from "node:crypto";
import { StorageError } from "./errors";
import { signer } from "./signed-token";

type UploadBinding = { serverId: string; bucket: string; key: string };

const PLAN_PREFIX = "m3~";
const LISTED_PREFIX = "l1~";
const UNUSABLE_PREFIX = `${LISTED_PREFIX}~`;
const unusableUploadId = (key: string, uploadId: string): string =>
   `${UNUSABLE_PREFIX}${createHash("sha256").update(`${key}\0${uploadId}`).digest("base64url")}`;
const isUnusableUploadId = (value: string): boolean =>
   value.length > UNUSABLE_PREFIX.length && value.startsWith(UNUSABLE_PREFIX);
const planSigner = signer("s3-viewer multipart plan");

const bound = (body: string, { serverId, bucket, key }: UploadBinding) =>
   `${createHash("sha256")
      .update(JSON.stringify([serverId, bucket, key]))
      .digest("base64url")}~${body}`;

type ReplacementPlan = { expectedETag: string; settingsDigest: string };

const sealBody = (body: string, binding: UploadBinding): string | undefined => {
   const sealed = `${body}~${planSigner.sign(bound(body, binding))}`;
   return sealed.length <= MAX_UPLOAD_ID_CHARS ? sealed : undefined;
};

const sealUploadId = (
   uploadId: string,
   partSize: number,
   binding: UploadBinding,
   replacement?: ReplacementPlan
): string | undefined => {
   const snapshot = Buffer.from(
      JSON.stringify([
         replacement?.expectedETag ?? null,
         replacement?.settingsDigest ?? null,
      ])
   ).toString("base64url");
   return sealBody(
      `${PLAN_PREFIX}${partSize}~${snapshot}~${uploadId}`,
      binding
   );
};

const sealListedUpload = (
   uploadId: string,
   binding: UploadBinding
): string | undefined => sealBody(`${LISTED_PREFIX}${uploadId}`, binding);

type UploadPlan = {
   uploadId: string;
   partSize: number;
   expectedETag?: string;
   settingsDigest?: string;
};

const invalidUploadId = (): StorageError =>
   new StorageError(
      "invalid",
      "This upload id is not valid. Start the upload again."
   );

const verifiedBody = (value: string, binding: UploadBinding): string => {
   const cut = value.lastIndexOf("~");
   const body = value.slice(0, cut);
   if (!planSigner.verify(bound(body, binding), value.slice(cut + 1)))
      throw invalidUploadId();
   return body;
};

const openUploadId = (value: string, binding: UploadBinding): UploadPlan => {
   if (!value.startsWith(PLAN_PREFIX)) throw invalidUploadId();
   const body = verifiedBody(value, binding);
   const rest = body.slice(PLAN_PREFIX.length);
   const split = rest.indexOf("~");
   const partSize = Number(rest.slice(0, split));
   if (split < 0 || !Number.isSafeInteger(partSize) || partSize <= 0)
      throw invalidUploadId();
   const payload = rest.slice(split + 1);
   const snapshotEnd = payload.indexOf("~");
   const uploadId = payload.slice(snapshotEnd + 1);
   if (snapshotEnd < 0 || !uploadId) throw invalidUploadId();
   let snapshot: unknown;
   try {
      snapshot = JSON.parse(
         Buffer.from(payload.slice(0, snapshotEnd), "base64url").toString()
      );
   } catch {
      throw invalidUploadId();
   }
   if (!Array.isArray(snapshot) || snapshot.length !== 2)
      throw invalidUploadId();
   const [expectedETag, settingsDigest] = snapshot as unknown[];
   if (expectedETag === null && settingsDigest === null)
      return { uploadId, partSize };
   if (
      typeof expectedETag !== "string" ||
      !expectedETag ||
      typeof settingsDigest !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(settingsDigest)
   )
      throw invalidUploadId();
   return { uploadId, partSize, expectedETag, settingsDigest };
};

const cancellableUploadId = (value: string, binding: UploadBinding): string => {
   if (!value.startsWith(LISTED_PREFIX))
      return openUploadId(value, binding).uploadId;
   const uploadId = verifiedBody(value, binding).slice(LISTED_PREFIX.length);
   if (!uploadId) throw invalidUploadId();
   return uploadId;
};

export {
   cancellableUploadId,
   isUnusableUploadId,
   openUploadId,
   sealListedUpload,
   sealUploadId,
   unusableUploadId,
};
