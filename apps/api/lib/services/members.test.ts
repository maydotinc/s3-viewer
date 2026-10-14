import { Prisma } from "@prisma/client";
import { Role } from "@s3-viewer/types";
import { ApiHttpError } from "@/lib/http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bucketGrantJson, bucketGrantsLateral } from "./bucket-grants";
import {
   assertBucketGrantChanges,
   assertBucketGrants,
   clampBucketAccess,
   listMembers,
   removeMembership,
   replaceBucketAccess,
   type GrantingActor,
} from "./members";

const h = vi.hoisted(() => ({
   findMany: vi.fn(),
   viewerGrants: vi.fn(),
   keyset: vi.fn(),
   updateMany: vi.fn(),
   findAccess: vi.fn(),
   deleteAccess: vi.fn(),
   deleteGrants: vi.fn(),
   findGrants: vi.fn(),
   lock: vi.fn(),
   revokeInvites: vi.fn(),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      serverAccess: { findMany: h.findMany },
      bucketAccess: { findMany: h.viewerGrants },
      $queryRaw: h.keyset,
      $transaction: (work: (tx: unknown) => Promise<unknown>) =>
         work({
            $queryRaw: h.lock,
            serverAccess: {
               findUnique: h.findAccess,
               deleteMany: h.deleteAccess,
            },
            bucketAccess: {
               deleteMany: h.deleteGrants,
               findMany: h.findGrants,
            },
         }),
   },
}));
vi.mock("./invite-authority", () => ({
   revokeInvalidInvites: h.revokeInvites,
}));
vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: () => ({}),
}));

const scope = { restrictedBuckets: true, allowedBuckets: ["photos", "logs"] };
const openScope = { restrictedBuckets: false, allowedBuckets: [] };

const actor = (
   serverRole: Role,
   bucketRoles: Record<string, Role> = {}
): GrantingActor => ({
   serverRole,
   bucketGrants: new Map(
      Object.entries(bucketRoles).map(([bucketName, role]) => [
         bucketName,
         { role, folders: null },
      ])
   ),
});

describe("assertBucketGrants", () => {
   it("lets an owner grant anything", () => {
      expect(() =>
         assertBucketGrants(actor(Role.OWNER), scope, [
            { bucketName: "photos", role: Role.EDITOR, folders: null },
         ])
      ).not.toThrow();
   });

   it("refuses an admin granting a bucket they hold nothing on", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN), scope, [
            { bucketName: "photos", role: Role.EDITOR, folders: null },
         ])
      ).toThrow(/don't have Editor access to photos/);
   });

   it("refuses an admin granting above what they hold on that bucket", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN, { photos: Role.VIEWER }), scope, [
            { bucketName: "photos", role: Role.EDITOR, folders: null },
         ])
      ).toThrow(/don't have Editor access to photos/);
   });

   it("lets an admin pass on a bucket role they hold", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN, { photos: Role.EDITOR }), scope, [
            { bucketName: "photos", role: Role.EDITOR, folders: null },
            { bucketName: "photos", role: Role.VIEWER, folders: null },
         ])
      ).toThrow(/Duplicate bucket/);
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN, { photos: Role.EDITOR }), scope, [
            { bucketName: "photos", role: Role.VIEWER, folders: null },
         ])
      ).not.toThrow();
   });

   it("still checks the grant is a role the actor may assign at all", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN, { photos: Role.ADMIN }), scope, [
            { bucketName: "photos", role: Role.ADMIN, folders: null },
         ])
      ).toThrow(/can't grant Admin/);
   });

   it("rejects buckets outside a restricted server's allowlist", () => {
      expect(() =>
         assertBucketGrants(actor(Role.OWNER), scope, [
            { bucketName: "company-payroll", role: Role.VIEWER, folders: null },
         ])
      ).toThrow(/Unknown bucket/);
   });

   it("holds an admin to their own grants even on an unrestricted server", () => {
      expect(() =>
         assertBucketGrants(actor(Role.ADMIN), openScope, [
            { bucketName: "anything", role: Role.VIEWER, folders: null },
         ])
      ).toThrow(/don't have Viewer access to anything/);
   });
});

