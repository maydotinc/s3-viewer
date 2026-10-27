import { previewKind } from "@/lib/utils/file-utils";
import { MAX_EDIT_BYTES, baseName, fileKeySchema } from "@s3-viewer/shared";

const EDITABLE_EXTENSIONS = new Set([
   "csv",
   "css",
   "env",
   "html",
   "ini",
   "js",
   "json",
   "log",
   "md",
   "sh",
   "svg",
   "toml",
   "ts",
   "txt",
   "xml",
   "yaml",
   "yml",
]);

const extensionOf = (objectKey: string): string => {
   const name = baseName(objectKey);
   const dot = name.lastIndexOf(".");
   return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
};

const isEditableObject = (
   contentType: string | null | undefined,
   objectKey: string,
   contentLength: number | null | undefined
): boolean => {
   if (!fileKeySchema.safeParse(objectKey).success) return false;
   if (typeof contentLength !== "number" || contentLength > MAX_EDIT_BYTES)
      return false;
   const kind = previewKind(contentType, baseName(objectKey));
   return (
      kind === "text" ||
      kind === "json" ||
      kind === "markdown" ||
      EDITABLE_EXTENSIONS.has(extensionOf(objectKey))
   );
};

export { isEditableObject };
