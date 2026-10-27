import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiHttpError, errorHandler } from "@/lib/http";
import {
   routeServer,
   scopeQueryRaw,
   signedIn,
} from "@/lib/testing/route-harness";
import type { DbRole } from "@/lib/testing/scope-probe";

const SERVER = "server12345";
const SERVER_ROW = {
   id: SERVER,
   name: "Server",
   provider: "S3",
   ownerId: "actor12345",
   auditEnabled: true,
   auditViewRole: "ADMIN",
   auditManageRole: "ADMIN",
   auditRetentionDays: 0,
};

const state = vi.hoisted(() => ({
   role: "OWNER" as DbRole | null,
   ownerId: "actor12345",
   sessionCreatedAt: Date.now(),
   record: vi.fn(),
   decrypt: vi.fn(),
   assertPublicEndpoint: vi.fn(),
   assertCredentialsWork: vi.fn(),
   invalidate: vi.fn(),
   update: vi.fn(),
   stored: "encrypted-a",
   exists: true,
}));

vi.mock("@/lib/middleware/audit-record", () => ({
   record: vi.fn(),
   recordMany: vi.fn(),
   recordWithin: state.record,
}));

vi.mock("@/lib/utils/encryption", () => ({
   decryptCredentials: state.decrypt,
}));

vi.mock("@/lib/utils/endpoint", async (original) => ({
   ...(await original<typeof import("@/lib/utils/endpoint")>()),
   assertPublicEndpoint: state.assertPublicEndpoint,
}));

vi.mock("@/lib/s3/probe", async (original) => ({
   ...(await original<typeof import("@/lib/s3/probe")>()),
   assertCredentialsWork: state.assertCredentialsWork,
}));

vi.mock("@/lib/s3/client-cache", () => ({
   invalidateS3Client: state.invalidate,
   getS3Client: vi.fn(),
   getS3ClientFromCredentials: vi.fn(() => ({})),
}));

vi.mock("@s3-viewer/db", () => ({
   prisma: {
      $queryRaw: scopeQueryRaw(() =>
         state.role
            ? {
                 role: state.role,
                 ownerId: state.ownerId,
                 auditEnabled: true,
                 credentials: "encrypted-a",
                 provider: "S3",
              }
            : null
      ),
      // the swap is staged and kept only once the transaction's work resolves, like a real commit.
      $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
         let staged = state.stored;
         const tx = {
            server: {
               updateMany: async (args: {
                  where: { credentials: string };
                  data: { credentials: string };
               }) => {
                  await state.update(args);
                  if (!state.exists || args.where.credentials !== staged)
                     return { count: 0 };
                  staged = args.data.credentials;
                  return { count: 1 };
               },
               findUnique: async () =>
                  state.exists ? { ...SERVER_ROW, credentials: staged } : null,
            },
         };
         const result = await work(tx);
         state.stored = staged;
         return result;
      },
   },
}));

const { credentialsRouter } = await import("./credentials");

let base: string;
routeServer(
   (app) => {
      app.use(express.json());
      app.use(signedIn());
      app.use((req, _res, next) => {
         Object.assign(req, {
            session: { createdAt: new Date(state.sessionCreatedAt) },
         });
         next();
      });
      app.use("/servers", credentialsRouter);
      app.use(errorHandler);
   },
   (origin) => {
      base = `${origin}/servers/${SERVER}/credentials`;
   }
);

const OLD = {
   endpoint: "https://s3.us-east-1.amazonaws.com",
   region: "us-east-1",
   accessKey: "AKIAOLDKEYID1234",
   secretKey: "old-secret",
};

const opening = (next: typeof OLD) =>
   state.decrypt.mockImplementation((blob: string) =>
      blob === "encrypted-b" ? next : OLD
   );

beforeEach(() => {
   state.role = "OWNER";
   state.ownerId = "actor12345";
   state.sessionCreatedAt = Date.now();
   state.record.mockReset().mockResolvedValue(undefined);
   state.invalidate.mockReset();
   state.assertPublicEndpoint.mockReset().mockResolvedValue(undefined);
   state.assertCredentialsWork.mockReset().mockResolvedValue(undefined);
   state.decrypt.mockReset().mockReturnValue(OLD);
   state.update.mockReset().mockResolvedValue(undefined);
   state.stored = "encrypted-a";
   state.exists = true;
});

const patchCredentials = () =>
   fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ encryptedCredentials: "encrypted-b" }),
   });

