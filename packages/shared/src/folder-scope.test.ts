import { describe, expect, it } from "vitest";
import { Role } from "./server-types";
import {
   MAX_GRANT_FOLDERS,
   canLimitToFolders,
   folderScopeCovers,
   foldersLeadingToScope,
   hasDotSegment,
   isInFolderScope,
   isPrefixInFolderScope,
   normalizeFolders,
   prefixHasDotSegment,
   sameFolderScope,
} from "./folder-scope";
import {
   bucketAccessEntrySchema,
   grantFolderSchema,
   inviteTargetSchema,
   updateRoleSchema,
} from "./schemas";

const landing = ["landing/"];

describe("isInFolderScope", () => {
   it("lets a whole-bucket grant reach any key", () => {
      expect(isInFolderScope(null, "anything/at/all")).toBe(true);
      expect(isInFolderScope(null, "")).toBe(true);
   });

   it("reaches the folder itself and everything under it", () => {
      expect(isInFolderScope(landing, "landing/")).toBe(true);
      expect(isInFolderScope(landing, "landing/hero.png")).toBe(true);
      expect(isInFolderScope(landing, "landing/img/a/b.png")).toBe(true);
   });

   it("stops at the folder boundary, not at a shared name", () => {
      expect(isInFolderScope(landing, "landing")).toBe(false);
      expect(isInFolderScope(landing, "landing-internal/plan.pdf")).toBe(false);
      expect(isInFolderScope(landing, "landing.txt")).toBe(false);
      expect(isInFolderScope(landing, "uploads/landing/x")).toBe(false);
      expect(isInFolderScope(landing, "Landing/x")).toBe(false);
      expect(isInFolderScope(landing, "")).toBe(false);
   });

   it("reaches nothing when limited to no folders", () => {
      expect(isInFolderScope([], "landing/x")).toBe(false);
      expect(isInFolderScope([], "")).toBe(false);
   });

   it("refuses dot segments even under an allowed folder", () => {
      expect(isInFolderScope(landing, "landing/../uploads/x")).toBe(false);
      expect(isInFolderScope(landing, "landing/./x")).toBe(false);
      expect(isInFolderScope(landing, "landing/a/..")).toBe(false);
      expect(isInFolderScope(landing, "landing/a\\..\\..\\x")).toBe(false);
      expect(isInFolderScope(landing, "landing/..hidden")).toBe(true);
      expect(isInFolderScope(landing, "landing/.env")).toBe(true);
      expect(isInFolderScope(landing, "landing/a..b/c")).toBe(true);
   });

   it("does not treat encoded or lookalike separators as traversal or as a match", () => {
      expect(isInFolderScope(landing, "landing/%2e%2e/x")).toBe(true);
      expect(isInFolderScope(landing, "landing%2Fx")).toBe(false);
      expect(isInFolderScope(landing, "landing∕x")).toBe(false);
      expect(isInFolderScope(["café/"], "café/x")).toBe(false);
   });
});

describe("isPrefixInFolderScope", () => {
   it("accepts a prefix that ends mid-name inside a folder", () => {
      expect(isPrefixInFolderScope(landing, "landing/he")).toBe(true);
      expect(isPrefixInFolderScope(landing, "landing/.")).toBe(true);
      expect(isPrefixInFolderScope(landing, "landing/.e")).toBe(true);
      expect(isPrefixInFolderScope(landing, "landing/..hid")).toBe(true);
      expect(isPrefixInFolderScope(landing, "landing/")).toBe(true);
   });

   it("refuses a prefix that could name a parent, with either separator", () => {
      expect(isPrefixInFolderScope(landing, "landing/..")).toBe(false);
      expect(isPrefixInFolderScope(landing, "landing/..\\")).toBe(false);
      expect(isPrefixInFolderScope(landing, "landing/..\\..\\private\\")).toBe(
         false
      );
      expect(isPrefixInFolderScope(landing, "landing/a\\..\\b")).toBe(false);
      expect(prefixHasDotSegment("a/./b")).toBe(true);
      expect(prefixHasDotSegment("..")).toBe(true);
      expect(prefixHasDotSegment(".")).toBe(false);
      expect(prefixHasDotSegment("a/..b")).toBe(false);
      expect(prefixHasDotSegment("")).toBe(false);
   });

   it("still refuses a completed dot segment and anything outside", () => {
      expect(isPrefixInFolderScope(landing, "landing/../")).toBe(false);
      expect(isPrefixInFolderScope(landing, "landing/../up")).toBe(false);
      expect(isPrefixInFolderScope(landing, "land")).toBe(false);
      expect(isPrefixInFolderScope(landing, "")).toBe(false);
      expect(isPrefixInFolderScope(null, "")).toBe(true);
   });
});

