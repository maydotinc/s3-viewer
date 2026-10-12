import {
   baseName,
   isFolderKey,
   objectKeySchema,
   fileKeySchema,
} from "@s3-viewer/types";

import { isLossyKeySegment } from "./key-segments";

const segmentError = (value: string): string | null => {
   if (value.startsWith("/")) return "The key can't start with a slash.";
   const body = isFolderKey(value) ? value.slice(0, -1) : value;
   return body.split("/").some((segment) => isLossyKeySegment(segment))
      ? 'The key can\'t contain empty, "." or ".." segments.'
      : null;
};

const validateObjectKey = (value: string): string | null => {
   if (!value) return "Enter a key.";
   if (isFolderKey(value)) return "The key can't end with a slash.";
   return (
      segmentError(value) ??
      (fileKeySchema.safeParse(value).success
         ? null
         : "Use a valid key of at most 1,024 UTF-8 bytes.")
   );
};

const validateFolderKey = (value: string): string | null => {
   if (!value) return "Enter a folder.";
   if (!isFolderKey(value)) return "The folder has to end with a slash.";
   return (
      segmentError(value) ??
      (objectKeySchema.safeParse(value).success
         ? null
         : "Use a valid folder key of at most 1,024 UTF-8 bytes.")
   );
};

const validateFolderName = (value: string): string | null => {
   if (!value) return "Enter a name.";
   if (value.includes("/")) return "The name can't contain a slash.";
   if (isLossyKeySegment(value)) return 'The name can\'t be "." or "..".';
   return objectKeySchema.safeParse(value).success
      ? null
      : "Use a valid folder name of at most 1,024 UTF-8 bytes.";
};

const OVERLAP_ERROR = "Source and destination folders must not overlap.";
const SAME_FOLDER_ERROR = "That's the current folder.";

const destinationKey = (
   key: string,
   source: { folderKey: string } | { objects: readonly unknown[] },
   prefix: string
): string =>
   "folderKey" in source
      ? `${prefix}${key.slice(source.folderKey.length)}`
      : `${prefix}${baseName(key)}`;

const prefixesOverlap = (left: string, right: string): boolean =>
   left.startsWith(right) || right.startsWith(left);

type DestinationSource =
   | { folderKey: string }
   | { prefix: string; objects: readonly { key: string }[] };

type DestinationOptions = {
   sameBucket?: boolean;
   overlaps?: (folderKey: string, prefix: string) => boolean;
};

const validateDestination = (
   source: DestinationSource,
   prefix: string,
   { sameBucket = true, overlaps = prefixesOverlap }: DestinationOptions = {}
): string | null => {
   if ("folderKey" in source) {
      const invalid = validateFolderKey(prefix);
      if (invalid) return invalid;
      if (sameBucket && prefix === source.folderKey) return SAME_FOLDER_ERROR;
      return overlaps(source.folderKey, prefix) ? OVERLAP_ERROR : null;
   }
   const invalid = prefix === "" ? null : validateFolderKey(prefix);
   if (invalid) return invalid;
   for (const { key } of source.objects) {
      const invalidKey = validateObjectKey(destinationKey(key, source, prefix));
      if (invalidKey) return invalidKey;
   }
   return sameBucket && prefix === source.prefix ? SAME_FOLDER_ERROR : null;
};

export {
   OVERLAP_ERROR,
   destinationKey,
   prefixesOverlap,
   validateDestination,
   validateFolderKey,
   validateFolderName,
   validateObjectKey,
};
