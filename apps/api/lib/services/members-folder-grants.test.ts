import type { Prisma } from "@prisma/client";
import { AuditLevel, ErrorCode, Role } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import { grantRefusal } from "@/lib/middleware/authorize";
import type { BucketRow } from "./bucket-grants";
import { grantBucketRoles } from "./invites";
import {
   assertAccessAsShown,
   assertBucketGrantChanges,
   assertBucketGrants,
   assertNotLimited,
   bucketDetail,
   loadGrantingActor,
   type GrantingActor,
} from "./members";

vi.mock("@s3-viewer/db", () => ({ prisma: {} }));

const refuse = grantRefusal({
   serverId: "server12345",
   actorId: "actor12345",
   audit: { enabled: true, level: AuditLevel.ALL },
});

const openScope = { restrictedBuckets: false, allowedBuckets: [] };

const row = (
   bucketName: string,
   role: Role,
   folders: string[] | null = null
): BucketRow => ({
   bucketName,
   role,
   restrictedFolders: folders !== null,
   allowedFolders: folders ?? [],
});

const grant = (
   bucketName: string,
   role: Role.EDITOR | Role.VIEWER | Role.ADMIN,
   folders: string[] | null = null
) => ({ bucketName, role, folders });

// the API never makes a folder-limited admin, but the grant check must still hold one.
const limitedAdmin: GrantingActor = {
   serverRole: Role.ADMIN,
   bucketGrants: new Map([
      ["company", { role: Role.EDITOR, folders: ["landing/"] }],
   ]),
};

describe("assertBucketGrants with a folder-limited actor", () => {
   const granting = (folders: string[] | null) => () =>
      assertBucketGrants(
         limitedAdmin,
         openScope,
         [grant("company", Role.VIEWER, folders)],
         refuse
      );

   it("lets them share their own folders and folders inside them", () => {
      expect(granting(["landing/"])).not.toThrow();
      expect(granting(["landing/img/"])).not.toThrow();
   });

   it("refuses the whole bucket and folders outside theirs, by name", () => {
      for (const folders of [
         null,
         ["private/"],
         ["landing/", "private/"],
         ["landing-internal/"],
      ]) {
         expect(granting(folders)).toThrow(
            expect.objectContaining({
               status: 403,
               code: ErrorCode.FOLDER_ACCESS,
               message:
                  "Your access to company is limited to folders, so you can only grant access inside them",
               denial: expect.objectContaining({
                  entry: expect.objectContaining({
                     bucket: "company",
                     detail: { permission: "MANAGE_MEMBERS", reason: "folder" },
                  }),
               }),
            })
         );
      }
   });

   it("refuses folders on an admin grant before anything else", () => {
      expect(() =>
         assertBucketGrants(
            { serverRole: Role.OWNER, bucketGrants: new Map() },
            openScope,
            [grant("company", Role.ADMIN, ["landing/"])],
            refuse
         )
      ).toThrow(
         expect.objectContaining({
            status: 400,
            message: "Admin access to company can't be limited to folders",
         })
      );
   });
});

