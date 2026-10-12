import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { withFolderGuard } from "./folder-guard";
import { budgetServerOf, withRequestBudget } from "./request-budget";
import { withBufferedResponses } from "./response-collector";

type CloneOptions = Pick<
   S3ClientConfig,
   "endpoint" | "region" | "maxAttempts"
> & {
   budgeted?: boolean;
};

const cloneS3Client = (
   client: S3Client,
   { budgeted = true, ...overrides }: CloneOptions
): S3Client => {
   const clone = new S3Client({
      ...client.config,
      ...overrides,
      followRegionRedirects: false,
      retryStrategy: undefined,
      serviceConfiguredEndpoint: undefined,
   });
   const serverId = budgetServerOf(client);
   if (serverId) {
      if (budgeted) withRequestBudget(clone, serverId);
      else withBufferedResponses(clone, serverId);
      withFolderGuard(clone, serverId);
   }
   return clone;
};

export { cloneS3Client };
export type { CloneOptions };
