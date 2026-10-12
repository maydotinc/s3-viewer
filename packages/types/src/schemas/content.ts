import { notFolder, objectScope } from "./s3";

export const MAX_EDIT_BYTES = 1024 * 1024;

export const objectContentQuerySchema = objectScope.refine(
   ...notFolder("Folders have no contents")
);
