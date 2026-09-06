import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadCancelled } from "./utils/s3/upload-cancelled";

type SessionValue = {
   data: { user: { id: string } } | null;
   error: unknown;
   isPending: boolean;
   isRefetching: boolean;
};
const h = vi.hoisted(() => ({
   session: {
      data: null,
      error: null,
      isPending: true,
      isRefetching: false,
   } as SessionValue,
   listeners: new Set<(value: SessionValue) => void>(),
   signOut: vi.fn(),
   routerReplace: vi.fn<() => Promise<void>>(async () => undefined),
   jobs: [] as {
      userId: string;
      key: string;
      abort: ReturnType<typeof vi.fn>;
   }[],
}));
vi.mock("@s3-viewer/auth/client", () => ({
   makeAuthClient: () => ({
      authClient: {
         $store: {
            atoms: {
               session: {
                  get: () => h.session,
                  set: (value: SessionValue) => {
                     h.session = value;
                     for (const listener of h.listeners) listener(value);
                  },
                  listen: (listener: (value: SessionValue) => void) => {
                     h.listeners.add(listener);
                     return () => h.listeners.delete(listener);
                  },
               },
            },
         },
      },
      signOut: h.signOut,
   }),
}));
vi.mock("next/router", () => ({
   default: { replace: h.routerReplace, asPath: "/" },
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/utils/s3/uploadObject", () => ({
   uploadObject: ({
      userId,
      objectKey,
   }: {
      userId: string;
      objectKey: string;
   }) => {
      let reject!: (error: unknown) => void;
      const done = new Promise<void>((_, fail) => {
         reject = fail;
      });
      const abort = vi.fn(() => reject(new UploadCancelled()));
      h.jobs.push({ userId, key: objectKey, abort });
      return { done, abort };
   },
}));
const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
   getItem: (key: string) => memory.get(key) ?? null,
   setItem: (key: string, value: string) => void memory.set(key, value),
   removeItem: (key: string) => void memory.delete(key),
});

const { default: sessionStore } = await import("./stores/sessionStore");
const { default: uploadStore } = await import(
   "./stores/upload-store/uploadStore"
);
const { signOut } = await import("./auth");
const { api, handleUnauthorized } = await import("./api");

const emit = (userId: string | null) => {
   h.session = {
      data: userId ? { user: { id: userId } } : null,
      error: null,
      isPending: false,
      isRefetching: false,
   };
   for (const listener of h.listeners) listener(h.session);
};
const enqueue = () =>
   uploadStore.getState().enqueue({
      files: ["one", "two", "three", "private-fourth.txt"].map((name) => ({
         file: new File(["private contents"], name),
         relativePath: name,
      })),
      serverId: "shared-server",
      bucketName: "bucket",
      prefix: "",
   });
const expectErased = () => {
   expect(uploadStore.getState()).toMatchObject({
      entries: {},
      order: [],
      queue: [],
      batch: null,
      isUploading: false,
   });
   expect(h.jobs).toHaveLength(3);
   for (const job of h.jobs) expect(job.abort).toHaveBeenCalledOnce();
};

beforeEach(() => {
   uploadStore.getState().dismiss();
   h.jobs = [];
   emit("user-a");
   sessionStore.getState().setServerId("shared-server");
   h.signOut.mockReset().mockImplementation(async () => emit(null));
   h.routerReplace.mockReset().mockResolvedValue(undefined);
});

describe("uploads follow the authenticated session synchronously", () => {
   it("reconciles an account change that arrives during sign-out navigation without restoring files", async () => {
      let navigated!: () => void;
      h.routerReplace.mockImplementation(
         () =>
            new Promise<void>((resolve) => {
               navigated = resolve;
            })
      );
      enqueue();
      const pending = signOut();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(h.routerReplace).toHaveBeenCalledOnce();
      emit("user-b");
      navigated();
      await pending;
      expect(sessionStore.getState().userId).toBe("user-b");
      expectErased();
   });

   it("treats an explicit auth-session 401 as signed out while preserving uploads on a network failure", async () => {
      enqueue();
      h.session = {
         data: null,
         error: { status: 500 },
         isPending: false,
         isRefetching: false,
      };
      for (const listener of h.listeners) listener(h.session);
      expect(sessionStore.getState().userId).toBe("user-a");
      expect(uploadStore.getState().order).toHaveLength(4);
      for (const job of h.jobs) expect(job.abort).not.toHaveBeenCalled();
      h.session = { ...h.session, error: { status: 401 } };
      for (const listener of h.listeners) listener(h.session);
      expect(sessionStore.getState().userId).toBeNull();
      expectErased();
   });

   it("does not sign out a new user when a previous user's request returns 401", async () => {
      let finish!: (value: Response) => void;
      const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
         () =>
            new Promise<Response>((resolve) => {
               finish = resolve;
            })
      );
      const request = api.get("/servers");
      emit("user-b");
      finish(
         new Response(JSON.stringify({ message: "Sign in required" }), {
            status: 401,
         })
      );
      await expect(request).rejects.toMatchObject({ status: 401 });
      expect(sessionStore.getState().userId).toBe("user-b");
      expect(h.signOut).not.toHaveBeenCalled();
      handleUnauthorized("user-a");
      expect(sessionStore.getState().userId).toBe("user-b");
      fetch.mockRestore();
   });

   it.each([null, "user-b"])(
      "clears files on auth atom identity %s before any React effect",
      async (userId) => {
         enqueue();
         emit(userId);
         expect(sessionStore.getState().userId).toBe(userId);
         expectErased();
         await new Promise((resolve) => setTimeout(resolve, 0));
         expectErased();
      }
   );

   it("aborts files at sign-out start while the server is still processing sign-out", async () => {
      let finish!: () => void;
      h.signOut.mockImplementation(
         () =>
            new Promise<void>((resolve) => {
               finish = () => {
                  emit(null);
                  resolve();
               };
            })
      );
      enqueue();
      const signingOut = signOut();
      expect(sessionStore.getState().userId).toBeNull();
      expectErased();
      enqueue();
      expectErased();
      finish();
      await signingOut;
      emit("user-b");
      expectErased();
   });

   it("clears uploads immediately when the API reports an expired session", async () => {
      enqueue();
      handleUnauthorized("user-a");
      expectErased();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(sessionStore.getState().userId).toBeNull();
      expectErased();
   });

   it("keeps the signed-in account after refused sign-out without restoring old files", async () => {
      enqueue();
      h.signOut.mockRejectedValue(new Error("server unreachable"));
      await expect(signOut()).rejects.toThrow("server unreachable");
      expect(sessionStore.getState()).toMatchObject({
         userId: "user-a",
         serverId: "shared-server",
      });
      expectErased();
   });
});
