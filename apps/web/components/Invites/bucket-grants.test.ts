import {
   MAX_BUCKET_NAMES,
   MAX_GRANT_FOLDERS,
   Role,
   type BucketAccessEntry,
   type S3Bucket,
} from "@s3-viewer/types";
import { describe, expect, it } from "vitest";

import {
   accessErrors,
   accessKey,
   accessSummaryError,
   checkedGrant,
   commitDraft,
   commitDrafts,
   grantError,
   grantPayload,
   hasDrafts,
   isLocked,
   tooManyBuckets,
   withRole,
   withSpecificFolders,
   withWholeBucket,
   type GrantRow,
} from "./bucket-grants";

const ADMIN_FOLDERS =
   "Admins can't be limited to folders. Choose Whole bucket or a different server role.";

const bucket = (
   userRole: Role,
   folders: string[] | null = null,
   name = "site"
): S3Bucket => ({ name, creationDate: null, userRole, folders });

const grant = (
   role: Role,
   folders: string[] | null,
   bucketName = "site"
): BucketAccessEntry => ({ bucketName, role, folders });

const ownerBucket = bucket(Role.OWNER);

describe("grants the actor couldn't have given", () => {
   it("lock an owner-assigned Admin grant for an admin", () => {
      expect(
         isLocked(Role.ADMIN, bucket(Role.ADMIN), grant(Role.ADMIN, null))
      ).toBe(true);
   });

   it("lock a grant above the role the admin holds on the bucket", () => {
      expect(
         isLocked(Role.ADMIN, bucket(Role.VIEWER), grant(Role.EDITOR, null))
      ).toBe(true);
      expect(
         isLocked(Role.ADMIN, bucket(Role.ADMIN), grant(Role.EDITOR, null))
      ).toBe(false);
   });
});

describe("checking a bucket again after unchecking it", () => {
   it("brings back the access the member had, not the whole bucket", () => {
      const before = grant(Role.EDITOR, ["landing/"]);
      const row = checkedGrant(before, ownerBucket, Role.VIEWER);
      expect(row).toEqual(before);
      expect(row.folders).not.toBe(before.folders);
   });

   it("starts a whole-bucket grant for a bucket the member never had", () => {
      expect(checkedGrant(undefined, ownerBucket, Role.VIEWER)).toEqual(
         grant(Role.VIEWER, null)
      );
   });
});

describe("changing a row's role", () => {
   it("clears folders when the role becomes admin", () => {
      expect(withRole(grant(Role.EDITOR, ["a/"]), Role.ADMIN)).toMatchObject(
         grant(Role.ADMIN, null)
      );
      expect(withRole(grant(Role.EDITOR, ["a/"]), Role.VIEWER)).toEqual(
         grant(Role.VIEWER, ["a/"])
      );
   });

   it("restores the folders when the role comes back from admin", () => {
      const limitedRow = grant(Role.EDITOR, ["a/", "b/"]);
      const admin = withRole(limitedRow, Role.ADMIN);
      expect(grantPayload([admin])).toEqual([
         { bucketName: "site", role: Role.ADMIN, folders: null },
      ]);
      const back = withRole(admin, Role.VIEWER);
      expect(back.folders).toEqual(["a/", "b/"]);
      expect(grantPayload([back])).toEqual([
         { bucketName: "site", role: Role.VIEWER, folders: ["a/", "b/"] },
      ]);
      expect(
         withRole(withRole(admin, Role.ADMIN), Role.EDITOR).folders
      ).toEqual(["a/", "b/"]);
   });

   it("doesn't bring back folders someone chose to drop", () => {
      const whole = withWholeBucket(grant(Role.EDITOR, ["a/"]));
      expect(withRole(withRole(whole, Role.ADMIN), Role.VIEWER).folders).toBe(
         null
      );
      expect(withRole(grant(Role.ADMIN, null), Role.VIEWER).folders).toBe(null);
   });
});

describe("whole bucket or specific folders", () => {
   it("switches between the two, offering the last folder list again", () => {
      const whole = grant(Role.EDITOR, null);
      expect(withSpecificFolders(whole).folders).toEqual([]);
      expect(
         withSpecificFolders(whole, grant(Role.EDITOR, ["kept/"])).folders
      ).toEqual(["kept/"]);
      const dropped = withWholeBucket(grant(Role.EDITOR, ["a/"]));
      expect(dropped.folders).toBeNull();
      expect(withSpecificFolders(dropped).folders).toEqual(["a/"]);
   });
});

