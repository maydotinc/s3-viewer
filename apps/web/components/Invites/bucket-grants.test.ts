import {
   MAX_BUCKET_NAMES,
   MAX_GRANT_FOLDERS,
   Role,
   type BucketAccessEntry,
   type S3Bucket,
} from "@s3-viewer/types";
import { describe, expect, it } from "vitest";

const ADMIN_FOLDERS =
   "Admins can't be limited to folders. Choose Whole bucket or a different server role.";
import {
   accessErrors,
   accessKey,
   accessSummaryError,
   canChooseWholeBucket,
   checkedGrant,
   commitDraft,
   commitDrafts,
   grantError,
   grantPayload,
   hasDrafts,
   heldFolders,
   tooManyBuckets,
   newGrant,
   withRole,
   withSpecificFolders,
   withWholeBucket,
   type GrantRow,
} from "./bucket-grants";

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
const limitedBucket = bucket(Role.EDITOR, ["landing/"]);

const sent = (rows: readonly GrantRow[]) => grantPayload(rows);

describe("starting a grant", () => {
   it("gives the whole bucket when the actor has it", () => {
      expect(newGrant(Role.OWNER, ownerBucket, Role.VIEWER)).toEqual(
         grant(Role.VIEWER, null)
      );
      expect(newGrant(Role.ADMIN, bucket(Role.ADMIN), Role.EDITOR)).toEqual(
         grant(Role.EDITOR, null)
      );
   });

   it("starts from the actor's own folders when theirs are limited", () => {
      const entry = newGrant(Role.ADMIN, limitedBucket, Role.VIEWER);
      expect(entry).toEqual(grant(Role.VIEWER, ["landing/"]));
      expect(entry.folders).not.toBe(limitedBucket.folders);
   });

   it("never starts limited for someone who'll be a server admin", () => {
      expect(
         newGrant(Role.ADMIN, limitedBucket, Role.VIEWER, Role.ADMIN)
      ).toEqual(grant(Role.VIEWER, null));
   });

   it("ignores folders the bucket list reports for an owner", () => {
      expect(heldFolders(Role.OWNER, limitedBucket)).toBeNull();
      expect(heldFolders(Role.ADMIN, limitedBucket)).toEqual(["landing/"]);
   });
});

