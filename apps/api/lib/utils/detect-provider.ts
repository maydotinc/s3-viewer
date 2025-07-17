import { Provider, ServerCredentials } from "@s3-viewer/types";

const detectProvider = (credentials: ServerCredentials): Provider => {
   const { endpoint } = credentials;

   if (
      endpoint.includes("r2.cloudflarestorage.com") ||
      endpoint.includes("r2.dev")
   ) {
      return Provider.R2;
   } else if (endpoint.includes("s3.amazonaws.com")) {
      return Provider.S3;
   }

   return Provider.Other;
};

export default detectProvider;
