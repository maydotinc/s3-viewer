import {
   GetObjectTaggingCommand,
   type GetObjectTaggingCommandOutput,
   type Tag,
} from "@aws-sdk/client-s3";
import type { S3Scope } from "./listing";

const taggingOf = (tags: Tag[] | undefined): string | undefined =>
   tags?.length
      ? tags
           .map(
              ({ Key: key, Value: value }) =>
                 `${encodeURIComponent(key ?? "")}=${encodeURIComponent(value ?? "")}`
           )
           .join("&")
      : undefined;

const readObjectTagging = (
   { client, bucket, signal }: S3Scope,
   key: string
): Promise<GetObjectTaggingCommandOutput> =>
   client.send(new GetObjectTaggingCommand({ Bucket: bucket, Key: key }), {
      abortSignal: signal,
   });

export { readObjectTagging, taggingOf };