describe("assertBucketGrantChanges with folders", () => {
   const current = [row("company", Role.VIEWER, ["private/"])];

   it("keeps an unchanged limited grant the actor could not make", () => {
      expect(() =>
         assertBucketGrantChanges(
            limitedAdmin,
            openScope,
            current,
            [grant("company", Role.VIEWER, ["private/"])],
            refuse
         )
      ).not.toThrow();
   });

   it("checks a change of folders alone like a fresh grant", () => {
      const changing = (folders: string[] | null) => () =>
         assertBucketGrantChanges(
            limitedAdmin,
            openScope,
            current,
            [grant("company", Role.VIEWER, folders)],
            refuse
         );
      expect(changing(["private/", "landing/"])).toThrow(
         expect.objectContaining({ code: ErrorCode.FOLDER_ACCESS })
      );
      expect(changing(null)).toThrow(
         expect.objectContaining({ code: ErrorCode.FOLDER_ACCESS })
      );
      expect(changing(["landing/"])).toThrow(
         expect.objectContaining({
            message: "You can't change Viewer access to company",
         })
      );
   });

   it("lets them change folders they cover on both sides of the edit", () => {
      expect(() =>
         assertBucketGrantChanges(
            limitedAdmin,
            openScope,
            [row("company", Role.VIEWER, ["landing/img/"])],
            [grant("company", Role.VIEWER, ["landing/"])],
            refuse
         )
      ).not.toThrow();
      expect(() =>
         assertBucketGrantChanges(
            limitedAdmin,
            openScope,
            [row("company", Role.VIEWER, ["landing/img/"])],
            [],
            refuse
         )
      ).not.toThrow();
   });

   it("treats the same folders in another order as unchanged", () => {
      expect(() =>
         assertBucketGrantChanges(
            limitedAdmin,
            openScope,
            [row("company", Role.VIEWER, ["b/", "a/"])],
            [grant("company", Role.VIEWER, ["a/", "b/"])],
            refuse
         )
      ).not.toThrow();
   });
});

describe("loadGrantingActor", () => {
   it("reads the actor's folders with their role", async () => {
      const findMany = vi.fn(async () => [
         row("company", Role.EDITOR, ["landing/"]),
         row("open", Role.EDITOR),
      ]);
      const actor = await loadGrantingActor(
         "actor12345",
         "server12345",
         Role.ADMIN,
         [grant("company", Role.VIEWER), grant("open", Role.VIEWER)],
         { bucketAccess: { findMany } } as unknown as Prisma.TransactionClient
      );
      expect(Object.fromEntries(actor.bucketGrants)).toEqual({
         company: { role: Role.EDITOR, folders: ["landing/"] },
         open: { role: Role.EDITOR, folders: null },
      });
      expect(findMany).toHaveBeenCalledWith(
         expect.objectContaining({
            select: expect.objectContaining({
               restrictedFolders: true,
               allowedFolders: true,
            }),
         })
      );
   });
});

describe("assertAccessAsShown", () => {
   const current = [
      row("company", Role.EDITOR, ["landing/"]),
      row("open", Role.VIEWER),
   ];
   const shown = [
      grant("open", Role.VIEWER),
      grant("company", Role.EDITOR, ["landing/"]),
   ];

   const requested = [grant("open", Role.EDITOR)];

   it("passes when the editor showed exactly what is stored", () => {
      expect(() =>
         assertAccessAsShown(current, shown, requested)
      ).not.toThrow();
      expect(() => assertAccessAsShown([], [], requested)).not.toThrow();
   });

   it("passes a repeated save whose access is already stored", () => {
      const stale = [grant("open", Role.VIEWER)];
      expect(() => assertAccessAsShown(current, stale, shown)).not.toThrow();
   });

   it.each([
      ["an entry is repeated to pad the count", [shown[0]!, shown[0]!]],
      ["a folder changed", [shown[0]!, grant("company", Role.EDITOR, ["x/"])]],
      ["a limit was lifted", [shown[0]!, grant("company", Role.EDITOR)]],
      ["a role changed", [grant("open", Role.EDITOR), shown[1]!]],
      ["a grant was added", [shown[0]!]],
      ["a grant was removed", [...shown, grant("extra", Role.VIEWER)]],
   ])("refuses with 409 when %s", (_what, stale) => {
      expect(() => assertAccessAsShown(current, stale, requested)).toThrow(
         expect.objectContaining({ status: 409 })
      );
   });
});

describe("assertNotLimited", () => {
   it("names the first folder-limited bucket and passes whole-bucket access", () => {
      const message = (bucket: string) => `limited on ${bucket}`;
      expect(() =>
         assertNotLimited([row("open", Role.EDITOR)], message)
      ).not.toThrow();
      expect(() =>
         assertNotLimited(
            [row("open", Role.EDITOR), row("company", Role.VIEWER, ["a/"])],
            message
         )
      ).toThrow(
         expect.objectContaining({
            status: 409,
            message: "limited on company",
         })
      );
   });
});