describe("assertBucketGrantChanges", () => {
   const current = [
      {
         bucketName: "photos",
         role: Role.EDITOR,
         restrictedFolders: false,
         allowedFolders: [],
      },
      {
         bucketName: "logs",
         role: Role.VIEWER,
         restrictedFolders: false,
         allowedFolders: [],
      },
   ];

   it("keeps an unchanged grant the actor could not make themselves", () => {
      expect(() =>
         assertBucketGrantChanges(actor(Role.ADMIN), scope, current, [
            { bucketName: "photos", role: Role.EDITOR, folders: null },
            { bucketName: "logs", role: Role.VIEWER, folders: null },
         ])
      ).not.toThrow();
   });

   it("refuses an explicit downgrade of an owner-assigned Admin grant", () => {
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.ADMIN, { photos: Role.VIEWER }),
            scope,
            [
               {
                  bucketName: "photos",
                  role: Role.ADMIN,
                  restrictedFolders: false,
                  allowedFolders: [],
               },
            ],
            [{ bucketName: "photos", role: Role.VIEWER, folders: null }]
         )
      ).toThrow(expect.objectContaining({ status: 403 }));
   });

   it("preserves protected grants on resubmission and lets owners change them", () => {
      const protectedGrant = [
         {
            bucketName: "photos",
            role: Role.ADMIN,
            folders: null,
            restrictedFolders: false,
            allowedFolders: [] as string[],
         },
      ] as const;
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.ADMIN),
            scope,
            protectedGrant,
            protectedGrant
         )
      ).not.toThrow();
      expect(() =>
         assertBucketGrantChanges(actor(Role.OWNER), scope, protectedGrant, [
            { bucketName: "photos", role: Role.VIEWER, folders: null },
         ])
      ).not.toThrow();
      expect(() =>
         assertBucketGrantChanges(actor(Role.OWNER), scope, protectedGrant, [])
      ).not.toThrow();
   });

   it("refuses a new grant above what the actor holds on that bucket", () => {
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.ADMIN, { logs: Role.VIEWER }),
            scope,
            [
               {
                  bucketName: "photos",
                  role: Role.EDITOR,
                  restrictedFolders: false,
                  allowedFolders: [],
               },
            ],
            [
               { bucketName: "photos", role: Role.EDITOR, folders: null },
               { bucketName: "logs", role: Role.EDITOR, folders: null },
            ]
         )
      ).toThrow(/don't have Editor access to logs/);
   });

   it("checks a changed role like a fresh grant", () => {
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.ADMIN, { photos: Role.EDITOR }),
            scope,
            current,
            [
               { bucketName: "photos", role: Role.VIEWER, folders: null },
               { bucketName: "logs", role: Role.VIEWER, folders: null },
            ]
         )
      ).not.toThrow();
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.ADMIN, { photos: Role.VIEWER }),
            scope,
            [
               {
                  bucketName: "photos",
                  role: Role.VIEWER,
                  restrictedFolders: false,
                  allowedFolders: [],
               },
            ],
            [{ bucketName: "photos", role: Role.EDITOR, folders: null }]
         )
      ).toThrow(/don't have Editor access to photos/);
   });

   it("refuses removing a grant the actor cannot manage", () => {
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.ADMIN),
            scope,
            [
               {
                  bucketName: "photos",
                  role: Role.ADMIN,
                  restrictedFolders: false,
                  allowedFolders: [],
               },
            ],
            []
         )
      ).toThrow(/can't change Admin access to photos/);
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.ADMIN, { photos: Role.EDITOR, logs: Role.VIEWER }),
            scope,
            current,
            []
         )
      ).not.toThrow();
   });

   it("refuses removing a grant on a bucket the actor holds nothing on", () => {
      expect(() =>
         assertBucketGrantChanges(actor(Role.ADMIN), scope, current, [])
      ).toThrow(
         expect.objectContaining({
            status: 403,
            message: "You can't change Editor access to photos",
         })
      );
   });

   it("refuses removing a grant above the role the actor holds on that bucket", () => {
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.ADMIN, { photos: Role.VIEWER, logs: Role.VIEWER }),
            scope,
            current,
            []
         )
      ).toThrow(/can't change Editor access to photos/);
   });

   it("refuses removing a grant whose folders fall outside the actor's folders", () => {
      const limited = {
         serverRole: Role.ADMIN,
         bucketGrants: new Map([
            ["photos", { role: Role.EDITOR, folders: ["a/"] }],
         ]),
      };
      expect(() =>
         assertBucketGrantChanges(
            limited,
            scope,
            [
               {
                  bucketName: "photos",
                  role: Role.VIEWER,
                  restrictedFolders: true,
                  allowedFolders: ["b/"],
               },
            ],
            []
         )
      ).toThrow(/can't change Viewer access to photos/);
   });

   it("answers an admin without a grant the same whether or not the bucket is listed", () => {
      const ask = (bucketName: string) => () =>
         assertBucketGrants(actor(Role.ADMIN), scope, [
            { bucketName, role: Role.EDITOR, folders: null },
         ]);
      expect(ask("photos")).toThrow(
         expect.objectContaining({
            status: 403,
            message:
               "You don't have Editor access to photos, so you can't grant it",
         })
      );
      expect(ask("company-payroll")).toThrow(
         expect.objectContaining({
            status: 403,
            message:
               "You don't have Editor access to company-payroll, so you can't grant it",
         })
      );
   });

   it("checks the whole requested set against the allowlist, unchanged or not", () => {
      expect(() =>
         assertBucketGrantChanges(
            actor(Role.OWNER),
            scope,
            [
               {
                  bucketName: "company-payroll",
                  role: Role.VIEWER,
                  restrictedFolders: false,
                  allowedFolders: [],
               },
            ],
            [
               {
                  bucketName: "company-payroll",
                  role: Role.VIEWER,
                  folders: null,
               },
            ]
         )
      ).toThrow(/Unknown bucket/);
   });

   it("still rejects duplicates when one copy is unchanged", () => {
      expect(() =>
         assertBucketGrantChanges(actor(Role.OWNER), scope, current, [
            { bucketName: "photos", role: Role.EDITOR, folders: null },
            { bucketName: "photos", role: Role.VIEWER, folders: null },
            { bucketName: "logs", role: Role.VIEWER, folders: null },
         ])
      ).toThrow(/Duplicate bucket/);
   });
});

