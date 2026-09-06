import { Provider } from "@s3-viewer/types";

// An AWS-owned suffix alone is not a storage capability guarantee: EC2,
// API Gateway and load balancers can serve arbitrary customer code.
const S3_ENDPOINT =
   /^(?:s3|s3-external-1|s3(?:-fips)?(?:\.dualstack)?[.-][a-z]{2}(?:-[a-z]+)+-\d+)\.amazonaws\.com(?:\.cn)?$/;
const R2_ENDPOINT =
   /^[a-z0-9]+(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/;

const detectProvider = (endpoint: string): Provider => {
   let host: string;
   try {
      host = new URL(endpoint).hostname.toLowerCase();
   } catch {
      return Provider.Other;
   }
   if (S3_ENDPOINT.test(host)) return Provider.S3;
   if (R2_ENDPOINT.test(host)) return Provider.R2;
   return Provider.Other;
};

export { detectProvider };
