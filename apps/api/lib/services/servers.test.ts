import { Role } from "@s3-viewer/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerInfo, listServerPage, toServerInfo } from "./servers";

const state = vi.hoisted(() => ({
   decrypt: vi.fn(),
   findAccess: vi.fn(),
   queryRaw: vi.fn(),
}));

vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: state.decrypt,
}));
vi.mock("@s3-viewer/db", () => ({
   prisma: {
      serverAccess: { findUnique: state.findAccess },
      $queryRaw: state.queryRaw,
   },
}));

type Row = Parameters<typeof toServerInfo>[0];

const FLAGS = {
   upload: true,
   replace: true,
   rename: true,
   delete: true,
   deleteProtection: "checked" as const,
};

const row = (
   provider: "Other" | "S3" = "Other",
   stored: Partial<Row> = {}
): Row => ({
   id: "server12345",
   name: "Storage",
   provider,
   auditEnabled: false,
   auditLevel: "CHANGES" as const,
   auditViewRole: "ADMIN" as const,
   auditManageRole: "OWNER" as const,
   auditRetentionDays: 30,
   ...stored,
});

beforeEach(() => {
   state.findAccess.mockReset();
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

   it("reads nothing for a provider that needs no endpoint", () => {
      const info = toServerInfo(row("S3"), Role.OWNER);
      expect(info.capabilities?.notice).toBeNull();
      expect(state.decrypt).not.toHaveBeenCalled();
   });

   it.each([undefined, { upload: "yes" }])(
      "reports a custom endpoint whose stored answer is %j as read-only",
      (capabilities) => {
         const info = toServerInfo(
            row("Other", { capabilities: capabilities as Row["capabilities"] }),
            Role.OWNER
         );
         expect(info.capabilities).toMatchObject({
            upload: false,
            delete: false,
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
         { ...row("S3", { id: "aws1234567" }), role: "VIEWER" },
      ]);
      const page = await listServerPage("user12345", undefined);
      const [strings] = state.queryRaw.mock.calls[0] as [TemplateStringsArray];
      expect(strings.join("")).not.toContain('s."credentials"');
      expect(state.decrypt).not.toHaveBeenCalled();
      expect(page.servers.map((server) => server.capabilities?.notice)).toEqual(
         [null, null]
      );
   });

   it("answers one server without its credentials", async () => {
      state.findAccess.mockResolvedValue({
         role: "EDITOR",
         server: row("S3", { id: "aws1234567" }),
      });
      const info = await getServerInfo("user12345", "aws1234567");
      expect(info.userRole).toBe(Role.EDITOR);
      const { select } = state.findAccess.mock.calls[0]![0] as {
         select: { server: { select: Record<string, unknown> } };
      };
      expect(select.server.select).not.toHaveProperty("credentials");
      expect(state.decrypt).not.toHaveBeenCalled();
   });
});
