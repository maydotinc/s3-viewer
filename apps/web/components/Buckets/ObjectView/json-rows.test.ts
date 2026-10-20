import { describe, expect, it } from "vitest";
import {
   countNodes,
   flattenJson,
   MAX_JSON_PREVIEW_DEPTH,
   MAX_JSON_PREVIEW_ROWS,
   type Json,
} from "./json-rows";

const flatten = (
   value: Json,
   overrides: Map<string, boolean> = new Map(),
   expandAll: boolean | null = null,
   small = true
) => flattenJson({ value, overrides, expandAll, small });

describe("flattenJson", () => {
   it("emits a single row for an empty branch", () => {
      expect(flatten({}).map((r) => r.kind)).toEqual(["empty"]);
      expect(flatten([]).map((r) => r.kind)).toEqual(["empty"]);
   });

   it("brackets an open branch with open and close rows", () => {
      const rows = flatten({ a: 1 });
      expect(rows.map((r) => r.kind)).toEqual(["open", "scalar", "close"]);
      expect(rows[1]?.label).toBe("a");
      expect(rows[1]?.depth).toBe(1);
   });

   it("collapses a branch to one row when closed by an override", () => {
      const rows = flatten({ a: { b: 1 } }, new Map([["/0", false]]));
      expect(rows.map((r) => r.kind)).toEqual(["open", "closed", "close"]);
      expect(rows[1]?.count).toBe(1);
   });

   it("marks array children as indexed and labels them by position", () => {
      const rows = flatten(["x", "y"]);
      const children = rows.filter((r) => r.kind === "scalar");
      expect(children.map((r) => r.label)).toEqual(["0", "1"]);
      expect(children.every((r) => r.indexed)).toBe(true);
   });

   it("flags only the final child of a branch as last", () => {
      const rows = flatten({ a: 1, b: 2 });
      const children = rows.filter((r) => r.kind === "scalar");
      expect(children.map((r) => r.last)).toEqual([false, true]);
   });

   it("handles every UTF-16 key with distinct identities and independent folding", () => {
      const keys = [
         "\ud800",
         "\udfff",
         "\ud800\udfff",
         "雪",
         "a/b",
         "a",
         "",
         "…",
         "truncated",
         "0/truncated",
         "~0",
         "__proto__",
      ];
      const value = JSON.parse(
         JSON.stringify(Object.fromEntries(keys.map((key) => [key, [1]])))
      ) as Json;
      const rows = flatten(value);
      const branches = rows.filter(
         (row) => row.kind === "open" && row.depth === 1
      );
      expect(branches.map((row) => row.label)).toEqual(keys);
      expect(new Set(rows.map((row) => `${row.path}:${row.kind}`)).size).toBe(
         rows.length
      );
      for (const branch of branches) {
         const folded = flatten(value, new Map([[branch.path, false]]));
         expect(
            folded
               .filter((row) => row.kind === "closed")
               .map((row) => row.label)
         ).toEqual([branch.label]);
      }
   });

   it("keeps identifiers bounded even when a long key has many descendants", () => {
      const rows = flatten({
         ["x".repeat(100000)]: Array.from({ length: 1000 }, () => 0),
      });
      expect(rows.every((row) => row.path.length < 20)).toBe(true);
   });

   it("keeps deep branches shut in a large document by default", () => {
      const deep = { a: { b: { c: { d: 1 } } } };
      const rows = flattenJson({
         value: deep,
         overrides: new Map(),
         expandAll: null,
         small: false,
      });
      expect(rows.some((r) => r.kind === "closed")).toBe(true);
   });

   it("opens a wide branch only when it is under the entry cap", () => {
      const wide = Object.fromEntries(
         Array.from({ length: 101 }, (_, i) => [String(i), i])
      );
      const rows = flattenJson({
         value: { top: wide },
         overrides: new Map(),
         expandAll: null,
         small: false,
      });
      expect(rows.find((r) => r.label === "top")?.kind).toBe("closed");
   });

   it("expandAll true overrides the per-branch defaults", () => {
      const deep = { a: { b: { c: { d: 1 } } } };
      const rows = flattenJson({
         value: deep,
         overrides: new Map(),
         expandAll: true,
         small: false,
      });
      expect(rows.some((r) => r.kind === "closed")).toBe(false);
   });

   it("expandAll false shuts every branch", () => {
      const rows = flattenJson({
         value: { a: { b: 1 } },
         overrides: new Map(),
         expandAll: false,
         small: true,
      });
      expect(rows.map((r) => r.kind)).toEqual(["closed"]);
   });

   it("lets an override reopen a branch that expandAll shut", () => {
      const rows = flattenJson({
         value: { a: { b: 1 } },
         overrides: new Map([["", true]]),
         expandAll: false,
         small: true,
      });
      expect(rows[0]?.kind).toBe("open");
   });
});

