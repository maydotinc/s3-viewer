import type { S3Client } from "@aws-sdk/client-s3";
import { Provider, backblazeRegion } from "@s3-viewer/types";
import { detectProvider } from "@/lib/utils/detect-provider";

const clientEndpoint = async (client: S3Client): Promise<string> => {
   const endpoint = await client.config.endpoint?.();
   return endpoint ? `${endpoint.protocol}//${endpoint.hostname}` : "";
};

const clientProvider = async (client: S3Client): Promise<Provider> =>
   detectProvider(await clientEndpoint(client));

const clientSupportsMultipartPrefix = async (
   client: S3Client
): Promise<boolean> => {
   const endpoint = await clientEndpoint(client);
   return (
      detectProvider(endpoint) !== Provider.Other ||
      backblazeRegion(endpoint) !== undefined
   );
};

export { clientProvider, clientSupportsMultipartPrefix };
