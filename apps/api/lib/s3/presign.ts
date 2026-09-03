import type {
   S3Client,
   ServiceInputTypes,
   ServiceOutputTypes,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
   PRESIGN_EXPIRY_SECONDS,
   SECOND_MS,
   type S3PresignedUrl,
} from "@s3-viewer/types";

type PresignableCommand<
   I extends ServiceInputTypes,
   O extends ServiceOutputTypes,
> = Parameters<typeof getSignedUrl<ServiceInputTypes, I, O>>[1];

const presignedUrl = async <
   I extends ServiceInputTypes,
   O extends ServiceOutputTypes,
>(
   client: S3Client,
   command: PresignableCommand<I, O>
): Promise<S3PresignedUrl> => {
   const expiresAt = new Date(
      Date.now() + PRESIGN_EXPIRY_SECONDS * SECOND_MS
   ).toISOString();
   const url = await getSignedUrl(client, command, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
   });
   return { url, expiresAt };
};

export { presignedUrl };
