import { createWebLocks } from "@/lib/test/web-locks";
import { UploadCancelledError } from "@/lib/utils/s3/upload-cancelled";
import { EXPECTED_USER_ID_HEADER, type S3UploadedPart } from "@s3-viewer/types";
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/test/storage";

const transport = vi.hoisted(() => ({
   putBytes: vi.fn(),
   signOut: vi.fn(),
   navigate: vi.fn(),
}));
vi.mock("@s3-viewer/auth/client", () => ({
   makeAuthClient: () => ({
      authClient: { $store: { atoms: {} } },
      signOut: transport.signOut,
   }),
}));
vi.mock("next/router", () => ({
   default: { replace: transport.navigate, asPath: "/" },
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/utils/s3/upload-object", async () => ({
   uploadObject: (await import("@/lib/utils/s3/upload-multipart"))
      .uploadMultipart,
}));
vi.mock("@/lib/utils/s3/upload-transport", async (importOriginal) => ({
   ...(await importOriginal<
      typeof import("@/lib/utils/s3/upload-transport")
   >()),
   putBytes: transport.putBytes,
}));

const storage = createMemoryStorage();
const { memory } = storage;
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("navigator", { locks: createWebLocks() });

const { default: session } = await import("@/lib/stores/session-store");
const { default: uploads } = await import(
   "@/lib/stores/upload-store/upload-store"
);
const { signOut } = await import("./auth");

afterEach(async () => {
   await uploads.getState().cancelAllAndClear();
   session.getState().clearSession();
   vi.unstubAllGlobals();
});

it("aborts a persisted multipart upload before invalidating the outgoing session", async () => {
   session.getState().setUserId("outgoing-user");
   const parts: { acknowledge: () => void; abort: ReturnType<typeof vi.fn> }[] =
      [];
   transport.putBytes.mockImplementation(
      ({ url, body }: { url: string; body: Blob }) => {
         const partNumber = Number(
            new URL(url, "http://localhost").searchParams.get("partNumber")
         );
         let resolve!: (part: S3UploadedPart) => void;
         let reject!: (error: unknown) => void;
         const done = new Promise<S3UploadedPart>((yes, no) => {
            resolve = yes;
            reject = no;
         });
         const abort = vi.fn(() => reject(new UploadCancelledError()));
         parts.push({
            acknowledge: () =>
               resolve({
                  partNumber,
                  eTag: `"part-${partNumber}"`,
                  size: body.size,
               }),
            abort,
         });
         return { done, abort };
      }
   );
   let finishAbort!: (response: Response) => void;
   const abortResponse = new Promise<Response>((resolve) => {
      finishAbort = resolve;
   });
   const aborted = vi.fn();
   vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, options: RequestInit) => {
         if (options.method === "DELETE") {
            aborted({
               userId: session.getState().userId,
               headers: options.headers,
               body: JSON.parse(options.body as string),
            });
            return abortResponse;
         }
         expect(options.method).toBe("POST");
         return Response.json({
            uploadId: "multipart-1",
            partSize: 5,
            partCount: 3,
         });
      })
   );
   transport.signOut.mockResolvedValue(undefined);
   transport.navigate.mockResolvedValue(undefined);

   let pending: Promise<void> | undefined;
   try {
      const file = new File(["twelve bytes"], "private.bin");
      uploads.getState().enqueue({
         files: [{ file, relativePath: file.name }],
         serverId: "server",
         bucketName: "bucket",
         prefix: "",
      });
      await vi.waitFor(() => expect(parts).toHaveLength(3));
      parts[0]!.acknowledge();
      await vi.waitFor(() =>
         expect(
            [...memory.keys()].some((key) =>
               key.startsWith("s3-viewer.multipart-uploads.parts.")
            )
         ).toBe(true)
      );

      pending = signOut();
      expect(uploads.getState().entries).toEqual({});
      expect(session.getState().userId).toBe("outgoing-user");
      await vi.waitFor(() => expect(aborted).toHaveBeenCalledOnce());
      for (const { abort } of parts.slice(1))
         expect(abort).toHaveBeenCalledOnce();
      expect(aborted).toHaveBeenCalledWith({
         userId: "outgoing-user",
         headers: expect.objectContaining({
            [EXPECTED_USER_ID_HEADER]: "outgoing-user",
         }),
         body: {
            objectKey: "private.bin",
            uploadId: "multipart-1",
            expectedUserId: "outgoing-user",
         },
      });
      expect(transport.signOut).not.toHaveBeenCalled();
      expect(transport.navigate).not.toHaveBeenCalled();
      finishAbort(new Response(null, { status: 204 }));
      await pending;
      expect(transport.signOut).toHaveBeenCalledExactlyOnceWith(
         "outgoing-user"
      );
      expect(session.getState().userId).toBeNull();
      expect(
         [...memory.keys()].some((key) =>
            key.startsWith("s3-viewer.multipart-uploads")
         )
      ).toBe(false);
   } finally {
      finishAbort(new Response(null, { status: 204 }));
      await pending;
   }
});
