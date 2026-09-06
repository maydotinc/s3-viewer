import { S3Client } from "@aws-sdk/client-s3";

const withoutRetries = (client: S3Client): S3Client =>
   new S3Client({
      ...client.config,
      maxAttempts: 1,
      retryStrategy: undefined,
      serviceConfiguredEndpoint: undefined,
   });

export { withoutRetries };
