type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Branch = Json[] | Record<string, Json>;
type Entry = { key: string; value: Json };

const SMALL_DOCUMENT = 500;
const EXPAND_ALL_LIMIT = 5000;
const AUTO_OPEN_DEPTH = 2;
const AUTO_OPEN_MAX_ENTRIES = 100;

const isBranch = (value: Json): value is Branch =>
   typeof value === "object" && value !== null;

const entriesOf = (value: Branch): Entry[] =>
   Array.isArray(value)
      ? value.map((item, index) => ({ key: String(index), value: item }))
      : Object.entries(value).map(([key, item]) => ({ key, value: item }));

const countNodes = (value: Json, limit: number): number => {
   let seen = 0;
   const walk = (node: Json) => {
      if (!isBranch(node)) return;
      for (const entry of entriesOf(node)) {
         seen += 1;
         if (seen >= limit) return;
         walk(entry.value);
      }
   };
   walk(value);
   return seen;
};

type RowKind = "scalar" | "empty" | "closed" | "open" | "close";

type JsonRow = {
   path: string;
   kind: RowKind;
   depth: number;
   label?: string;
   indexed: boolean;
   value: Json;
   last: boolean;
   array: boolean;
   count: number;
};

type FlattenOptions = {
   value: Json;
   overrides: ReadonlyMap<string, boolean>;
   expandAll: boolean | null;
   small: boolean;
};

const defaultOpen = (
   depth: number,
   count: number,
   expandAll: boolean | null,
   small: boolean
): boolean =>
   expandAll ??
   (small || (depth < AUTO_OPEN_DEPTH && count <= AUTO_OPEN_MAX_ENTRIES));

const flattenJson = ({
   value,
   overrides,
   expandAll,
   small,
}: FlattenOptions): JsonRow[] => {
   const rows: JsonRow[] = [];

   const walk = (
      node: Json,
      path: string,
      depth: number,
      last: boolean,
      label: string | undefined,
      indexed: boolean
   ) => {
      const base = { path, depth, indexed, value: node, last };

      if (!isBranch(node)) {
         rows.push({ ...base, kind: "scalar", array: false, count: 0, label });
         return;
      }

      const entries = entriesOf(node);
      const array = Array.isArray(node);

      if (entries.length === 0) {
         rows.push({ ...base, kind: "empty", array, count: 0, label });
         return;
      }

      const open =
         overrides.get(path) ??
         defaultOpen(depth, entries.length, expandAll, small);

      if (!open) {
         rows.push({
            ...base,
            kind: "closed",
            array,
            count: entries.length,
            label,
         });
         return;
      }

      rows.push({
         ...base,
         kind: "open",
         array,
         count: entries.length,
         label,
      });
      entries.forEach((entry, index) => {
         walk(
            entry.value,
            `${path}/${encodeURIComponent(entry.key)}`,
            depth + 1,
            index === entries.length - 1,
            entry.key,
            array
         );
      });
      rows.push({
         ...base,
         kind: "close",
         array,
         count: entries.length,
         label: undefined,
      });
   };

   walk(value, "", 0, true, undefined, false);
   return rows;
};

export {
   AUTO_OPEN_DEPTH,
   AUTO_OPEN_MAX_ENTRIES,
   countNodes,
   EXPAND_ALL_LIMIT,
   entriesOf,
   flattenJson,
   isBranch,
   SMALL_DOCUMENT,
   type Branch,
   type Json,
   type JsonRow,
};