describe("flattenJson row cap", () => {
   const OVERSIZE = MAX_JSON_PREVIEW_ROWS + 50;
   const oversized = () => Array.from({ length: OVERSIZE }, (_, i) => i);

   it("truncates a branch that would blow the row budget", () => {
      const rows = flatten({ big: oversized(), tail: "keep" });
      const truncated = rows.filter((r) => r.kind === "truncated");
      expect(truncated).toHaveLength(1);
      expect(truncated[0]?.count).toBe(OVERSIZE - (MAX_JSON_PREVIEW_ROWS - 2));
      expect(truncated[0]?.array).toBe(true);
      expect(truncated[0]?.depth).toBe(2);
      expect(rows.length).toBeLessThan(MAX_JSON_PREVIEW_ROWS + 100);
   });

   it("keeps a truncated branch's later siblings in the tree", () => {
      const rows = flatten({ big: oversized(), tail: "keep" });
      const tail = rows.find((r) => r.label === "tail");
      expect(tail?.kind).toBe("scalar");
      expect(tail?.value).toBe("keep");
      expect(rows.at(-1)?.kind).toBe("close");
      expect(rows.at(-1)?.depth).toBe(0);
   });

   it("collapses a sibling branch rather than dropping it", () => {
      const rows = flatten({ big: oversized(), other: [1, 2, 3] });
      const other = rows.find((r) => r.label === "other");
      expect(other?.kind).toBe("closed");
      expect(other?.count).toBe(3);
   });

   it("keeps synthetic rows distinct from property names that resemble their IDs", () => {
      const value = Object.fromEntries([
         ["truncated", 0],
         ["…", 0],
         ["0/truncated", 0],
         ...Array.from({ length: MAX_JSON_PREVIEW_ROWS }, (_, index) => [
            `key-${index}`,
            index,
         ]),
      ]);
      const rows = flatten(value);
      expect(rows.some((row) => row.kind === "truncated")).toBe(true);
      expect(
         new Set(
            rows.filter((row) => row.kind !== "close").map((row) => row.path)
         ).size
      ).toBe(rows.length - 1);
   });
});

describe("nesting depth cap", () => {
   const nested = (levels: number): Json => {
      let value: Json = [];
      for (let i = 0; i < levels; i++) value = [value];
      return value;
   };

   it("folds a branch at the depth limit instead of recursing into it", () => {
      const rows = flatten(nested(MAX_JSON_PREVIEW_DEPTH + 5), new Map(), true);
      const deepest = rows.reduce((max, r) => Math.max(max, r.depth), 0);
      expect(deepest).toBe(MAX_JSON_PREVIEW_DEPTH);
      const folded = rows.find((r) => r.depth === MAX_JSON_PREVIEW_DEPTH);
      expect(folded?.kind).toBe("closed");
   });

   it("keeps an override from reopening a branch past the limit", () => {
      const path = "/0".repeat(MAX_JSON_PREVIEW_DEPTH);
      const rows = flatten(
         nested(MAX_JSON_PREVIEW_DEPTH + 5),
         new Map([[path, true]]),
         true
      );
      expect(rows.find((r) => r.path === path)?.kind).toBe("closed");
   });

   it("survives a fifty-thousand-deep array", () => {
      const value = nested(50000);
      expect(() => flatten(value, new Map(), true)).not.toThrow();
      expect(countNodes(value, 5000)).toBe(MAX_JSON_PREVIEW_DEPTH);
   });
});

describe("countNodes", () => {
   it("counts every entry in the tree", () => {
      expect(countNodes({ a: 1, b: { c: 2 } }, 100)).toBe(3);
   });

   it("stops once it reaches the limit", () => {
      const wide = Object.fromEntries(
         Array.from({ length: 50 }, (_, i) => [String(i), i])
      );
      expect(countNodes(wide, 10)).toBe(10);
   });
});