describe("hasDotSegment", () => {
   it("finds . and .. segments across either separator", () => {
      expect(hasDotSegment("a/../b")).toBe(true);
      expect(hasDotSegment("./a")).toBe(true);
      expect(hasDotSegment("a/.")).toBe(true);
      expect(hasDotSegment("a\\..\\b")).toBe(true);
      expect(hasDotSegment("..")).toBe(true);
      expect(hasDotSegment("a/.../b")).toBe(false);
      expect(hasDotSegment("a/.b/c..")).toBe(false);
      expect(hasDotSegment("")).toBe(false);
   });
});

describe("normalizeFolders", () => {
   it("sorts, removes duplicates, and drops folders another one contains", () => {
      expect(
         normalizeFolders(["b/", "a/b/", "a/", "b/", "a/b/c/", "ab/"])
      ).toEqual(["a/", "ab/", "b/"]);
   });

   it("keeps folders that only share a name prefix", () => {
      expect(normalizeFolders(["landing-v2/", "landing/"])).toEqual([
         "landing-v2/",
         "landing/",
      ]);
   });
});

describe("folderScopeCovers", () => {
   it("lets the whole bucket cover anything and nothing limited cover it", () => {
      expect(folderScopeCovers(null, null)).toBe(true);
      expect(folderScopeCovers(null, ["a/"])).toBe(true);
      expect(folderScopeCovers(["a/"], null)).toBe(false);
   });

   it("covers the same folders and folders nested inside them", () => {
      expect(folderScopeCovers(["a/", "b/"], ["a/"])).toBe(true);
      expect(folderScopeCovers(["a/"], ["a/deep/er/"])).toBe(true);
      expect(folderScopeCovers(["a/deep/"], ["a/"])).toBe(false);
      expect(folderScopeCovers(["a/"], ["a/", "b/"])).toBe(false);
      expect(folderScopeCovers(["a/"], ["ab/"])).toBe(false);
   });
});

describe("sameFolderScope", () => {
   it("compares limits regardless of order and never equates a limit with the whole bucket", () => {
      expect(sameFolderScope(null, null)).toBe(true);
      expect(sameFolderScope(["b/", "a/"], ["a/", "b/"])).toBe(true);
      expect(sameFolderScope(["a/"], ["a/", "b/"])).toBe(false);
      expect(sameFolderScope(null, ["a/"])).toBe(false);
      expect(sameFolderScope([], null)).toBe(false);
   });
});

describe("foldersLeadingToScope", () => {
   const scope = ["blog/images/", "blog/drafts/2026/", "landing/"];

   it("shows the next step toward each folder from the root", () => {
      expect(foldersLeadingToScope(scope, "")).toEqual(["blog/", "landing/"]);
   });

   it("walks down an ancestor one level at a time", () => {
      expect(foldersLeadingToScope(scope, "blog/")).toEqual([
         "blog/drafts/",
         "blog/images/",
      ]);
      expect(foldersLeadingToScope(scope, "blog/drafts/")).toEqual([
         "blog/drafts/2026/",
      ]);
   });

   it("completes a partly typed name and reveals no siblings", () => {
      expect(foldersLeadingToScope(scope, "land")).toEqual(["landing/"]);
      expect(foldersLeadingToScope(scope, "b")).toEqual(["blog/"]);
   });

   it("shows nothing for an unrelated path or inside a folder", () => {
      expect(foldersLeadingToScope(scope, "private/")).toEqual([]);
      expect(foldersLeadingToScope(scope, "landing/")).toEqual([]);
      expect(foldersLeadingToScope(scope, "landing/img/")).toEqual([]);
   });
});