const memberRow = (id: string, createdAt: string) => ({
   id,
   createdAt: new Date(createdAt),
   role: Role.EDITOR,
   user: {
      id: `user_${id}`,
      name: id,
      email: `${id}@example.com`,
      bucketAccess: [],
   },
});

const serverUser = (id: string) => ({
   id: `user_${id}`,
   name: id,
   email: `${id}@example.com`,
   role: Role.EDITOR,
   bucketAccess: [],
});

const query = (call = 0): Prisma.Sql => {
   const [strings, ...values] = (h.keyset.mock.calls[call] ?? []) as [
      TemplateStringsArray,
      ...unknown[],
   ];
   return Prisma.sql(strings, ...values);
};

const queryText = (call = 0): string =>
   query(call).text.replace(/\s+/g, " ").trim();

describe("listMembers", () => {
   const OWNER_VIEWER = { id: "owner12345", role: Role.OWNER };

   beforeEach(() => {
      h.keyset.mockReset();
      h.findMany.mockReset();
      h.viewerGrants.mockReset().mockResolvedValue([]);
   });

   it("returns ordered members and a cursor only when a further page exists", async () => {
      h.keyset.mockResolvedValueOnce([
         memberRow("m1", "2026-09-01T00:00:00.000Z"),
         memberRow("m2", "2026-09-02T00:00:00.000Z"),
      ]);
      const page = await listMembers("server12345", undefined, 1, OWNER_VIEWER);
      expect(page.members).toEqual([serverUser("m1")]);
      expect(page.nextCursor).toBe(
         Buffer.from("2026-09-01T00:00:00.000Z|m1").toString("base64url")
      );
      expect(queryText()).toContain(
         'FROM "server_access" WHERE "serverId" = $1 ' +
            'ORDER BY "createdAt" ASC, "id" ASC LIMIT $2'
      );
      expect(query().values).toEqual(["server12345", 2]);
      expect(h.findMany).not.toHaveBeenCalled();
      expect(h.keyset).toHaveBeenCalledTimes(1);
   });

   it("omits the cursor on the last page", async () => {
      h.keyset.mockResolvedValueOnce([
         memberRow("m1", "2026-09-01T00:00:00.000Z"),
      ]);
      const page = await listMembers("server12345", undefined, 5, OWNER_VIEWER);
      expect(page.members).toEqual([serverUser("m1")]);
      expect(page.nextCursor).toBeNull();
   });

   it("decodes a cursor into a row-value seek, not the OR form", async () => {
      h.keyset.mockResolvedValueOnce([]);
      const cursor = Buffer.from("2026-09-01T00:00:00.000Z|m1").toString(
         "base64url"
      );
      const page = await listMembers("server12345", cursor, 5, OWNER_VIEWER);
      expect(page).toEqual({ members: [], nextCursor: null });
      expect(queryText()).toContain(
         'WHERE "serverId" = $1 AND ("createdAt", "id") > ($2::timestamp, $3)'
      );
      expect(queryText()).not.toContain(" OR ");
      expect(query().values).toEqual([
         "server12345",
         "2026-09-01T00:00:00.000Z",
         "m1",
         6,
      ]);
   });

   it("keeps grant reads scoped to both the page member and server", async () => {
      const row = memberRow("m1", "2026-09-01T00:00:00.000Z");
      h.keyset.mockResolvedValueOnce([
         {
            ...row,
            user: {
               ...row.user,
               bucketAccess: [
                  {
                     bucketName: "photos",
                     role: Role.VIEWER,
                     restrictedFolders: false,
                     allowedFolders: [],
                  },
               ],
            },
         },
      ]);
      expect(
         (await listMembers("server12345", undefined, 5, OWNER_VIEWER)).members
      ).toEqual([
         {
            ...serverUser("m1"),
            bucketAccess: [
               { bucketName: "photos", role: Role.VIEWER, folders: null },
            ],
         },
      ]);
      expect(queryText()).toContain(
         'b."userId" = page."userId" AND b."serverId" = page."serverId"'
      );
      expect(queryText()).toContain('ORDER BY b."bucketName"');
   });

   it("aggregates every grant column through the shared fragment", async () => {
      const fragment = bucketGrantJson("b");
      expect(fragment.values).toEqual([]);
      expect(fragment.text.replace(/\s+/g, " ")).toBe(
         "jsonb_build_object( " +
            "'bucketName', b.\"bucketName\", 'role', b.\"role\", " +
            "'restrictedFolders', b.\"restrictedFolders\", " +
            "'allowedFolders', b.\"allowedFolders\" )"
      );
      h.keyset.mockResolvedValueOnce([]);
      await listMembers("server12345", undefined, 5, OWNER_VIEWER);
      expect(queryText()).toContain(
         `SELECT jsonb_agg( ${fragment.text.replace(/\s+/g, " ")} ORDER BY b."bucketName" ) AS buckets FROM "bucket_access" b`
      );
      expect(query().values).toEqual(["server12345", 6]);
   });

   it("joins any grant table's rows for the page through the shared lateral fragment", () => {
      const lateral = bucketGrantsLateral(
         "invitation_bucket_access",
         Prisma.sql`b."invitationId" = page."id"`
      );
      expect(lateral.values).toEqual([]);
      expect(lateral.text.replace(/\s+/g, " ").trim()).toBe(
         `LEFT JOIN LATERAL ( SELECT jsonb_agg( ${bucketGrantJson("b").text.replace(/\s+/g, " ")} ORDER BY b."bucketName" ) AS buckets ` +
            'FROM "invitation_bucket_access" b WHERE b."invitationId" = page."id" ) grants ON TRUE'
      );
   });

   it("shows an admin only the grants on buckets the admin holds", async () => {
      const row = memberRow("m1", "2026-09-01T00:00:00.000Z");
      const grant = (bucketName: string, role: Role) => ({
         bucketName,
         role,
         restrictedFolders: false,
         allowedFolders: [],
      });
      h.keyset.mockResolvedValueOnce([
         {
            ...row,
            user: {
               ...row.user,
               bucketAccess: [
                  grant("logs", Role.VIEWER),
                  grant("photos", Role.EDITOR),
               ],
            },
         },
      ]);
      h.viewerGrants.mockResolvedValueOnce([grant("photos", Role.ADMIN)]);
      const { members } = await listMembers("server12345", undefined, 5, {
         id: "admin12345",
         role: Role.ADMIN,
      });
      expect(members[0]?.bucketAccess).toEqual([
         { bucketName: "photos", role: Role.EDITOR, folders: null },
      ]);
      expect(h.viewerGrants).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { userId: "admin12345", serverId: "server12345" },
         })
      );
   });

   it("shows an owner every grant without reading the owner's own", async () => {
      h.keyset.mockResolvedValueOnce([]);
      await listMembers("server12345", undefined, 5, OWNER_VIEWER);
      expect(h.viewerGrants).not.toHaveBeenCalled();
   });

   it("rejects a garbage cursor with 400", async () => {
      await expect(
         listMembers("server12345", "nope", 5, OWNER_VIEWER)
      ).rejects.toMatchObject({
         status: 400,
         message: "Invalid cursor",
         code: "VALIDATION",
      });
      expect(h.keyset).not.toHaveBeenCalled();
   });
});

