import type { S3Client } from "@aws-sdk/client-s3";
import type { Provider } from "@s3-viewer/types";
import { detectProvider } from "../utils/detect-provider";

const clientProvider = async (client: S3Client): Promise<Provider> => {
   const endpoint = await client.config.endpoint?.();
   return detectProvider(
      endpoint ? `${endpoint.protocol}//${endpoint.hostname}` : ""
   );
};

export { clientProvider };
