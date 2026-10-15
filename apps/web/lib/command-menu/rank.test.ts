import { Folder } from "lucide-react";
import { describe, expect, it } from "vitest";
import { flatten, rankCommands } from "./rank";
import { GROUP_LIMITS, type CommandGroup, type CommandItem } from "./types";

const item = (
   id: string,
   group: CommandGroup,
   label: string,
   extra: Partial<CommandItem> = {}
): CommandItem =>
   ({ id, group, label, icon: Folder, run: () => {}, ...extra }) as CommandItem;

const CATALOG: CommandItem[] = [
   item("nav:dashboard", "Navigation", "Dashboard", {
      keywords: "buckets home",
   }),
   item("nav:profile", "Navigation", "Profile"),
   item("action:create-bucket", "Actions", "Create bucket"),
   item("action:sign-out", "Actions", "Sign out", { keywords: "log out" }),
   item("bucket:prod-logs", "Buckets", "prod-logs"),
   item("bucket:prod-assets", "Buckets", "prod-assets"),
   item("server:one", "Servers", "Backblaze"),
];

const idsOf = (commands: CommandItem[]) => commands.map((c) => c.id);

const groupsOf = (query: string, recents: string[] = []) =>
   rankCommands(CATALOG, query, recents).map((group) => group.group);

describe("rankCommands with no query", () => {
   it("returns every command in the canonical group order", () => {
      expect(groupsOf("")).toEqual([
         "Navigation",
         "Buckets",
         "Actions",
         "Servers",
      ]);
      expect(flatten(rankCommands(CATALOG, "", []))).toHaveLength(
         CATALOG.length
      );
   });

   it("promotes recents into their own group ahead of everything", () => {
      const groups = rankCommands(CATALOG, "", [
         "action:sign-out",
         "bucket:prod-logs",
      ]);
      expect(groups[0]?.group).toBe("Recent");
      expect(idsOf(groups[0]?.items.map((i) => i.command) ?? [])).toEqual([
         "action:sign-out",
         "bucket:prod-logs",
      ]);
   });

   it("does not list a promoted command twice", () => {
      const ids = idsOf(flatten(rankCommands(CATALOG, "", ["nav:dashboard"])));
      expect(ids.filter((id) => id === "nav:dashboard")).toHaveLength(1);
   });

   it("ignores a recent id that is no longer in the catalog", () => {
      const groups = rankCommands(CATALOG, "", ["bucket:deleted"]);
      expect(groups[0]?.group).toBe("Navigation");
   });
});

describe("rankCommands with a query", () => {
   it("drops commands that do not match", () => {
      const ids = idsOf(flatten(rankCommands(CATALOG, "prod", [])));
      expect(ids).toEqual(["bucket:prod-assets", "bucket:prod-logs"]);
   });

   it("floats the group holding the best match", () => {
      expect(groupsOf("prod")[0]).toBe("Buckets");
      expect(groupsOf("create")[0]).toBe("Actions");
   });

   it("never shows a Recent group", () => {
      expect(groupsOf("prod", ["nav:dashboard"])).not.toContain("Recent");
   });

   it("matches on keywords the label does not contain", () => {
      expect(idsOf(flatten(rankCommands(CATALOG, "log out", [])))).toContain(
         "action:sign-out"
      );
   });

   it("breaks a score tie with recency, then alphabetically", () => {
      const byRecency = idsOf(
         flatten(rankCommands(CATALOG, "prod-", ["bucket:prod-logs"]))
      );
      expect(byRecency[0]).toBe("bucket:prod-logs");
      const byLabel = idsOf(flatten(rankCommands(CATALOG, "prod-", [])));
      expect(byLabel[0]).toBe("bucket:prod-assets");
   });

   it("returns nothing when a term matches nothing", () => {
      expect(rankCommands(CATALOG, "prod zzz", [])).toEqual([]);
   });
});

describe("group limits", () => {
   it("caps a group at its limit", () => {
      const many = Array.from({ length: 12 }, (_, index) =>
         item(`bucket:${index}`, "Buckets", `bucket-${index}`)
      );
      const groups = rankCommands(many, "bucket", []);
      expect(groups[0]?.items).toHaveLength(GROUP_LIMITS.Buckets ?? 0);
   });

   it("leaves uncapped groups whole", () => {
      const many = Array.from({ length: 12 }, (_, index) =>
         item(`action:${index}`, "Actions", `action ${index}`)
      );
      expect(rankCommands(many, "action", [])[0]?.items).toHaveLength(12);
   });
});