describe("PATCH /servers/:serverId/credentials", () => {
   it("records the change, always, once the new credentials are stored", async () => {
      opening({ ...OLD, accessKey: "AKIANEWKEYID5678" });
      const res = await patchCredentials();
      expect(res.status).toBe(200);
      expect(state.update.mock.calls[0]?.[0]).toMatchObject({
         where: { id: SERVER, credentials: "encrypted-a" },
         data: {
            credentials: "encrypted-b",
            provider: "S3",
            capabilities: expect.objectContaining({
               deleteProtection: "conditional",
            }),
         },
      });
      expect(state.invalidate).toHaveBeenCalledWith(SERVER);
      expect(state.stored).toBe("encrypted-b");
      expect(state.record.mock.calls[0]?.[2]).toEqual({
         action: "credentials.update",
         detail: {
            endpointHost: "s3.us-east-1.amazonaws.com",
            accessKeyIdSuffix: "5678",
            region: "us-east-1",
            endpointChanged: false,
            accountChanged: true,
         },
      });
   });

   it("notes a moved endpoint and an unchanged key, and never logs a secret", async () => {
      opening({
         ...OLD,
         endpoint: "https://acct.r2.cloudflarestorage.com",
         region: "auto",
      });
      expect((await patchCredentials()).status).toBe(200);
      const entry = state.record.mock.calls[0]?.[2];
      expect(entry.detail).toEqual({
         endpointHost: "acct.r2.cloudflarestorage.com",
         accessKeyIdSuffix: "1234",
         region: "auto",
         endpointChanged: true,
         accountChanged: false,
      });
      expect(JSON.stringify(entry)).not.toContain("secret");
      expect(JSON.stringify(entry)).not.toContain("AKIA");
   });

   it("treats unreadable stored credentials as a full change instead of failing", async () => {
      state.decrypt.mockImplementation((blob: string) => {
         if (blob === "encrypted-b") return OLD;
         throw new Error("corrupt");
      });
      expect((await patchCredentials()).status).toBe(200);
      expect(state.record.mock.calls[0]?.[2].detail).toMatchObject({
         endpointChanged: true,
         accountChanged: true,
      });
   });

   it("records nothing for a member who is not the owner", async () => {
      state.role = "ADMIN";
      expect((await patchCredentials()).status).toBe(403);
      expect(state.record).not.toHaveBeenCalled();
      expect(state.update).not.toHaveBeenCalled();
   });

   it("refuses an envelope bound to an account that is not the server's owner", async () => {
      state.ownerId = "someone-else";
      const res = await patchCredentials();
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
         message: "Only the owner can replace credentials",
      });
      expect(state.decrypt).not.toHaveBeenCalled();
      expect(state.update).not.toHaveBeenCalled();
      expect(state.record).not.toHaveBeenCalled();
   });

   it("needs a sign-in from the last day, and touches nothing without one", async () => {
      state.sessionCreatedAt = Date.now() - 25 * 60 * 60 * 1000;
      const res = await patchCredentials();
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "SESSION_STALE" });
      expect(state.decrypt).not.toHaveBeenCalled();
      expect(state.assertCredentialsWork).not.toHaveBeenCalled();
      expect(state.update).not.toHaveBeenCalled();
      expect(state.record).not.toHaveBeenCalled();

      state.ownerId = "someone-else";
      expect(await (await patchCredentials()).json()).toEqual({
         message: "Only the owner can replace credentials",
      });
   });

   it("records nothing when the server is gone", async () => {
      state.exists = false;
      expect((await patchCredentials()).status).toBe(404);
      expect(state.record).not.toHaveBeenCalled();
      expect(state.invalidate).not.toHaveBeenCalled();
   });

   it("keeps the old credentials when the audit row cannot be written", async () => {
      opening({ ...OLD, accessKey: "AKIANEWKEYID5678" });
      state.record.mockRejectedValueOnce(new Error("audit down"));
      expect((await patchCredentials()).status).toBe(500);
      expect(state.update).toHaveBeenCalledOnce();
      expect(state.stored).toBe("encrypted-a");
      expect(state.invalidate).not.toHaveBeenCalled();
   });

   it("refuses a swap when the stored credentials changed after they were read", async () => {
      state.stored = "encrypted-c";
      const res = await patchCredentials();
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
         message:
            "Server credentials were replaced by another session. Reload and try again.",
      });
      expect(state.stored).toBe("encrypted-c");
      expect(state.record).not.toHaveBeenCalled();
      expect(state.invalidate).not.toHaveBeenCalled();
   });

   it("records nothing when the credentials do not work", async () => {
      state.assertCredentialsWork.mockRejectedValue(
         new ApiHttpError(400, "Credential update failed")
      );
      expect((await patchCredentials()).status).toBe(400);
      expect(state.record).not.toHaveBeenCalled();
      expect(state.update).not.toHaveBeenCalled();
   });

   it("records nothing when the body cannot be decrypted", async () => {
      state.decrypt.mockImplementation(() => {
         throw new Error("bad envelope");
      });
      expect((await patchCredentials()).status).toBe(400);
      expect(state.record).not.toHaveBeenCalled();
   });
});
