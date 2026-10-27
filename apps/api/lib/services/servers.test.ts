import { Prisma } from "@prisma/client";
import { Role } from "@s3-viewer/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerInfo, listServerPage, toServerInfo } from "./servers";

const state = vi.hoisted(() => ({
   decrypt: vi.fn(),
   queryRaw: vi.fn(),
}));

vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: state.decrypt,
}));
vi.mock("@s3-viewer/db", () => ({
   prisma: { $queryRaw: state.queryRaw },
}));

type Row = Parameters<typeof toServerInfo>[0];

const FLAGS = {
   writable: true,
   deleteProtection: "checked" as const,
};

const row = (
   provider: "Other" | "S3" = "Other",
   stored: Partial<Row> = {}
): Row => ({
   id: "server12345",
   name: "Storage",
   provider,
   capabilities: null,
   restrictedBuckets: false,
   auditEnabled: false,
   auditLevel: "CHANGES" as const,
   auditViewRole: "ADMIN" as const,
   auditManageRole: "OWNER" as const,
   auditRetentionDays: 30,
   ...stored,
});

const sentSql = (): string => {
   const [strings, ...values] = state.queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
   ];
   return Prisma.sql(strings, ...values).sql;
};

beforeEach(() => {
   state.queryRaw.mockReset();
   state.decrypt.mockReset();
});

describe("toServerInfo capabilities", () => {
   it("answers from the stored column without opening the credentials", () => {
      const stored = { ...FLAGS, notice: "Stored B2" };
      const info = toServerInfo(
         row("Other", { capabilities: stored }),
         Role.OWNER
      );
      expect(info.capabilities).toEqual(stored);
      expect(state.decrypt).not.toHaveBeenCalled();
   });

   it.each([
      ["S3", null],
      ["Other", null],
      ["Other", { writable: "yes" }],
      [
         "Other",
         {
            upload: true,
            replace: true,
            rename: true,
            delete: true,
            deleteProtection: "checked",
            notice: null,
         },
      ],
   ] as const)(
      "reports a %s server whose stored answer is %j as read-only",
      (provider, capabilities) => {
         const info = toServerInfo(
            row(provider, {
               capabilities: capabilities as Row["capabilities"],
            }),
            Role.OWNER
         );
         expect(info.capabilities).toMatchObject({
            writable: false,
            deleteProtection: null,
         });
         expect(state.decrypt).not.toHaveBeenCalled();
      }
   );
});

describe("toServerInfo bucket creation", () => {
   it.each([
      [false, Role.OWNER, true],
      [false, Role.ADMIN, true],
      [false, Role.EDITOR, true],
      [false, Role.VIEWER, false],
      [true, Role.OWNER, true],
      [true, Role.ADMIN, false],
      [true, Role.EDITOR, false],
   ])(
      "on a server restricted to an allow-list (%s), %s can create a bucket: %s",
      (restrictedBuckets, role, allowed) => {
         const info = toServerInfo(row("Other", { restrictedBuckets }), role);
         expect(info.canCreateBucket).toBe(allowed);
      }
   );
});

describe("toServerInfo bucket removal", () => {
   it.each([true, false])(
      "offers bucket removal only on a server restricted to an allow-list (%s)",
      (restrictedBuckets) => {
         const info = toServerInfo(
            row("Other", { restrictedBuckets }),
            Role.OWNER
         );
         expect(info.canRemoveBuckets).toBe(restrictedBuckets);
      }
   );
});

describe("server list and info rows", () => {
   it("leaves the credentials blob out of the list query", async () => {
      state.queryRaw.mockResolvedValue([
         {
            ...row("Other", {
               id: "stored1234",
               capabilities: { ...FLAGS, notice: null },
            }),
            role: "OWNER",
         },
         {
            ...row("S3", {
               id: "aws1234567",
               capabilities: { ...FLAGS, notice: null },
            }),
            role: "VIEWER",
         },
      ]);
      const page = await listServerPage("user12345", undefined);
      expect(sentSql()).toContain('s."restrictedBuckets"');
      expect(sentSql()).not.toContain('"credentials"');
      expect(state.decrypt).not.toHaveBeenCalled();
      expect(page.servers.map((server) => server.capabilities.notice)).toEqual([
         null,
         null,
      ]);
   });

   it("answers one server in one statement without its credentials", async () => {
      state.queryRaw.mockResolvedValue([
         { ...row("S3", { id: "aws1234567" }), role: "EDITOR" },
      ]);
      const info = await getServerInfo("user12345", "aws1234567");
      expect(info.userRole).toBe(Role.EDITOR);
      expect(state.queryRaw).toHaveBeenCalledTimes(1);
      expect(sentSql()).toContain('s."restrictedBuckets"');
      expect(sentSql()).not.toContain('"credentials"');
      expect(state.decrypt).not.toHaveBeenCalled();
   });

   it("answers 404 for a server the user is not a member of", async () => {
      state.queryRaw.mockResolvedValue([]);
      await expect(
         getServerInfo("user12345", "aws1234567")
      ).rejects.toMatchObject({ status: 404 });
   });
});