describe("clampBucketAccess", () => {
   const MEMBER = "user123456";
   const ACTOR = "actor12345";
   const grant = (
      bucketName: string,
      role: Role,
      folders: string[] | null = null
   ) => ({
      bucketName,
      role,
      restrictedFolders: folders !== null,
      allowedFolders: folders ?? [],
   });
   let memberGrants: ReturnType<typeof grant>[] = [];
   let actorGrants: ReturnType<typeof grant>[] = [];
   const findMany = vi.fn(
      async ({
         where,
      }: {
         where: {
            userId: string;
            role?: { in: Role[] };
            bucketName?: { in: string[] };
         };
      }) =>
         where.userId === MEMBER
            ? memberGrants.filter((g) => where.role?.in.includes(g.role))
            : actorGrants.filter((g) =>
                 where.bucketName?.in.includes(g.bucketName)
              )
   );
   const tx = {
      bucketAccess: { findMany, updateMany: h.updateMany },
   } as unknown as Prisma.TransactionClient;
   const clamp = (role: Role, actorRole: Role) =>
      clampBucketAccess(tx, MEMBER, "server12345", role, {
         id: ACTOR,
         role: actorRole,
      });
   const clampedBuckets = () =>
      h.updateMany.mock.calls[0]?.[0]?.where?.bucketName?.in;

   beforeEach(() => {
      h.updateMany.mockReset().mockResolvedValue({ count: 0 });
      findMany.mockClear();
      memberGrants = [];
      actorGrants = [];
   });

   it("pulls every grant down for an owner", async () => {
      memberGrants = [grant("logs", Role.EDITOR), grant("media", Role.ADMIN)];
      await clamp(Role.VIEWER, Role.OWNER);
      expect(h.updateMany).toHaveBeenCalledWith({
         where: {
            userId: MEMBER,
            serverId: "server12345",
            role: { in: [Role.EDITOR, Role.ADMIN] },
         },
         data: { role: Role.VIEWER },
      });
      expect(findMany).not.toHaveBeenCalled();
   });

   it("leaves an admin's demotion off grants above the admin's rank", async () => {
      memberGrants = [grant("logs", Role.EDITOR), grant("media", Role.ADMIN)];
      actorGrants = [grant("logs", Role.ADMIN), grant("media", Role.ADMIN)];
      await clamp(Role.VIEWER, Role.ADMIN);
      expect(clampedBuckets()).toEqual(["logs"]);
   });

   it("leaves an admin's demotion off buckets the admin holds no grant on", async () => {
      memberGrants = [
         grant("logs", Role.EDITOR),
         grant("finance", Role.EDITOR),
      ];
      actorGrants = [grant("logs", Role.EDITOR)];
      await clamp(Role.VIEWER, Role.ADMIN);
      expect(clampedBuckets()).toEqual(["logs"]);
   });

   it("leaves a whole-bucket grant alone for an admin limited to folders of it", async () => {
      memberGrants = [
         grant("logs", Role.EDITOR, ["2026/"]),
         grant("media", Role.EDITOR),
      ];
      actorGrants = [
         grant("logs", Role.EDITOR, ["2026/"]),
         grant("media", Role.EDITOR, ["raw/"]),
      ];
      await clamp(Role.VIEWER, Role.ADMIN);
      expect(clampedBuckets()).toEqual(["logs"]);
   });

   it("writes nothing when the admin could hand out none of the grants", async () => {
      memberGrants = [grant("finance", Role.EDITOR)];
      await clamp(Role.VIEWER, Role.ADMIN);
      expect(h.updateMany).not.toHaveBeenCalled();
   });

   it("writes nothing when every grant above the new role is out of reach", async () => {
      await clamp(Role.EDITOR, Role.ADMIN);
      expect(findMany).not.toHaveBeenCalled();
      expect(h.updateMany).not.toHaveBeenCalled();
   });
});

