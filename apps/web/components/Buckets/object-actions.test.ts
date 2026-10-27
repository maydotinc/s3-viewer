import type { ObjectCommands } from "@/components/Buckets/useObjectCommands";
import { describe, expect, it, vi } from "vitest";
import { objectActions } from "./object-actions";

const commands = (can: Partial<ObjectCommands["can"]> = {}) =>
   ({
      can: { download: true, rename: true, upload: true, delete: true, ...can },
      isPreparingZip: false,
      transfer: vi.fn(),
      downloadZip: vi.fn(),
   }) as unknown as ObjectCommands;

const object = {
   kind: "object",
   key: "a.txt",
   eTag: '"e"',
   listing: { size: 1, prefix: "" },
} as const;
const folder = { kind: "folder", key: "f/", renameBlocked: null } as const;
const selection = {
   kind: "selection",
   prefix: "",
   keys: ["a.txt"],
   blocked: () => false,
   reviewed: () => [{ key: "a.txt", expectedETag: '"e"', size: 1 }],
   onSettled: () => {},
} as const;

const labelOf = (actions: ReturnType<typeof objectActions>, id: string) =>
   actions.find((action) => action.id === id)?.label;

describe("object actions", () => {
   it("words an action the same for an object, a folder and a selection", () => {
      const all = [object, folder, selection].map((target) =>
         objectActions(commands(), target)
      );
      expect(new Set(all.map((list) => labelOf(list, "transfer")))).toEqual(
         new Set(["Copy to another bucket…"])
      );
      expect(labelOf(all[1]!, "zip")).toBe(labelOf(all[2]!, "zip"));
   });

   it("lets a cramped surface shorten a label without changing the rest", () => {
      const actions = objectActions(commands(), selection, {
         transfer: "Copy to bucket",
      });
      expect(labelOf(actions, "transfer")).toBe("Copy to bucket");
      expect(labelOf(actions, "bulkRename")).toBe("Bulk rename…");
   });

   it("offers another bucket only for a row from a listing", () => {
      const page = { kind: "object", key: "a.txt", eTag: '"e"' } as const;
      expect(
         labelOf(objectActions(commands(), page), "transfer")
      ).toBeUndefined();
   });

   it("leaves out what the caller's role can't do", () => {
      const ids = objectActions(commands({ download: false }), object).map(
         ({ id }) => id
      );
      expect(ids).toEqual(["settings", "rename", "copy", "delete"]);
   });

   it("offers a zip download and no link for a key a browser can't fetch", () => {
      const actions = objectActions(commands(), { ...object, key: "a/../b" });
      expect(labelOf(actions, "download")).toBe("Download as zip");
      expect(labelOf(actions, "copyLink")).toBeUndefined();
   });

   it("sends a selection only once it has been reviewed", () => {
      const run = commands();
      const reviewed = vi.fn(() => null);
      objectActions(run, { ...selection, reviewed })
         .find(({ id }) => id === "transfer")!
         .onSelect();
      expect(reviewed).toHaveBeenCalledOnce();
      expect(run.transfer).not.toHaveBeenCalled();
   });
});
