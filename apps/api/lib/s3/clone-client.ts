import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { withFolderGuard } from "./folder-guard";
import {
   budgetServerOf,
   withCancelBudget,
   withRequestBudget,
} from "./request-budget";
import { withBufferedResponses } from "./response-collector";

type CloneOptions = Pick<
   S3ClientConfig,
   "endpoint" | "region" | "maxAttempts"
> & {
   budget?: "requests" | "cancels" | "none";
};

const cloneS3Client = (
   client: S3Client,
   { budget = "requests", ...overrides }: CloneOptions
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
      if (budget === "requests") withRequestBudget(clone, serverId);
      else if (budget === "cancels") withCancelBudget(clone, serverId);
      else withBufferedResponses(clone, serverId);
      withFolderGuard(clone, serverId);
   }
   return clone;
};

export { cloneS3Client };
export type { CloneOptions };