describe("checking a grant before it is sent", () => {
   const owned = { myRole: Role.OWNER, bucket: ownerBucket };
   const viewerAdmin = { myRole: Role.ADMIN, bucket: bucket(Role.VIEWER) };

   it("asks for at least one folder", () => {
      expect(grantError(grant(Role.EDITOR, []), owned)).toBe(
         "Add at least one folder, or choose Whole bucket."
      );
   });

   it("lets an owner grant any folders, existing or not", () => {
      expect(grantError(grant(Role.EDITOR, ["new/"]), owned)).toBeNull();
      expect(grantError(grant(Role.ADMIN, null), owned)).toBeNull();
   });

   it("refuses folders for someone whose server role is admin", () => {
      expect(
         grantError(grant(Role.EDITOR, ["a/"]), {
            ...owned,
            serverRole: Role.ADMIN,
         })
      ).toBe(ADMIN_FOLDERS);
      expect(
         grantError(grant(Role.EDITOR, null), {
            ...owned,
            serverRole: Role.ADMIN,
         })
      ).toBeNull();
      expect(
         grantError(grant(Role.EDITOR, ["a/"]), {
            ...owned,
            serverRole: Role.ADMIN,
            original: grant(Role.EDITOR, ["a/"]),
         })
      ).toBe(ADMIN_FOLDERS);
      expect(
         grantError(grant(Role.EDITOR, ["a/"]), {
            ...owned,
            serverRole: Role.EDITOR,
         })
      ).toBeNull();
   });

   it("keeps an unchanged grant the actor couldn't make themselves", () => {
      const original = grant(Role.EDITOR, ["b/", "a/"]);
      expect(
         grantError(grant(Role.EDITOR, ["a/", "b/"]), {
            ...viewerAdmin,
            original,
         })
      ).toBeNull();
      expect(
         grantError(grant(Role.EDITOR, ["a/"]), { ...viewerAdmin, original })
      ).toBe("You can't give Editor access to this bucket.");
   });

   it("refuses a role above the actor's own", () => {
      expect(
         grantError(grant(Role.ADMIN, null), {
            myRole: Role.ADMIN,
            bucket: bucket(Role.EDITOR),
         })
      ).toBe("You can't give Admin access to this bucket.");
   });

   it("collects errors by bucket and skips buckets the actor can't see", () => {
      const errors = accessErrors(
         [
            grant(Role.EDITOR, null, "site"),
            grant(Role.VIEWER, ["a/"], "docs"),
            grant(Role.EDITOR, [], "hidden"),
         ],
         {
            buckets: [bucket(Role.VIEWER), bucket(Role.EDITOR, null, "docs")],
            myRole: Role.ADMIN,
         }
      );
      expect([...errors]).toEqual([
         ["site", "You can't give Editor access to this bucket."],
      ]);
   });

   it("sums up the first problem under the list", () => {
      expect(accessSummaryError(["site", "Something."])).toBe(
         "Check the access on site."
      );
      expect(accessSummaryError(["site", ADMIN_FOLDERS])).toBe(
         "Admins can't be limited to folders. Choose Whole bucket on site, or a different server role."
      );
   });
});

describe("folders typed but not added", () => {
   const check = { buckets: [ownerBucket], myRole: Role.OWNER };
   const typed = (folders: string[] | null, draft: string): GrantRow => ({
      ...grant(Role.EDITOR, folders),
      draft,
   });

   it("adds a typed folder that can simply go in", () => {
      expect(commitDraft(typed([], "landing"))).toEqual({
         row: typed(["landing/"], ""),
         problem: null,
      });
      expect(commitDraft(typed(["a/"], "b/")).row.folders).toEqual([
         "a/",
         "b/",
      ]);
   });

   it("drops what was typed when it's already in the list", () => {
      expect(commitDraft(typed(["a/"], "/a"))).toEqual({
         row: typed(["a/"], ""),
         problem: null,
      });
   });

   it("explains, rather than drops, a folder that can't go in", () => {
      expect(commitDraft(typed(["a/"], "x/../y"))).toEqual({
         row: typed(["a/"], "x/../y"),
         problem:
            'A folder can\'t have empty, "." or ".." parts. Fix or clear the folder you typed.',
      });
   });

   it("asks before a typed folder replaces others", () => {
      expect(commitDraft(typed(["landing/"], "landing/hero"))).toEqual({
         row: typed(["landing/"], "landing/hero"),
         problem: "Press Add to confirm landing/hero/. It replaces landing/.",
      });
      expect(commitDraft(typed(["a/b/", "a/c/"], "a")).problem).toBe(
         "Press Add to confirm a/. It replaces a/b/ and a/c/."
      );
   });

   it("spells out bidi characters in the folders it names", () => {
      expect(commitDraft(typed(["a\u202E/"], "a\u202E/b")).problem).toBe(
         "Press Add to confirm a[U+202E]/b/. It replaces a[U+202E]/."
      );
   });

   it("ignores text left in a row that isn't limited to folders", () => {
      const whole = typed(null, "landing/");
      expect(commitDraft(whole)).toEqual({ row: whole, problem: null });
      expect(hasDrafts([whole])).toBe(false);
      expect(hasDrafts([typed([], "  ")])).toBe(false);
      expect(hasDrafts([typed([], "a")])).toBe(true);
   });

   it("adds what it can across rows before sending", () => {
      const rows = [
         typed([], "landing"),
         { ...typed(["a/"], "x/../"), bucketName: "docs" },
      ];
      const committed = commitDrafts(rows, {
         ...check,
         buckets: [ownerBucket, bucket(Role.OWNER, null, "docs")],
      });
      expect(committed.map(({ folders }) => folders)).toEqual([
         ["landing/"],
         ["a/"],
      ]);
      expect(committed[1]?.draft).toBe("x/../");
   });

   it("only reports drafts as errors once the form was sent", () => {
      const rows = [typed([], "x/../")];
      expect([...accessErrors(rows, check)]).toEqual([
         ["site", "Add at least one folder, or choose Whole bucket."],
      ]);
      expect([...accessErrors(rows, { ...check, drafts: true })]).toEqual([
         [
            "site",
            'A folder can\'t have empty, "." or ".." parts. Fix or clear the folder you typed.',
         ],
      ]);
   });
});

