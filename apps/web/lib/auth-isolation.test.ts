import { createWebLocks } from "@/lib/test/web-locks";
import { expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/test/storage";

const h = vi.hoisted(() => ({ signOut: vi.fn(), replace: vi.fn() }));
vi.mock("@s3-viewer/auth/client", () => ({
   makeAuthClient: () => ({
      authClient: { $store: { atoms: {} } },
      signOut: h.signOut,
   }),
}));
vi.mock("next/router", () => ({
   default: { replace: h.replace, asPath: "/" },
}));
vi.mock("@/lib/stores/upload-store/upload-store", () => {
   throw new Error("auth must not load the upload store");
});
vi.mock("@/lib/utils/s3/upload-object", () => {
   throw new Error("auth must not load the upload engine");
});

const storage = createMemoryStorage();
const { memory } = storage;
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("navigator", { locks: createWebLocks() });

const { default: session } = await import("@/lib/stores/session-store");
const { signOut } = await import("./auth");

const CATALOG = "s3-viewer.multipart-uploads";

const resumable = (userId: string, objectKey: string) => {
   const target = JSON.stringify(["server", "bucket", objectKey]);
   const digests = `${CATALOG}.parts.${JSON.stringify([userId, target, `upload-${objectKey}`, 0])}`;
   return {
      target,
      digests,
      session: {
         userId,
         serverId: "server",
         bucketName: "bucket",
         objectKey,
         uploadId: `upload-${objectKey}`,
         partSize: 5,
         partCount: 3,
         fileName: objectKey,
         fileSize: 12,
         lastModified: 1,
         expectedETag: null,
         savedAt: Date.now(),
      },
   };
};

it("signs out without the upload engine and forgets the outgoing user's resumable uploads", async () => {
   const upload = resumable("outgoing-user", "private/tax-return.pdf");
   memory.set(CATALOG, JSON.stringify({ [upload.target]: upload.session }));
   memory.set(upload.digests, JSON.stringify({ 1: { eTag: '"p1"' } }));
   session.getState().setUserId("outgoing-user");
   h.signOut.mockResolvedValue(undefined);
   h.replace.mockResolvedValue(undefined);

   await signOut();

   expect(h.signOut).toHaveBeenCalledExactlyOnceWith("outgoing-user");
   expect(session.getState().userId).toBeNull();
   expect(memory.has(CATALOG)).toBe(false);
   expect(memory.has(upload.digests)).toBe(false);
});