describe("grant schemas", () => {
   const entry = (role: string, folders: unknown) =>
      bucketAccessEntrySchema.safeParse({
         bucketName: "company",
         role,
         folders,
      });

   it("accepts a whole-bucket grant and a normalized folder list", () => {
      expect(entry("EDITOR", null).success).toBe(true);
      const limited = entry("EDITOR", ["b/", "a/", "a/x/", "b/"]);
      expect(limited.success && limited.data.folders).toEqual(["a/", "b/"]);
   });

   it("refuses a grant that does not say whether it is limited", () => {
      expect(
         bucketAccessEntrySchema.safeParse({
            bucketName: "company",
            role: "EDITOR",
         }).success
      ).toBe(false);
   });

   it("refuses an empty folder list instead of reading it as the whole bucket", () => {
      expect(entry("EDITOR", []).success).toBe(false);
   });

   it("keeps admins bucket-wide", () => {
      expect(entry("ADMIN", ["a/"]).success).toBe(false);
      expect(entry("ADMIN", null).success).toBe(true);
      expect(canLimitToFolders(Role.ADMIN)).toBe(false);
      expect(canLimitToFolders(Role.OWNER)).toBe(false);
      expect(canLimitToFolders(Role.EDITOR)).toBe(true);
      expect(canLimitToFolders(Role.VIEWER)).toBe(true);
   });

   it("caps how many folders one grant can name", () => {
      const many = Array.from(
         { length: MAX_GRANT_FOLDERS + 1 },
         (_, i) => `f${i}/`
      );
      expect(entry("VIEWER", many).success).toBe(false);
      expect(entry("VIEWER", many.slice(1)).success).toBe(true);
   });

   it.each([
      "landing",
      "/landing/",
      "",
      "/",
      "a//b/",
      "a/../b/",
      "./a/",
      "a/./",
      "a\\..\\b/",
      "a\u0000b/",
      "a\nb/",
      "\ud800/",
   ])("refuses %j as a folder", (folder) => {
      expect(grantFolderSchema.safeParse(folder).success).toBe(false);
   });

   it.each(["landing/", "a/b/c/", "with space/", "ünï/", "100%/", "a+b/"])(
      "accepts %j as a folder",
      (folder) => {
         expect(grantFolderSchema.safeParse(folder).success).toBe(true);
      }
   );
});

describe("member and invite schemas", () => {
   const limited = { bucketName: "company", role: "EDITOR", folders: ["a/"] };
   const whole = { bucketName: "company", role: "EDITOR", folders: null };
   const invite = (role: string, bucketAccess: unknown[]) =>
      inviteTargetSchema.safeParse({
         serverId: "server12345",
         role,
         bucketAccess,
      });
   const update = (body: Record<string, unknown>) =>
      updateRoleSchema.safeParse({
         serverId: "server12345",
         userId: "target1234",
         ...body,
      });

   it("keeps folder limits to viewers and editors of the server", () => {
      expect(invite("EDITOR", [limited]).success).toBe(true);
      expect(invite("VIEWER", [limited]).success).toBe(true);
      expect(invite("ADMIN", [limited]).success).toBe(false);
      expect(invite("ADMIN", [whole]).success).toBe(true);
      expect(
         update({
            role: "ADMIN",
            bucketAccess: [limited],
            previousBucketAccess: [],
         }).success
      ).toBe(false);
   });

   it("requires an access change to say what it was made from", () => {
      expect(update({ role: "EDITOR" }).success).toBe(true);
      expect(update({ role: "EDITOR", bucketAccess: [whole] }).success).toBe(
         false
      );
      expect(
         update({
            role: "EDITOR",
            bucketAccess: [whole],
            previousBucketAccess: [limited],
         }).success
      ).toBe(true);
   });
});