describe("removeMembership", () => {
   const grantRow = (bucketName: string, role: Role) => ({
      bucketName,
      role,
      restrictedFolders: false,
      allowedFolders: [],
   });

   const roles = (actor: Role | null, target: Role | null) =>
      h.findAccess.mockImplementation(
         async ({
            where,
         }: {
            where: { userId_serverId: { userId: string } };
         }) => {
            const role =
               where.userId_serverId.userId === "actor12345" ? actor : target;
            return role
               ? { role, user: { email: "target@example.com" } }
               : null;
         }
      );

   beforeEach(() => {
      h.lock.mockResolvedValue([
         { restrictedBuckets: false, allowedBuckets: [] },
      ]);
      h.deleteGrants.mockReset().mockResolvedValue({ count: 0 });
      h.deleteAccess.mockReset().mockResolvedValue({ count: 1 });
      h.findAccess.mockReset();
      h.findGrants.mockReset().mockResolvedValue([]);
      h.revokeInvites.mockReset().mockResolvedValue([]);
   });

   it("asks the caller's check about the roles it read inside the transaction", async () => {
      roles(Role.ADMIN, Role.EDITOR);
      const assertAuthority = vi.fn();
      const { email } = await removeMembership("target1234", "server12345", {
         id: "actor12345",
         assertAuthority,
      });

      expect(assertAuthority).toHaveBeenCalledWith({
         serverRole: Role.ADMIN,
         targetRole: Role.EDITOR,
         targetBucketRoles: [],
      });
      expect(email).toBe("target@example.com");
      expect(h.deleteAccess).toHaveBeenCalled();
   });

   it("hands a missing target to the check before answering 404", async () => {
      roles(Role.VIEWER, null);
      const assertAuthority = vi.fn(() => {
         throw new ApiHttpError(403, "You don't have permission to do that");
      });
      await expect(
         removeMembership("target1234", "server12345", {
            id: "actor12345",
            assertAuthority,
         })
      ).rejects.toMatchObject({ status: 403 });
      expect(assertAuthority).toHaveBeenCalledWith({
         serverRole: Role.VIEWER,
         targetRole: null,
         targetBucketRoles: [],
      });

      roles(Role.ADMIN, null);
      await expect(
         removeMembership("target1234", "server12345", {
            id: "actor12345",
            assertAuthority: vi.fn(),
         })
      ).rejects.toMatchObject({ status: 404 });
      expect(h.deleteAccess).not.toHaveBeenCalled();
   });

   it("removes nothing once that check refuses", async () => {
      roles(Role.EDITOR, Role.ADMIN);
      await expect(
         removeMembership("target1234", "server12345", {
            id: "actor12345",
            assertAuthority: () => {
               throw new ApiHttpError(403, "You can't manage that member");
            },
         })
      ).rejects.toMatchObject({ status: 403 });

      expect(h.deleteAccess).not.toHaveBeenCalled();
      expect(h.deleteGrants).not.toHaveBeenCalled();
   });

   it("asks the check about an actor removing their own row", async () => {
      roles(Role.ADMIN, Role.ADMIN);
      const assertAuthority = vi.fn(() => {
         throw new ApiHttpError(403, "You can't manage that member");
      });
      await expect(
         removeMembership("actor12345", "server12345", {
            id: "actor12345",
            assertAuthority,
         })
      ).rejects.toMatchObject({ status: 403 });

      expect(assertAuthority).toHaveBeenCalledWith({
         serverRole: Role.ADMIN,
         targetRole: Role.ADMIN,
         targetBucketRoles: [],
      });
      expect(h.deleteAccess).not.toHaveBeenCalled();
      expect(h.deleteGrants).not.toHaveBeenCalled();
   });

   it("refuses an admin removing a member with a grant on a bucket the admin does not hold", async () => {
      roles(Role.ADMIN, Role.EDITOR);
      h.findGrants.mockImplementation(
         async ({ where }: { where: { bucketName?: unknown } }) =>
            where.bucketName
               ? [grantRow("logs", Role.VIEWER)]
               : [
                    grantRow("photos", Role.EDITOR),
                    grantRow("logs", Role.VIEWER),
                 ]
      );
      await expect(
         removeMembership("target1234", "server12345", {
            id: "actor12345",
            assertAuthority: vi.fn(),
         })
      ).rejects.toMatchObject({
         status: 403,
         message:
            "You can't remove a member with access to buckets you don't hold",
      });
      expect(h.deleteAccess).not.toHaveBeenCalled();
      expect(h.deleteGrants).not.toHaveBeenCalled();
   });

   it("names a bucket the admin holds when its grant there is out of reach", async () => {
      roles(Role.ADMIN, Role.EDITOR);
      h.findGrants.mockImplementation(
         async ({ where }: { where: { bucketName?: unknown } }) =>
            where.bucketName
               ? [grantRow("photos", Role.VIEWER)]
               : [grantRow("photos", Role.EDITOR)]
      );
      await expect(
         removeMembership("target1234", "server12345", {
            id: "actor12345",
            assertAuthority: vi.fn(),
         })
      ).rejects.toMatchObject({
         status: 403,
         message: "You can't remove a member with Editor access to photos",
      });
   });

   it("lets an admin remove a member whose grants all sit on buckets the admin holds", async () => {
      roles(Role.ADMIN, Role.EDITOR);
      h.findGrants.mockResolvedValue([
         grantRow("photos", Role.EDITOR),
         grantRow("logs", Role.VIEWER),
      ]);
      await expect(
         removeMembership("target1234", "server12345", {
            id: "actor12345",
            assertAuthority: vi.fn(),
         })
      ).resolves.toMatchObject({ email: "target@example.com" });
      expect(h.deleteAccess).toHaveBeenCalledOnce();
   });

   it("lets an owner remove a member without reading the owner's own grants", async () => {
      roles(Role.OWNER, Role.ADMIN);
      h.findGrants.mockResolvedValue([grantRow("photos", Role.ADMIN)]);
      await removeMembership("target1234", "server12345", {
         id: "actor12345",
         assertAuthority: vi.fn(),
      });
      expect(h.findGrants).toHaveBeenCalledOnce();
      expect(h.deleteAccess).toHaveBeenCalledOnce();
   });

   it("keeps an owner from leaving, without asking about an actor", async () => {
      roles(null, Role.OWNER);
      await expect(
         removeMembership("owner12345", "server12345")
      ).rejects.toMatchObject({
         status: 403,
         message: "Owners can't leave their server",
      });
   });

   it("allows self-leaving with an owner-assigned Admin bucket grant", async () => {
      roles(null, Role.VIEWER);
      h.findGrants.mockResolvedValue([
         { bucketName: "photos", role: Role.ADMIN },
      ]);
      expect(await removeMembership("target1234", "server12345")).toEqual({
         email: "target@example.com",
         revokedInvites: [],
      });
      expect(h.deleteAccess).toHaveBeenCalledOnce();
      expect(h.deleteGrants).toHaveBeenCalledOnce();
   });

   it("hands back the invites that the removal revoked, read after the membership is gone", async () => {
      roles(null, Role.ADMIN);
      const revokedInvites = [
         {
            action: "invite.revoke",
            target: "invitee@example.com",
            detail: { reason: "sender_authority" },
         },
      ];
      h.revokeInvites.mockResolvedValue(revokedInvites);
      expect(await removeMembership("target1234", "server12345")).toEqual({
         email: "target@example.com",
         revokedInvites,
      });
      expect(h.revokeInvites).toHaveBeenCalledExactlyOnceWith(
         expect.anything(),
         "server12345"
      );
      expect(h.deleteAccess.mock.invocationCallOrder[0]).toBeLessThan(
         h.revokeInvites.mock.invocationCallOrder[0]!
      );
   });
});

