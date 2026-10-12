import { one, text } from "@/lib/test/elements";
import type { ObjectCommands } from "@/components/Buckets/useObjectCommands";
import type { KnownReach } from "@/lib/utils/folder-access";
import type { S3Object } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const state = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("./grid-state", () => ({ useObjectGridState: () => state.current }));

import { ActionMenuItems, type SecondaryAction } from "./action-menu";
import RowActions, { RowActionsMenu } from "./row-actions";

const can = {
   download: true,
   rename: true,
   upload: true,
   delete: true,
} as ObjectCommands["can"];
const commands = { can, moveMany: vi.fn() } as unknown as ObjectCommands;

const folder = (key: string): S3Object =>
   ({ key, isFolder: true, eTag: null, size: null }) as unknown as S3Object;

type Element = { type: unknown; props: Record<string, unknown> };

const menu = (reach: KnownReach, key: string) =>
   RowActionsMenu({
      bucketName: "site",
      prefix: "",
      reach,
      data: folder(key),
      commands,
   }) as unknown as Element;

const actions = (reach: KnownReach, key: string) =>
   one(
      menu(reach, key),
      (element) => element.type === ActionMenuItems,
      "menu items"
   ).props.actions as SecondaryAction[];

const action = (reach: KnownReach, key: string, label: string) => {
   const found = actions(reach, key).find((entry) => entry.label === label);
   if (!found) throw new Error(`No ${label} action.`);
   return found;
};

const LIMITED: KnownReach = { folders: ["landing/"], owner: false };

describe("actions on a folder that was shared", () => {
   it("offers no rename, and says why", () => {
      expect(action(LIMITED, "landing/", "Rename folder")).toMatchObject({
         disabled: true,
         description: "You can't rename a folder that was shared with you.",
      });
   });

   it("still offers delete, copy and zip, which work inside it", () => {
      const labels = actions(LIMITED, "landing/").map(({ label }) => label);
      for (const label of ["Delete folder", "Download as zip", "Bulk rename…"])
         expect(labels).toContain(label);
      expect(action(LIMITED, "landing/", "Delete folder").disabled).toBeFalsy();
   });

   it("renames folders inside it as usual", () => {
      expect(action(LIMITED, "landing/hero/", "Rename folder")).toMatchObject({
         disabled: false,
         description: null,
      });
   });

   it("renames anything for someone with the whole bucket", () => {
      expect(
         action({ folders: null, owner: false }, "landing/", "Rename folder")
            .disabled
      ).toBe(false);
   });
});

describe("rows someone can't act on", () => {
   it("turns the menu off with the reason", () => {
      const tree = menu(LIMITED, "private/") as Element;
      expect(text(tree)).not.toContain("Delete folder");
      const tip = one(tree, (element) => "label" in element.props, "tooltip");
      expect(tip.props.label).toBe("This isn't shared with you.");
   });

   it("turns it off on a dotted row for anyone but the owner", () => {
      const tip = one(
         menu({ folders: null, owner: false }, "a/../"),
         (element) => "label" in element.props,
         "tooltip"
      );
      expect(tip.props.label).toBe(
         "Paths with . or .. segments can only be opened by the server owner."
      );
      expect(
         actions({ folders: null, owner: true }, "a/../").map(
            ({ label }) => label
         )
      ).toContain("Delete folder");
   });
});

describe("row actions after permissions change", () => {
   it("reads the live grid state rather than the context AG Grid captured", () => {
      const before = {
         bucketName: "site",
         prefix: "",
         reach: LIMITED,
         commands,
      };
      const after = {
         ...before,
         commands: { ...commands, can: { ...can, delete: false } },
      };
      const params = { data: folder("landing/"), context: before };
      state.current = after;
      const row = RowActions(params as never) as unknown as Element;
      expect(row.props.commands).toBe(after.commands);
   });
});