describe("checking a bucket again after unchecking it", () => {
   it("brings back the access the member had, not the whole bucket", () => {
      const before = grant(Role.EDITOR, ["landing/"]);
      const row = checkedGrant(before, Role.OWNER, ownerBucket, Role.VIEWER);
      expect(row).toEqual(before);
      expect(row.folders).not.toBe(before.folders);
   });

   it("starts a fresh grant for a bucket the member never had", () => {
      expect(
         checkedGrant(undefined, Role.OWNER, ownerBucket, Role.VIEWER)
      ).toEqual(newGrant(Role.OWNER, ownerBucket, Role.VIEWER));
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
      expect(sent([admin])).toEqual([
         { bucketName: "site", role: Role.ADMIN, folders: null },
      ]);
      const back = withRole(admin, Role.VIEWER);
      expect(back.folders).toEqual(["a/", "b/"]);
      expect(sent([back])).toEqual([
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
      expect(withSpecificFolders(whole, null).folders).toEqual([]);
      expect(withSpecificFolders(whole, ["landing/"]).folders).toEqual([
         "landing/",
      ]);
      expect(
         withSpecificFolders(whole, null, grant(Role.EDITOR, ["kept/"])).folders
      ).toEqual(["kept/"]);
      const dropped = withWholeBucket(grant(Role.EDITOR, ["a/"]));
      expect(dropped.folders).toBeNull();
      expect(withSpecificFolders(dropped, null).folders).toEqual(["a/"]);
   });

   it("only offers the whole bucket to an actor who holds it", () => {
      expect(canChooseWholeBucket(null, undefined)).toBe(true);
      expect(canChooseWholeBucket(["landing/"], undefined)).toBe(false);
      expect(canChooseWholeBucket(["landing/"], grant(Role.VIEWER, null))).toBe(
         true
      );
      expect(
         canChooseWholeBucket(["landing/"], grant(Role.VIEWER, ["landing/"]))
      ).toBe(false);
   });
});

describe("checking a grant before it is sent", () => {
   const owned = { myRole: Role.OWNER, bucket: ownerBucket };
   const limitedAdmin = { myRole: Role.ADMIN, bucket: limitedBucket };

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

   it("keeps a limited actor from granting the whole bucket", () => {
      expect(grantError(grant(Role.VIEWER, null), limitedAdmin)).toBe(
         "You can only give access inside landing/."
      );
   });

   it("keeps a limited actor inside their own folders", () => {
      expect(grantError(grant(Role.VIEWER, ["private/"]), limitedAdmin)).toBe(
         "You can only give access inside landing/."
      );
      expect(
         grantError(grant(Role.VIEWER, ["landing/hero/"]), limitedAdmin)
      ).toBeNull();
   });

   it("keeps an unchanged grant the actor couldn't make themselves", () => {
      expect(
         grantError(grant(Role.VIEWER, ["landing/", "private/"]), {
            ...limitedAdmin,
            original: grant(Role.VIEWER, ["private/", "landing/"]),
         })
      ).toBeNull();
      expect(
         grantError(grant(Role.VIEWER, ["landing/"]), {
            ...limitedAdmin,
            original: grant(Role.VIEWER, null),
         })
      ).toBeNull();
      expect(
         grantError(grant(Role.VIEWER, null), {
            ...limitedAdmin,
            original: grant(Role.VIEWER, null),
         })
      ).toBeNull();
      expect(
         grantError(grant(Role.EDITOR, null), {
            ...limitedAdmin,
            original: grant(Role.VIEWER, null),
         })
      ).toBe("You can only give access inside landing/.");
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
            grant(Role.VIEWER, null, "site"),
            grant(Role.VIEWER, ["a/"], "docs"),
            grant(Role.EDITOR, [], "hidden"),
         ],
         {
            buckets: [limitedBucket, bucket(Role.EDITOR, null, "docs")],
            myRole: Role.ADMIN,
         }
      );
      expect([...errors]).toEqual([
         ["site", "You can only give access inside landing/."],
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
      expect(commitDraft(typed([], "landing"), null)).toEqual({
         row: typed(["landing/"], ""),
         problem: null,
      });
      expect(commitDraft(typed(["a/"], "b/"), null).row.folders).toEqual([
         "a/",
         "b/",
      ]);
   });

   it("drops what was typed when it's already in the list", () => {
      expect(commitDraft(typed(["a/"], "/a"), null)).toEqual({
         row: typed(["a/"], ""),
         problem: null,
      });
   });

   it("explains, rather than drops, a folder that can't go in", () => {
      expect(commitDraft(typed(["a/"], "x/../y"), null)).toEqual({
         row: typed(["a/"], "x/../y"),
         problem:
            'A folder can\'t have empty, "." or ".." parts. Fix or clear the folder you typed.',
      });
      expect(commitDraft(typed([], "private"), ["landing/"]).problem).toBe(
         "You can only share folders inside landing/. Fix or clear the folder you typed."
      );
   });

   it("asks before a typed folder replaces others", () => {
      expect(commitDraft(typed(["landing/"], "landing/hero"), null)).toEqual({
         row: typed(["landing/"], "landing/hero"),
         problem: "Press Add to confirm landing/hero/. It replaces landing/.",
      });
      expect(commitDraft(typed(["a/b/", "a/c/"], "a"), null).problem).toBe(
         "Press Add to confirm a/. It replaces a/b/ and a/c/."
      );
   });

   it("spells out bidi characters in the folders it names", () => {
      expect(commitDraft(typed(["a\u202E/"], "a\u202E/b"), null).problem).toBe(
         "Press Add to confirm a[U+202E]/b/. It replaces a[U+202E]/."
      );
   });

   it("ignores text left in a row that isn't limited to folders", () => {
      const whole = typed(null, "landing/");
      expect(commitDraft(whole, null)).toEqual({ row: whole, problem: null });
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
