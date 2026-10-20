import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "@/lib/test/storage";
import { UploadCancelled } from "@/lib/utils/s3/upload-cancelled";

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
   holdCleanup: false,
   cleanups: [] as (() => void)[],
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
vi.mock("@/lib/utils/s3/upload-object", () => ({
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
      const abort = vi.fn(() => {
         const finish = () => reject(new UploadCancelled());
         if (h.holdCleanup) h.cleanups.push(finish);
         else finish();
      });
      h.jobs.push({ userId, key: objectKey, abort });
      return { done, abort };
   },
}));
vi.stubGlobal("localStorage", createMemoryStorage());

const { default: sessionStore } = await import("@/lib/stores/session-store");
const { default: uploadStore } = await import(
   "@/lib/stores/upload-store/upload-store"
);
const { signOut } = await import("./auth");
const { handleUnauthorized } = await import("./api");

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
      batch: null,
      isUploading: false,
   });
   expect(h.jobs).not.toHaveLength(0);
   for (const job of h.jobs) expect(job.abort).toHaveBeenCalledOnce();
};

beforeEach(async () => {
   h.holdCleanup = false;
   await uploadStore.getState().cancelAllAndClear();
   h.jobs = [];
   h.cleanups = [];
   emit("user-a");
   sessionStore.getState().setServerId("shared-server");
   h.signOut.mockReset().mockImplementation(async () => emit(null));
   h.routerReplace.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

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
      await vi.waitFor(() => expect(h.routerReplace).toHaveBeenCalledOnce(), {
         interval: 1,
      });
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
      expect(sessionStore.getState().userId).toBe("user-a");
      expectErased();
      enqueue();
      expectErased();
      await vi.waitFor(
         () => expect(sessionStore.getState().userId).toBeNull(),
         {
            interval: 1,
         }
      );
      finish();
      await signingOut;
      emit("user-b");
      expectErased();
   });

   it("waits for every upload cleanup while keeping the outgoing identity usable", async () => {
      h.holdCleanup = true;
      enqueue();
      const pending = signOut();
      expectErased();
      expect(sessionStore.getState().userId).toBe("user-a");
      expect(h.signOut).not.toHaveBeenCalled();
      enqueue();
      expectErased();
      h.cleanups[0]!();
      h.cleanups[1]!();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(h.signOut).not.toHaveBeenCalled();
      expect(sessionStore.getState().userId).toBe("user-a");
      h.cleanups[2]!();
      await pending;
      expect(h.signOut).toHaveBeenCalledExactlyOnceWith("user-a");
      expect(sessionStore.getState().userId).toBeNull();
   });

   it("coalesces concurrent sign-outs and keeps the first navigation destination", async () => {
      h.holdCleanup = true;
      enqueue();
      const first = signOut("/login?next=%2Fsettings");
      const second = signOut("/login");
      expect(second).toBe(first);
      expectErased();
      for (const finish of h.cleanups) finish();
      await Promise.all([first, second]);
      expect(h.signOut).toHaveBeenCalledExactlyOnceWith("user-a");
      expect(h.routerReplace).toHaveBeenCalledExactlyOnceWith(
         "/login?next=%2Fsettings"
      );
   });

   it("continues signing out when an upload cleanup never settles", async () => {
      vi.useFakeTimers();
      h.holdCleanup = true;
      enqueue();
      const pending = signOut();
      expect(h.signOut).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(3000);
      await pending;
      expect(h.signOut).toHaveBeenCalledExactlyOnceWith("user-a");
      expect(sessionStore.getState().userId).toBeNull();
      expectErased();
      for (const finish of h.cleanups) finish();
   });

   it("preserves an account that replaces the outgoing one during upload cleanup", async () => {
      h.holdCleanup = true;
      enqueue();
      const pending = signOut();
      emit("user-b");
      expect(sessionStore.getState().userId).toBe("user-b");
      enqueue();
      expectErased();
      for (const finish of h.cleanups) finish();
      await pending;
      expect(h.signOut).not.toHaveBeenCalled();
      expect(h.routerReplace).not.toHaveBeenCalled();
      h.holdCleanup = false;
      enqueue();
      expect(h.jobs.slice(3).map(({ userId }) => userId)).toEqual([
         "user-b",
         "user-b",
         "user-b",
      ]);
   });

   it("does not clear a new account while settling the sign-out response", async () => {
      h.signOut.mockImplementation(async () => emit("user-b"));
      await signOut();
      expect(sessionStore.getState().userId).toBe("user-b");
      expect(h.signOut).toHaveBeenCalledExactlyOnceWith("user-a");
      expect(h.routerReplace).not.toHaveBeenCalled();
   });

   it("clears uploads immediately when the API reports an expired session", async () => {
      enqueue();
      handleUnauthorized("user-a");
      expectErased();
      await vi.waitFor(
         () => expect(sessionStore.getState().userId).toBeNull(),
         {
            interval: 1,
         }
      );
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
      enqueue();
      expect(h.jobs).toHaveLength(6);
   });
});