describe("bucketDetail", () => {
   it("leaves whole-bucket grants as they were and quotes folders exactly", () => {
      expect(
         bucketDetail([
            grant("zeta", Role.VIEWER),
            grant("alpha", Role.EDITOR, ["a b/", "c,d/", "e]f/", 'g"h/']),
         ])
      ).toEqual({
         buckets: 'alpha:EDITOR["a b/","c,d/","e]f/","g\\"h/"],zeta:VIEWER',
      });
   });

   it("names every folder rather than the first few", () => {
      const folders = Array.from({ length: 20 }, (_, i) => `folder-${i}/`);
      const { buckets } = bucketDetail([grant("b", Role.VIEWER, folders)]);
      for (const folder of folders) expect(buckets).toContain(`"${folder}"`);
   });

   it("identifies each list by size and digest when the names would not fit the record", () => {
      const folders = Array.from(
         { length: 20 },
         (_, i) => `${"x".repeat(200)}-${i}/`
      );
      const { buckets } = bucketDetail([grant("b", Role.VIEWER, folders)]);
      expect(buckets).toMatch(/^b:VIEWER\[20 folders sha256:[0-9a-f]{16}\]$/);
      expect(
         bucketDetail([grant("b", Role.VIEWER, [...folders].reverse())]).buckets
      ).not.toBe(buckets);

      const many = Array.from({ length: 12 }, (_, i) =>
         grant(`bucket-number-${i}`, Role.VIEWER, [
            `${"a".repeat(30)}/`,
            `${"b".repeat(30)}/`,
         ])
      );
      const detail = bucketDetail([...many, grant("open", Role.EDITOR)]);
      expect(String(detail.buckets).length).toBeLessThanOrEqual(1024);
      expect(String(detail.buckets).split(",")).toHaveLength(13);
      expect(detail.buckets).toContain("open:EDITOR");
      expect(detail.buckets).toContain("[2 folders sha256:");
   });
});

describe("grantBucketRoles", () => {
   it("creates new grants at once, updates only what changed, and reports what is stored", async () => {
      const createMany = vi.fn();
      const update = vi.fn();
      const tx = {
         bucketAccess: {
            findMany: async () => [
               row("kept", Role.EDITOR, ["a/"]),
               row("joined", Role.VIEWER, ["a/"]),
               row("raised", Role.VIEWER, ["a/"]),
            ],
            createMany,
            update,
         },
      } as unknown as Prisma.TransactionClient;

      const stored = await grantBucketRoles(tx, "user123456", "server12345", [
         row("kept", Role.VIEWER),
         row("joined", Role.VIEWER, ["b/"]),
         row("raised", Role.EDITOR),
         row("fresh", Role.VIEWER, ["only/"]),
      ]);

      expect(stored).toEqual([
         { bucketName: "kept", role: Role.EDITOR, folders: ["a/"] },
         { bucketName: "joined", role: Role.VIEWER, folders: ["a/", "b/"] },
         { bucketName: "raised", role: Role.EDITOR, folders: null },
         { bucketName: "fresh", role: Role.VIEWER, folders: ["only/"] },
      ]);
      expect(createMany).toHaveBeenCalledExactlyOnceWith({
         data: [
            {
               userId: "user123456",
               serverId: "server12345",
               bucketName: "fresh",
               role: Role.VIEWER,
               restrictedFolders: true,
               allowedFolders: ["only/"],
            },
         ],
         skipDuplicates: true,
      });
      expect(update.mock.calls.map(([args]) => args.data)).toEqual([
         {
            role: Role.VIEWER,
            restrictedFolders: true,
            allowedFolders: ["a/", "b/"],
         },
         { role: Role.EDITOR, restrictedFolders: false, allowedFolders: [] },
      ]);
   });
});