describe("the dirty check", () => {
   it("notices a change of folders", () => {
      expect(accessKey([grant(Role.EDITOR, ["a/"])])).not.toBe(
         accessKey([grant(Role.EDITOR, ["b/"])])
      );
      expect(accessKey([grant(Role.EDITOR, ["a/"])])).not.toBe(
         accessKey([grant(Role.EDITOR, null)])
      );
   });

   it("ignores order and typed text", () => {
      expect(
         accessKey([
            grant(Role.EDITOR, ["b/", "a/"], "site"),
            { ...grant(Role.VIEWER, null, "docs"), draft: "x" },
         ])
      ).toBe(
         accessKey([
            grant(Role.VIEWER, null, "docs"),
            grant(Role.EDITOR, ["a/", "b/"], "site"),
         ])
      );
   });

   it("can't be fooled by folder names holding delimiters", () => {
      expect(accessKey([grant(Role.EDITOR, ["a,b/"])])).not.toBe(
         accessKey([grant(Role.EDITOR, ["a/", "b/"])])
      );
      expect(accessKey([grant(Role.EDITOR, ["a:b/"])])).not.toBe(
         accessKey([grant(Role.EDITOR, ["a/", ":b/"])])
      );
   });
});

describe("sending grants", () => {
   it("always carries folders and nothing the editor kept for itself", () => {
      expect(
         grantPayload([
            {
               ...grant(Role.EDITOR, ["landing/"]),
               draft: "x",
               parked: ["y/"],
            },
            {
               ...grant(Role.VIEWER, null, "docs"),
               parked: ["z/"],
               restoreOnRole: true,
            },
         ])
      ).toEqual([
         { bucketName: "site", role: Role.EDITOR, folders: ["landing/"] },
         { bucketName: "docs", role: Role.VIEWER, folders: null },
      ]);
   });

   it("leaves out bucket owner rows", () => {
      expect(grantPayload([grant(Role.OWNER, null)])).toEqual([]);
   });

   it(`holds at most ${MAX_GRANT_FOLDERS} folders`, () => {
      const many = Array.from(
         { length: MAX_GRANT_FOLDERS + 1 },
         (_, i) => `f${i}/`
      );
      expect(
         grantError(grant(Role.EDITOR, many), {
            myRole: Role.OWNER,
            bucket: ownerBucket,
         })
      ).toBe(`Choose at most ${MAX_GRANT_FOLDERS} folders.`);
   });
});

describe("the bucket limit the API enforces", () => {
   const rows = (count: number, role = Role.VIEWER): GrantRow[] =>
      Array.from({ length: count }, (_unused, index) =>
         grant(role, null, `bucket-${index}`)
      );

   it("allows up to the limit and refuses one more", () => {
      expect(tooManyBuckets(rows(MAX_BUCKET_NAMES))).toBe(false);
      expect(tooManyBuckets(rows(MAX_BUCKET_NAMES + 1))).toBe(true);
   });

   it("counts only the grants that are sent", () => {
      expect(
         tooManyBuckets([
            ...rows(MAX_BUCKET_NAMES),
            grant(Role.OWNER, null, "owned"),
         ])
      ).toBe(false);
   });
});