describe("replaceBucketAccess", () => {
   const createMany = vi.fn();
   const tx = {
      bucketAccess: { deleteMany: h.deleteGrants, createMany },
   } as unknown as Prisma.TransactionClient;
   const photos = {
      bucketName: "photos",
      role: Role.VIEWER as const,
      folders: null,
   };

   beforeEach(() => {
      h.deleteGrants.mockReset().mockResolvedValue({ count: 0 });
      createMany.mockReset().mockResolvedValue({ count: 1 });
   });

   it("replaces every grant for an editor who sees them all", async () => {
      await replaceBucketAccess(
         tx,
         "user123456",
         "server12345",
         [photos],
         null
      );
      expect(h.deleteGrants).toHaveBeenCalledWith({
         where: { userId: "user123456", serverId: "server12345" },
      });
      expect(createMany).toHaveBeenCalledOnce();
   });

   it("keeps grants on buckets the editor could not see", async () => {
      await replaceBucketAccess(
         tx,
         "user123456",
         "server12345",
         [photos],
         new Set(["photos", "logs"])
      );
      expect(h.deleteGrants).toHaveBeenCalledWith({
         where: {
            userId: "user123456",
            serverId: "server12345",
            bucketName: { in: ["photos", "logs"] },
         },
      });
   });
});
