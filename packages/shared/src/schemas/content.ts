import { MIB } from "../constants";
import { notFolder, objectScope } from "./s3";

export const MAX_EDIT_BYTES = MIB;

export const objectContentQuerySchema = objectScope.refine(
   ...notFolder("Folders have no contents")
);
