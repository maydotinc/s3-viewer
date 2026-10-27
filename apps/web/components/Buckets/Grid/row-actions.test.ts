import { all, one, type Element } from "@/lib/test/elements";
import type { ObjectCommands } from "@/components/Buckets/useObjectCommands";
import OverflowMenu from "@/components/overflow-menu";
import type { KnownReach } from "@/lib/utils/folder-access";
import type { S3Object } from "@s3-viewer/shared";
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
const commands = { can } as unknown as ObjectCommands;

const folder = (key: string): S3Object =>
   ({ key, isFolder: true, eTag: null, size: null }) as unknown as S3Object;

const menu = (reach: KnownReach, key: string) =>
   RowActionsMenu({
      serverId: "server",
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

   it("still offers delete, zip and bulk rename, which work inside it", () => {
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
   const shownMenu = (reach: KnownReach, key: string) => {
      const overflow = one(
         menu(reach, key),
         (element) => element.type === OverflowMenu,
         "overflow menu"
      );
      return OverflowMenu(
         overflow.props as Parameters<typeof OverflowMenu>[0]
      ) as unknown as Element;
   };
   const tooltip = (tree: Element) =>
      one(tree, (element) => "label" in element.props, "tooltip").props.label;

   it("turns the menu off with the reason", () => {
      const tree = shownMenu(LIMITED, "private/");
      expect(
         all(tree, (element) => element.type === ActionMenuItems)
      ).toHaveLength(0);
      expect(
         one(tree, (element) => "disabled" in element.props, "trigger").props
            .disabled
      ).toBe(true);
      expect(tooltip(tree)).toBe("This isn't shared with you.");
   });

   it("turns it off on a dotted row for anyone but the owner", () => {
      expect(tooltip(shownMenu({ folders: null, owner: false }, "a/../"))).toBe(
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
         serverId: "server",
         bucketName: "site",
         prefix: "",
         reach: LIMITED,
         commands,
      };
      const after = { ...before, commands: { ...commands } };
      const params = { data: folder("landing/"), context: before };
      state.current = after;
      const row = RowActions(params as never) as unknown as Element;
      expect(row.props.commands).toBe(after.commands);
   });
});
