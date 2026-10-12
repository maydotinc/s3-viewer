import type {
   S3Client,
   ServiceInputTypes,
   ServiceOutputTypes,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
   canPresignObjectKey,
   PRESIGN_EXPIRY_SECONDS,
   SECOND_MS,
   type S3PresignedUrl,
} from "@s3-viewer/types";

import { ApiHttpError } from "@/lib/http";

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
   if (
      "Key" in command.input &&
      typeof command.input.Key === "string" &&
      !canPresignObjectKey(command.input.Key)
   ) {
      throw new ApiHttpError(
         409,
         "This object key cannot be used in a browser link. Download it as a zip instead."
      );
   }
   const expiresAt = new Date(
      Date.now() + PRESIGN_EXPIRY_SECONDS * SECOND_MS
   ).toISOString();
   const url = await getSignedUrl(client, command, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
   });
   return { url, expiresAt };
};

export { presignedUrl };
