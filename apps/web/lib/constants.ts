import { Provider } from "@s3-viewer/types";

export const PROVIDER_NAMES: Readonly<Record<Provider, string>> = {
   [Provider.S3]: "Amazon S3",
   [Provider.R2]: "Cloudflare R2",
   [Provider.Other]: "S3-compatible",
};

export const SEARCH_DEBOUNCE_MS = 300;
export const INPUT_DEBOUNCE_MS = 200;
// each listing request writes an object.list audit row.
export const LIST_INPUT_DEBOUNCE_MS = 400;
export const LIST_INPUT_MIN_CHARS = 2;
