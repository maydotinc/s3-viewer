import { describe, expect, it } from "vitest";
import { countNodes, flattenJson, type Json } from "./json-rows";

const flatten = (
   value: Json,
   overrides: Map<string, boolean> = new Map(),
   expandAll: boolean | null = null,
   small = true
) => flattenJson({ value, overrides, expandAll, small });

describe("flattenJson", () => {
   it("emits one row for a scalar root", () => {
      const rows = flatten(42);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.kind).toBe("scalar");
   });

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
      const rows = flatten({ a: { b: 1 } }, new Map([["/a", false]]));
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

   it("gives every row a distinct path", () => {
      const rows = flatten({ a: { b: 1 }, c: [2] });
      const paths = rows.map((r) => `${r.path}:${r.kind}`);
      expect(new Set(paths).size).toBe(paths.length);
   });

   it("keeps paths distinct when a key contains a slash", () => {
      const rows = flatten({ a: { b: [1, 2] }, "a/b": [3, 4] });
      const paths = rows.map((r) => `${r.path}:${r.kind}`);
      expect(new Set(paths).size).toBe(paths.length);
   });

   it("folds only the branch that was toggled when keys collide", () => {
      const value = { a: { b: [1, 2] }, "a/b": [3, 4] };
      const nested = flatten(value).find(
         (r) => r.label === "b" && r.kind === "open"
      );
      expect(nested).toBeDefined();
      const rows = flatten(value, new Map([[nested?.path ?? "", false]]));
      expect(rows.filter((r) => r.kind === "closed")).toHaveLength(1);
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
      expect(rows.find((r) => r.path === "/top")?.kind).toBe("closed");
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
