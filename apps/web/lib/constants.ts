import { Provider } from "@s3-viewer/types";

export const PROVIDER_NAMES: Readonly<Record<Provider, string>> = {
   [Provider.S3]: "Amazon S3",
   [Provider.R2]: "Cloudflare R2",
   [Provider.Other]: "S3-compatible",
};
