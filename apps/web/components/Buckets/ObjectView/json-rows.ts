type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Branch = Json[] | Record<string, Json>;
type Entry = { key: string; value: Json };

const SMALL_DOCUMENT = 500;
const EXPAND_ALL_LIMIT = 5000;
const AUTO_OPEN_DEPTH = 2;
const AUTO_OPEN_MAX_ENTRIES = 100;
const MAX_JSON_PREVIEW_ROWS = 20000;
const MAX_JSON_PREVIEW_DEPTH = 200;

const isBranch = (value: Json): value is Branch =>
   typeof value === "object" && value !== null;

const countEntries = (value: Branch): number =>
   Array.isArray(value) ? value.length : Object.keys(value).length;

const entriesOf = (value: Branch, limit = Number.POSITIVE_INFINITY): Entry[] =>
   Array.isArray(value)
      ? value
           .slice(0, limit)
           .map((item, index) => ({ key: String(index), value: item }))
      : Object.entries(value)
           .slice(0, limit)
           .map(([key, item]) => ({ key, value: item }));

const countNodes = (value: Json, limit: number): number => {
   let seen = 0;
   const walk = (node: Json, depth: number) => {
      if (!isBranch(node) || depth >= MAX_JSON_PREVIEW_DEPTH) return;
      for (const entry of entriesOf(node, limit)) {
         seen += 1;
         if (seen >= limit) return;
         walk(entry.value, depth + 1);
      }
   };
   walk(value, 0);
   return seen;
};

type RowKind = "scalar" | "empty" | "closed" | "open" | "close" | "truncated";

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
   let budget = MAX_JSON_PREVIEW_ROWS;

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

      const count = countEntries(node);
      const array = Array.isArray(node);

      if (count === 0) {
         rows.push({ ...base, kind: "empty", array, count: 0, label });
         return;
      }

      const open =
         overrides.get(path) ?? defaultOpen(depth, count, expandAll, small);

      if (!open || budget <= 0 || depth >= MAX_JSON_PREVIEW_DEPTH) {
         rows.push({ ...base, kind: "closed", array, count, label });
         return;
      }

      const shown = Math.min(count, budget);
      budget -= shown;

      rows.push({ ...base, kind: "open", array, count, label });
      entriesOf(node, shown).forEach((entry, index) => {
         walk(
            entry.value,
            `${path}/${index}`,
            depth + 1,
            index === count - 1,
            entry.key,
            array
         );
      });
      if (shown < count)
         rows.push({
            path: `${path}/truncated`,
            kind: "truncated",
            depth: depth + 1,
            indexed,
            value: null,
            last: true,
            array,
            count: count - shown,
         });
      rows.push({
         ...base,
         kind: "close",
         array,
         count,
         label: undefined,
      });
   };

   walk(value, "", 0, true, undefined, false);
   return rows;
};

export {
   countEntries,
   countNodes,
   EXPAND_ALL_LIMIT,
   flattenJson,
   isBranch,
   MAX_JSON_PREVIEW_DEPTH,
   MAX_JSON_PREVIEW_ROWS,
   SMALL_DOCUMENT,
   type Json,
   type JsonRow,
};
