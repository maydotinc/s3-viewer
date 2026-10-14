import { Role, type S3Bucket } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import {
   DOT_SEGMENTS,
   accessNotice,
   canActOnFolder,
   canListPrefix,
   canWriteAt,
   folderAccessAt,
   grantLabel,
   limitedGrantsNote,
   reachOf,
   renameBlockReason,
   rowBlockReason,
   uploadsScope,
   writeBlockReason,
   writeScopeError,
   type Reach,
} from "./folder-access";

const SCOPE = ["blog/images/", "landing/"];
const limited: Reach = { folders: SCOPE, owner: false };
const whole: Reach = { folders: null, owner: false };
const owner: Reach = { folders: null, owner: true };

const bucket = (userRole: Role, folders: string[] | null = null): S3Bucket => ({
   name: "site",
   creationDate: null,
   userRole,
   folders,
});

describe("what someone can reach in a bucket", () => {
   it("reads it off the bucket list, ignoring folders for the owner", () => {
      expect(reachOf(undefined)).toBeUndefined();
      expect(reachOf(bucket(Role.EDITOR, SCOPE))).toEqual(limited);
      expect(reachOf(bucket(Role.VIEWER))).toEqual(whole);
      expect(reachOf(bucket(Role.OWNER, ["x/"]))).toEqual(owner);
   });

   it.each([
      [undefined, "", "pending"],
      [whole, "", "whole"],
      [whole, "anything/", "whole"],
      [limited, "", "leading"],
      [limited, "blog/", "leading"],
      [limited, "land", "leading"],
      [limited, "landing/", "inside"],
      [limited, "landing/hero/", "inside"],
      [limited, "blog/images/2026/", "inside"],
      [limited, "blog/posts/", "outside"],
      [limited, "private/", "outside"],
      [limited, "landing/../private/", "dotted"],
      [whole, "a/../b/", "dotted"],
      [whole, "a\\.\\b/", "dotted"],
      [owner, "a/../b/", "whole"],
   ] as const)("reach %j at %j is %s", (reach, prefix, expected) => {
      expect(folderAccessAt(reach, prefix)).toBe(expected);
   });

   it("only writes inside a known reach, and dot segments are the owner's", () => {
      expect(canWriteAt(whole, "")).toBe(true);
      expect(canWriteAt(limited, "landing/index.html")).toBe(true);
      expect(canWriteAt(limited, "")).toBe(false);
      expect(canWriteAt(limited, "blog/")).toBe(false);
      expect(canWriteAt(undefined, "landing/")).toBe(false);
      expect(canWriteAt(whole, "a/../b")).toBe(false);
      expect(canWriteAt(owner, "a/../b")).toBe(true);
   });

   it("doesn't list a dotted prefix for anyone but the owner", () => {
      expect(canListPrefix(whole, "a/..")).toBe(false);
      expect(canListPrefix(whole, "a/../")).toBe(false);
      expect(canListPrefix(limited, "landing/./")).toBe(false);
      expect(canListPrefix(whole, "a/.")).toBe(true);
      expect(canListPrefix(whole, "a/.e")).toBe(true);
      expect(canListPrefix(owner, "a/..")).toBe(true);
      expect(canListPrefix(undefined, "a/..")).toBe(false);
      expect(canListPrefix(undefined, "a/")).toBe(true);
   });
});

describe("folder commands in the command menu", () => {
   it("lets the server owner act anywhere without waiting for buckets", () => {
      expect(canActOnFolder(Role.OWNER, undefined, "a/../")).toBe(true);
   });

   it("waits for the bucket list before offering them to anyone else", () => {
      expect(canActOnFolder(Role.EDITOR, undefined, "")).toBe(false);
      expect(canActOnFolder(undefined, undefined, "")).toBe(false);
   });

   it("only offers them inside someone's folders", () => {
      const site = bucket(Role.EDITOR, SCOPE);
      expect(canActOnFolder(Role.EDITOR, site, "landing/")).toBe(true);
      expect(canActOnFolder(Role.EDITOR, site, "")).toBe(false);
      expect(canActOnFolder(Role.EDITOR, site, "blog/")).toBe(false);
      expect(canActOnFolder(Role.EDITOR, bucket(Role.EDITOR), "")).toBe(true);
      expect(canActOnFolder(Role.EDITOR, bucket(Role.EDITOR), "a/../")).toBe(
         false
      );
   });
});

