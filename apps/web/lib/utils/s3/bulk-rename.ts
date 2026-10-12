import { validateObjectKey } from "./keys";
import { isFolderKey, parentPrefix } from "@s3-viewer/types";

const MAX_RENAME_PREVIEW_ROWS = 200;
const MAX_BULK_RENAME_KEYS = 10000;

type BulkRenameKind =
   | "replace"
   | "prefix"
   | "suffix"
   | "extension"
   | "lowercase";

type BulkRenameOperation =
   | {
        kind: "replace";
        find: string;
        replacement: string;
        matchCase: boolean;
        allOccurrences: boolean;
     }
   | { kind: "prefix"; text: string }
   | { kind: "suffix"; text: string }
   | { kind: "extension"; extension: string }
   | { kind: "lowercase" };

type BulkRenameRow = { key: string; newKey: string };
type BulkRenameProblem = BulkRenameRow & { reason: string };

type BulkRenamePlan = {
   rows: BulkRenameRow[];
   unchanged: number;
   invalid: BulkRenameProblem[];
   duplicates: string[];
   conflicts: string[];
};

type BulkRenameFields = {
   find: string;
   replacement: string;
   text: string;
   extension: string;
};

type BulkRenameOptions = {
   kind: BulkRenameKind;
   matchCase: boolean;
   allOccurrences: boolean;
};

const EMPTY_RENAME_FIELDS: BulkRenameFields = {
   find: "",
   replacement: "",
   text: "",
   extension: "",
};

const DEFAULT_RENAME_OPTIONS: BulkRenameOptions = {
   kind: "replace",
   matchCase: false,
   allOccurrences: true,
};

const toOperation = (
   fields: BulkRenameFields,
   { kind, matchCase, allOccurrences }: BulkRenameOptions
): BulkRenameOperation => {
   if (kind === "replace")
      return {
         kind,
         find: fields.find,
         replacement: fields.replacement,
         matchCase,
         allOccurrences,
      };
   if (kind === "extension") return { kind, extension: fields.extension };
   if (kind === "lowercase") return { kind };
   return { kind, text: fields.text };
};

const fileName = (key: string): string => key.slice(parentPrefix(key).length);

const splitName = (name: string): { stem: string; extension: string } => {
   const dot = name.lastIndexOf(".");
   return dot > 0
      ? { stem: name.slice(0, dot), extension: name.slice(dot) }
      : { stem: name, extension: "" };
};

const normalizeExtension = (extension: string): string => {
   const trimmed = extension.trim().replace(/^\.+/, "");
   return trimmed ? `.${trimmed}` : "";
};

const replaceLiteral = (
   value: string,
   find: string,
   replacement: string,
   matchCase: boolean,
   allOccurrences: boolean
): string => {
   if (!find) return value;
   const literal = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
   const pattern = new RegExp(
      literal,
      `u${matchCase ? "" : "i"}${allOccurrences ? "g" : ""}`
   );
   return value.replace(pattern, () => replacement);
};

const applyOperation = (
   name: string,
   operation: BulkRenameOperation
): string => {
   switch (operation.kind) {
      case "replace":
         return replaceLiteral(
            name,
            operation.find,
            operation.replacement,
            operation.matchCase,
            operation.allOccurrences
         );
      case "prefix":
         return `${operation.text}${name}`;
      case "suffix": {
         const { stem, extension } = splitName(name);
         return `${stem}${operation.text}${extension}`;
      }
      case "extension": {
         const { stem } = splitName(name);
         return `${stem}${normalizeExtension(operation.extension)}`;
      }
      case "lowercase":
         return name.toLowerCase();
   }
};

const renameKey = (key: string, operation: BulkRenameOperation): string =>
   `${parentPrefix(key)}${applyOperation(fileName(key), operation)}`;

const planBulkRename = (
   keys: readonly string[],
   operation: BulkRenameOperation
): BulkRenamePlan => {
   const rows: BulkRenameRow[] = [];
   const invalid: BulkRenameProblem[] = [];
   const claims = new Map<string, number>();
   const sources = new Set(keys);
   const changed = new Set<string>();
   let unchanged = 0;

   for (const key of sources) {
      if (isFolderKey(key)) continue;
      const newKey = renameKey(key, operation);
      if (newKey === key) {
         unchanged++;
         continue;
      }
      const reason = validateObjectKey(newKey);
      if (reason) {
         invalid.push({ key, newKey, reason });
         continue;
      }
      rows.push({ key, newKey });
      changed.add(key);
      claims.set(newKey, (claims.get(newKey) ?? 0) + 1);
   }

   const duplicates = [...claims]
      .filter(
         ([newKey, count]) =>
            count > 1 || (sources.has(newKey) && !changed.has(newKey))
      )
      .map(([newKey]) => newKey);

   const conflicts = [...claims.keys()].filter((newKey) => changed.has(newKey));

   return { rows, unchanged, invalid, duplicates, conflicts };
};

const isBlocked = (plan: BulkRenamePlan): boolean =>
   plan.rows.length === 0 ||
   plan.duplicates.length > 0 ||
   plan.conflicts.length > 0 ||
   plan.invalid.length > 0;

export {
   DEFAULT_RENAME_OPTIONS,
   EMPTY_RENAME_FIELDS,
   MAX_BULK_RENAME_KEYS,
   MAX_RENAME_PREVIEW_ROWS,
   applyOperation,
   isBlocked,
   normalizeExtension,
   planBulkRename,
   renameKey,
   replaceLiteral,
   splitName,
   toOperation,
};
export type {
   BulkRenameFields,
   BulkRenameKind,
   BulkRenameOperation,
   BulkRenameOptions,
   BulkRenamePlan,
   BulkRenameRow,
};
