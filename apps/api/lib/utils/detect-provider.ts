import { Provider } from "@s3-viewer/types";

const PROVIDER_SUFFIXES: readonly [string, Provider][] = [
   ["amazonaws.com", Provider.S3],
   ["r2.cloudflarestorage.com", Provider.R2],
];

const matches = (host: string, suffix: string): boolean =>
   host === suffix || host.endsWith(`.${suffix}`);

const detectProvider = (endpoint: string): Provider => {
   let host: string;
   try {
      host = new URL(endpoint).hostname.toLowerCase();
   } catch {
      return Provider.Other;
   }
   return (
      PROVIDER_SUFFIXES.find(([suffix]) => matches(host, suffix))?.[1] ??
      Provider.Other
   );
};

export { detectProvider };
