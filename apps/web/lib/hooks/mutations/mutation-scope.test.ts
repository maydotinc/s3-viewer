// @vitest-environment happy-dom
import { act, createElement } from "react";
import { onlineManager } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import useSessionStore from "@/lib/stores/session-store";
import { deferred, flushRuntime, mountRuntime } from "@/lib/test/runtime";
import useCreateBucket from "./bucket/useCreateBucket";
import useRemoveBucket from "./bucket/useRemoveBucket";
import useRevokeInvite from "./invites/useRevokeInvite";
import useDeleteServer from "./server/useDeleteServer";
import useApiMutation from "./useApiMutation";

const h = vi.hoisted(() => ({
   post: vi.fn(),
   remove: vi.fn(),
   session: { userId: "original-user", serverId: "original-server" },
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: {
      getState: () => ({
         ...h.session,
         setUserId: (userId: string) => {
            h.session.userId = userId;
         },
         setServerId: (serverId: string) => {
            h.session.serverId = serverId;
         },
      }),
   },
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   api: { post: h.post, delete: h.remove },
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mounted: Awaited<ReturnType<typeof mountRuntime>>[] = [];
const mountHook = async <T>(hook: () => T) => {
   let current!: T;
   const Probe = () => {
      current = hook();
      return null;
   };
   const runtime = await mountRuntime(createElement(Probe));
   mounted.push(runtime);
   return {
      ...runtime,
      get current() {
         return current;
      },
   };
};
const changeScope = (userId: string, serverId: string) => {
   useSessionStore.getState().setUserId(userId);
   useSessionStore.getState().setServerId(serverId);
};

beforeEach(() => {
   vi.clearAllMocks();
   onlineManager.setOnline(true);
   changeScope("original-user", "original-server");
   h.post.mockImplementation(async (_path, { bucketName }) => ({
      bucket: { name: bucketName },
   }));
   h.remove.mockResolvedValue(undefined);
});
afterEach(async () => {
   onlineManager.setOnline(true);
   for (const runtime of mounted.splice(0)) {
      await runtime.unmount();
      runtime.queryClient.clear();
   }
   vi.unstubAllGlobals();
});

describe("per-invocation mutation scope", () => {
   it("resumes overlapping offline mutations under their own server scopes", async () => {
      onlineManager.setOnline(false);
      const runtime = await mountHook(useCreateBucket);
      const invalidate = vi.spyOn(runtime.queryClient, "invalidateQueries");
      let first!: Promise<unknown>;
      let second!: Promise<unknown>;
      await act(async () => {
         first = runtime.current.mutateAsync("first");
         useSessionStore.getState().setServerId("second-server");
         second = runtime.current.mutateAsync("second");
      });
      expect(h.post).not.toHaveBeenCalled();
      await act(async () => {
         onlineManager.setOnline(true);
         await runtime.queryClient.resumePausedMutations();
         await Promise.all([first, second]);
      });
      expect(h.post.mock.calls).toEqual([
         ["/servers/original-server/buckets", { bucketName: "first" }],
         ["/servers/second-server/buckets", { bucketName: "second" }],
      ]);
      expect(invalidate).toHaveBeenCalledWith({
         queryKey: queryKeys.buckets("original-user", "original-server"),
      });
      expect(invalidate).toHaveBeenCalledWith({
         queryKey: queryKeys.buckets("original-user", "second-server"),
      });
      await flushRuntime();
      expect(runtime.current.variables).toBe("second");
   });

   it("refuses an older account's queued invocation while allowing the next account's invocation", async () => {
      onlineManager.setOnline(false);
      const runtime = await mountHook(useCreateBucket);
      let first!: Promise<unknown>;
      let second!: Promise<unknown>;
      await act(async () => {
         first = runtime.current
            .mutateAsync("stale")
            .catch((error: unknown) => error);
         changeScope("other-user", "other-server");
         second = runtime.current.mutateAsync("current");
      });
      await act(async () => {
         onlineManager.setOnline(true);
         await runtime.queryClient.resumePausedMutations();
         await second;
      });
      expect(await first).toMatchObject({
         status: 403,
         code: "ACCOUNT_CHANGED",
      });
      expect(h.post.mock.calls).toEqual([
         ["/servers/other-server/buckets", { bucketName: "current" }],
      ]);
   });

   it("refuses a paused mutation after its observer unmounts and the account changes", async () => {
      onlineManager.setOnline(false);
      const runtime = await mountHook(useRemoveBucket);
      let pending!: Promise<unknown>;
      await act(async () => {
         pending = runtime.current
            .mutateAsync("backups")
            .catch((error: unknown) => error);
      });
      await runtime.unmount();
      changeScope("other-user", "other-server");
      onlineManager.setOnline(true);
      await runtime.queryClient.resumePausedMutations();
      expect(await pending).toMatchObject({ code: "ACCOUNT_CHANGED" });
      expect(h.remove).not.toHaveBeenCalled();
   });

   it("settles an already-started request against its original cache and unwraps per-call callbacks", async () => {
      const response = deferred<{ bucket: { name: string } }>();
      h.post.mockReturnValue(response.promise);
      const runtime = await mountHook(useCreateBucket);
      const invalidate = vi.spyOn(runtime.queryClient, "invalidateQueries");
      const success = vi.fn();
      const settled = vi.fn();
      let pending!: Promise<unknown>;
      await act(async () => {
         pending = runtime.current.mutateAsync("backups", {
            onSuccess: success,
            onSettled: settled,
         });
      });
      expect(h.post).toHaveBeenCalledOnce();
      changeScope("other-user", "other-server");
      const bucket = { name: "backups" };
      await act(async () => {
         response.resolve({ bucket });
         await pending;
      });
      const scope = { userId: "original-user", serverId: "original-server" };
      expect(invalidate).toHaveBeenCalledWith({
         queryKey: queryKeys.buckets(scope.userId, scope.serverId),
      });
      expect(success).toHaveBeenCalledWith(bucket, "backups", scope);
      expect(settled).toHaveBeenCalledWith(bucket, null, "backups", scope);
   });

   it("keeps removal and failure callbacks bound to an in-flight request's scope", async () => {
      const response = deferred<void>();
      h.remove.mockReturnValue(response.promise);
      const runtime = await mountHook(useRemoveBucket);
      const invalidate = vi.spyOn(runtime.queryClient, "invalidateQueries");
      const onError = vi.fn();
      let pending!: Promise<unknown>;
      await act(async () => {
         pending = runtime.current
            .mutateAsync("backups", { onError })
            .catch((error: unknown) => error);
      });
      changeScope("other-user", "other-server");
      const error = new ApiError(404, "Gone");
      await act(async () => {
         response.reject(error);
         await pending;
      });
      expect(invalidate).toHaveBeenCalledWith({
         queryKey: queryKeys.buckets("original-user", "original-server"),
      });
      expect(onError).toHaveBeenCalledWith(error, "backups", {
         userId: "original-user",
         serverId: "original-server",
      });
   });

   it("removes a completed bucket from only its original account cache", async () => {
      const response = deferred<void>();
      h.remove.mockReturnValue(response.promise);
      const runtime = await mountHook(useRemoveBucket);
      const remove = vi.spyOn(runtime.queryClient, "removeQueries");
      let pending!: Promise<unknown>;
      await act(async () => {
         pending = runtime.current.mutateAsync("backups");
      });
      changeScope("other-user", "other-server");
      await act(async () => {
         response.resolve();
         await pending;
      });
      expect(remove).toHaveBeenCalledWith({
         queryKey: queryKeys.bucket(
            "original-user",
            "original-server",
            "backups"
         ),
      });
   });

   it("refreshes invitations under the account that started the revoke", async () => {
      const response = deferred<void>();
      h.remove.mockReturnValue(response.promise);
      const runtime = await mountHook(useRevokeInvite);
      const invalidate = vi.spyOn(runtime.queryClient, "invalidateQueries");
      let pending!: Promise<unknown>;
      await act(async () => {
         pending = runtime.current.mutateAsync({
            serverId: "shared-server",
            inviteId: "invite",
         });
      });
      changeScope("other-user", "other-server");
      await act(async () => {
         response.resolve();
         await pending;
      });
      expect(invalidate).toHaveBeenCalledWith({
         queryKey: queryKeys.sentInvites("original-user", "shared-server"),
      });
   });

   it("removes a deleted server from the account that requested deletion", async () => {
      const response = deferred<void>();
      h.remove.mockReturnValue(response.promise);
      const runtime = await mountHook(useDeleteServer);
      const remove = vi.spyOn(runtime.queryClient, "removeQueries");
      const invalidate = vi.spyOn(runtime.queryClient, "invalidateQueries");
      let pending!: Promise<unknown>;
      await act(async () => {
         pending = runtime.current.mutateAsync({ serverId: "doomed-server" });
      });
      changeScope("other-user", "other-server");
      await act(async () => {
         response.resolve();
         await pending;
      });
      expect(remove).toHaveBeenCalledWith({
         queryKey: queryKeys.server("original-user", "doomed-server"),
      });
      expect(invalidate).toHaveBeenCalledWith({
         queryKey: queryKeys.servers("original-user"),
      });
   });

   it("unwraps mutate callbacks and observer variables without changing void inputs", async () => {
      const request = vi.fn(async (value: void) => value);
      const runtime = await mountHook(() => useApiMutation({ request }));
      const onSuccess = vi.fn();
      await act(async () => {
         runtime.current.mutate(undefined, { onSuccess });
      });
      await flushRuntime();
      expect(request).toHaveBeenCalledWith(undefined, {
         userId: "original-user",
         serverId: "original-server",
      });
      expect(onSuccess).toHaveBeenCalledWith(undefined, undefined, {
         userId: "original-user",
         serverId: "original-server",
      });
      expect(runtime.current.variables).toBeUndefined();
   });
});
