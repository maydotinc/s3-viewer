import type {
   HeadObjectCommandOutput,
   PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { conflictAs } from "./conditions";
import { sendHead } from "./head";
import type { S3Scope } from "./listing";
import { StorageError } from "./errors";

const SOURCE_CHANGED = "The file changed. Refresh and try again.";

const sourceChanged = (): StorageError =>
   new StorageError("conflict", SOURCE_CHANGED);

// compare returned ETags too: compatible proxies may ignore conditional HEAD headers.
const headReviewed = async (
   scope: S3Scope,
   key: string,
   expectedETag: string | null
): Promise<HeadObjectCommandOutput> => {
   const head = await sendHead(scope, key, expectedETag || undefined).catch(
      conflictAs(sourceChanged)
   );
   if (expectedETag && head.ETag !== expectedETag) throw sourceChanged();
   return head;
};

// S3 omits website redirects even with MetadataDirective: COPY.
const redirectAttributes = (
   head: HeadObjectCommandOutput
): Pick<PutObjectCommandInput, "WebsiteRedirectLocation"> => ({
   ...(head.WebsiteRedirectLocation !== undefined && {
      WebsiteRedirectLocation: head.WebsiteRedirectLocation,
   }),
});

const metadataAttributes = (
   head: HeadObjectCommandOutput
): Partial<PutObjectCommandInput> => ({
   ...redirectAttributes(head),
   ...(head.ContentType && { ContentType: head.ContentType }),
   ...(head.CacheControl && { CacheControl: head.CacheControl }),
   ...(head.ContentDisposition && {
      ContentDisposition: head.ContentDisposition,
   }),
   ...(head.ContentEncoding && { ContentEncoding: head.ContentEncoding }),
   ...(head.ContentLanguage && { ContentLanguage: head.ContentLanguage }),
   ...(head.Expires && { Expires: head.Expires }),
   ...(head.Metadata && { Metadata: head.Metadata }),
});

export { headReviewed, metadataAttributes, redirectAttributes, sourceChanged };