describe("explaining a blocked write", () => {
   it("names the folders a destination has to be inside", () => {
      expect(
         writeScopeError(
            { folders: ["landing/"], owner: false },
            "private/x.txt"
         )
      ).toBe("You can only write inside landing/ in this bucket.");
      expect(writeScopeError(limited, "landing/x.txt")).toBeNull();
      expect(writeScopeError(whole, "private/x.txt")).toBeNull();
      expect(writeScopeError(undefined, "private/x.txt")).toBeNull();
   });

   it("refuses dot segments to everyone but the owner", () => {
      expect(writeScopeError(whole, "a/../b.txt")).toBe(DOT_SEGMENTS);
      expect(writeScopeError(whole, "a\\..\\b.txt")).toBe(DOT_SEGMENTS);
      expect(writeScopeError(limited, "landing/../b.txt")).toBe(DOT_SEGMENTS);
      expect(writeScopeError(owner, "a/../b.txt")).toBeNull();
   });

   it("points uploads at the folders reachable from here", () => {
      expect(writeBlockReason(limited, "blog/")).toBe(
         "You can only add files and folders inside blog/images/."
      );
      expect(writeBlockReason(limited, "")).toBe(
         "You can only add files and folders inside blog/images/ and landing/."
      );
      expect(writeBlockReason(limited, "private/")).toBe(
         "You can only add files and folders inside blog/images/ and landing/."
      );
      expect(writeBlockReason(limited, "landing/")).toBeNull();
      expect(writeBlockReason(whole, "")).toBeNull();
      expect(writeBlockReason(undefined, "")).toBeNull();
      expect(writeBlockReason(whole, "a/../")).toBe(DOT_SEGMENTS);
      expect(writeBlockReason(owner, "a/../")).toBeNull();
   });

   it("turns off actions on the rows that only lead to someone's folders", () => {
      expect(rowBlockReason(limited, "blog/")).toBe(
         "No actions here. Only blog/images/ is shared with you."
      );
      expect(rowBlockReason(limited, "")).toBe(
         "No actions here. Only blog/images/ and landing/ are shared with you."
      );
      expect(rowBlockReason(limited, "private/")).toBe(
         "This isn't shared with you."
      );
      expect(rowBlockReason(limited, "landing/")).toBeNull();
      expect(rowBlockReason(limited, "landing/a.txt")).toBeNull();
      expect(rowBlockReason(whole, "blog/")).toBeNull();
      expect(rowBlockReason(undefined, "blog/")).toBeNull();
   });

   it("turns off actions on dotted rows for everyone but the owner", () => {
      expect(rowBlockReason(whole, "a/../")).toBe(DOT_SEGMENTS);
      expect(rowBlockReason(limited, "landing/./x")).toBe(DOT_SEGMENTS);
      expect(rowBlockReason(owner, "a/../")).toBeNull();
   });

   it("won't rename a folder that was shared, but anything inside it", () => {
      expect(renameBlockReason(limited, "landing/")).toBe(
         "You can't rename a folder that was shared with you."
      );
      expect(renameBlockReason(limited, "blog/images/")).toBe(
         "You can't rename a folder that was shared with you."
      );
      expect(rowBlockReason(limited, "landing/")).toBeNull();
      expect(renameBlockReason(limited, "landing/hero/")).toBeNull();
      expect(renameBlockReason(whole, "landing/")).toBeNull();
      expect(renameBlockReason(owner, "landing/")).toBeNull();
      expect(renameBlockReason(undefined, "landing/")).toBeNull();
   });
});

describe("the notice above someone's folders", () => {
   it("counts the folders it links to", () => {
      const scope = ["blog/images/", "blog/posts/", "landing/"];
      expect(accessNotice(scope, "")).toEqual({
         title: "You have access to 3 folders in this bucket",
         detail: "Only the folders that lead to them are shown here.",
         folders: scope,
      });
      expect(accessNotice(scope, "blog/")).toEqual({
         title: "You have access to 2 folders under blog/",
         detail: "Only the folders that lead to them are shown here.",
         folders: ["blog/images/", "blog/posts/"],
      });
      expect(accessNotice(["landing/"], "")).toMatchObject({
         title: "You have access to 1 folder in this bucket",
         detail: "Only the folders that lead to it are shown here.",
      });
   });
});

describe("folder names in messages", () => {
   it("spells out characters that would reorder or hide part of a folder name", () => {
      const tricky: Reach = { folders: ["docs\u202Efdp/"], owner: false };
      expect(writeScopeError(tricky, "private/x.txt")).toBe(
         "You can only write inside docs[U+202E]fdp/ in this bucket."
      );
      expect(accessNotice(["a\u200B/b/"], "a\u200B/").title).toBe(
         "You have access to 1 folder under a[U+200B]/"
      );
      expect(uploadsScope(whole, "a\u2066/")).toBe("under a[U+2066]/");
      expect(
         grantLabel({
            bucketName: "site",
            role: Role.EDITOR,
            folders: ["x\u202E/"],
         })
      ).toBe("Editor · x[U+202E]/ only");
   });
});

describe("where incomplete uploads were looked for", () => {
   it("says only someone's own folders were checked", () => {
      expect(uploadsScope(limited, "")).toBe("in your folders");
      expect(uploadsScope(limited, "blog/")).toBe(
         "in your folders under blog/"
      );
      expect(uploadsScope(limited, "landing/")).toBe("under landing/");
      expect(uploadsScope(whole, "")).toBe("in this bucket");
      expect(uploadsScope(whole, "photos/")).toBe("under photos/");
      expect(uploadsScope(undefined, "")).toBe("in this bucket");
   });
});

describe("describing a grant", () => {
   it("labels the role and its folders", () => {
      const entry = { bucketName: "site", role: Role.EDITOR };
      expect(grantLabel({ ...entry, folders: null })).toBe("Editor");
      expect(grantLabel({ ...entry, folders: ["landing/"] })).toBe(
         "Editor · landing/ only"
      );
      expect(grantLabel({ ...entry, folders: ["a/", "b/", "c/"] })).toBe(
         "Editor · 3 folders"
      );
   });

   it("only notes grants limited to folders", () => {
      const wholeGrant = {
         bucketName: "logs",
         role: Role.VIEWER,
         folders: null,
      };
      const site = { bucketName: "site", role: Role.EDITOR, folders: ["a/"] };
      const docs = {
         bucketName: "docs",
         role: Role.VIEWER,
         folders: ["x/", "y/"],
      };
      expect(limitedGrantsNote([wholeGrant])).toBeNull();
      expect(limitedGrantsNote([wholeGrant, site])).toBe("site: a/ only");
      expect(limitedGrantsNote([docs])).toBe("docs: 2 folders");
      expect(limitedGrantsNote([wholeGrant, site, docs])).toBe(
         "Folders only on 2 buckets"
      );
   });
});
