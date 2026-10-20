import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { S3DeleteResult, S3DeleteTarget } from "@s3-viewer/types";

const h = vi.hoisted(() => ({
   client: null as QueryClient | null,
   session: { userId: "other-user", serverId: "other-server" },
   get: vi.fn(),
   post: vi.fn(),
   patch: vi.fn(),
   delete: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (original) => ({
   ...(await original<typeof import("@tanstack/react-query")>()),
   useQueryClient: () => h.client,
   useMutation: (options: unknown) => options,
}));
vi.mock("@/lib/stores/session-store", () => ({
   default: (select: (state: typeof h.session) => unknown) => select(h.session),
   useUserId: () => h.session.userId,
}));
vi.mock("@/lib/api", async (original) => ({
   objectMutationPath: (await original<typeof import("@/lib/api")>())
      .objectMutationPath,
   ApiError: class extends Error {
      constructor(readonly status: number) {
         super("api error");
      }
   },
   api: { get: h.get, post: h.post, patch: h.patch, delete: h.delete },
   objectsPath: (serverId: string, bucket: string) =>
      `/servers/${serverId}/buckets/${bucket}/objects`,
   qs: () => "",
   cancelledError: () => new Error("cancelled"),
   isAborted: () => false,
   errorMessage: String,
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { error: vi.fn(), success: vi.fn() },
}));

import useCopyObject from "./useCopyObject";
import useCreateFolder from "./useCreateFolder";
import useDeleteObjects, { type DeleteSummary } from "./useDeleteObjects";
import useDeletePrefix from "./useDeletePrefix";
import useMoveObjects, { type MoveSummary } from "./useMoveObjects";
import useMovePrefix from "./useMovePrefix";
import useRenameObject from "./useRenameObject";
import useUpdateObjectSettings from "./useUpdateObjectSettings";

type Scope = { userId: string; serverId: string; bucketName: string };
type Mutation<Input, Result> = {
   mutationFn: (input: Input) => Promise<Result>;
   onSettled: (
      result: Result | undefined,
      error: Error | null,
      input: Input
   ) => void;
};

const target: Scope = {
   userId: "original-user",
   serverId: "original-server",
   bucketName: "backups",
};
const objectKey = "folder/important.txt";
const objects = [{ key: objectKey, expectedETag: '"reviewed"' }];
const originalPath = "/servers/original-server/buckets/backups/objects";
const scopes = [
   target,
   { ...target, serverId: "other-server" },
   { ...target, userId: "other-user" },
];
const previewKey = (scope: Scope, key = objectKey) =>
   queryKeys.objectPreview(scope.userId, scope.serverId, scope.bucketName, key);
const listingKey = (scope: Scope) =>
   queryKeys.objectKeySuggestions(
      scope.userId,
      scope.serverId,
      scope.bucketName,
      ""
   );

beforeEach(() => {
   vi.clearAllMocks();
   h.session = { userId: "other-user", serverId: "other-server" };
   h.client = new QueryClient();
   for (const scope of scopes) {
      h.client.setQueryData(previewKey(scope), "cached preview");
      h.client.setQueryData(listingKey(scope), "cached listing");
   }
   h.delete.mockImplementation(
      async (_path, input: { objects: S3DeleteTarget[] }) =>
         ({
            deleted: input.objects.map(({ key }) => key),
            failed: [],
         }) satisfies S3DeleteResult
   );
   h.post.mockResolvedValue(undefined);
});

const expectOnlyOriginalCacheChanged = () => {
   expect(h.client?.getQueryData(previewKey(target))).toBeUndefined();
   expect(h.client?.getQueryState(listingKey(target))?.isInvalidated).toBe(
      true
   );
   for (const scope of scopes.slice(1)) {
      expect(h.client?.getQueryData(previewKey(scope))).toBe("cached preview");
      expect(h.client?.getQueryState(listingKey(scope))?.isInvalidated).toBe(
         false
      );
   }
};

const newObjectKey = "archive/important.txt";

describe("object mutations keep the confirmed target", () => {
   it("deletes on the captured server and invalidates the captured user's cache", async () => {
      const input = { ...target, objects };
      const mutation = useDeleteObjects() as unknown as Mutation<
         typeof input,
         DeleteSummary
      >;
      const result = await mutation.mutationFn(input);
      const latest = useDeleteObjects() as unknown as typeof mutation;
      latest.onSettled(result, null, input);
      expect(h.delete).toHaveBeenCalledWith(
         `${originalPath}/v3`,
         { objects, expectedUserId: target.userId },
         undefined
      );
      expectOnlyOriginalCacheChanged();
   });

   it("lists and deletes folder contents only on the captured server", async () => {
      h.get.mockResolvedValue({ objects, nextToken: null });
      const input = {
         ...target,
         prefix: "folder/",
         signal: new AbortController().signal,
      };
      const mutation = useDeletePrefix() as unknown as Mutation<
         typeof input,
         DeleteSummary
      >;
      const result = await mutation.mutationFn(input);
      const latest = useDeletePrefix() as unknown as typeof mutation;
      latest.onSettled(result, null, input);
      expect(h.get).toHaveBeenCalledWith(`${originalPath}/keys`, input.signal);
      expect(h.delete).toHaveBeenCalledWith(
         `${originalPath}/v3`,
         { objects, expectedUserId: target.userId },
         input.signal
      );
      expectOnlyOriginalCacheChanged();
   });

   it("renames and invalidates both object names on the captured server", async () => {
      const input = {
         ...target,
         objectKey,
         newObjectKey: "folder/renamed.txt",
         expectedETag: '"reviewed"',
      };
      for (const scope of scopes)
         h.client?.setQueryData(
            previewKey(scope, input.newObjectKey),
            "destination preview"
         );
      const mutation = useRenameObject() as unknown as Mutation<
         typeof input,
         void
      >;
      await mutation.mutationFn(input);
      const latest = useRenameObject() as unknown as typeof mutation;
      latest.onSettled(undefined, null, input);
      expect(h.post).toHaveBeenCalledWith(`${originalPath}/v3/rename`, {
         expectedUserId: target.userId,
         objectKey,
         newObjectKey: input.newObjectKey,
         expectedETag: '"reviewed"',
      });
      expect(h.get).not.toHaveBeenCalled();
      expectOnlyOriginalCacheChanged();
      expect(
         h.client?.getQueryData(previewKey(target, input.newObjectKey))
      ).toBeUndefined();
      for (const scope of scopes.slice(1))
         expect(
            h.client?.getQueryData(previewKey(scope, input.newObjectKey))
         ).toBe("destination preview");
   });

   it("moves objects on the captured server and forgets both keys", async () => {
      h.post.mockResolvedValue({ moved: [objectKey], failed: [] });
      const moves = [
         { key: objectKey, newKey: newObjectKey, expectedETag: '"reviewed"' },
      ];
      const input = { ...target, objects: moves };
      const mutation = useMoveObjects() as unknown as Mutation<
         typeof input,
         MoveSummary
      >;
      const result = await mutation.mutationFn(input);
      expect(result.done).toBe(1);
      const latest = useMoveObjects() as unknown as typeof mutation;
      latest.onSettled(result, null, input);
      expect(h.post).toHaveBeenCalledWith(
         `${originalPath}/v3/move`,
         { expectedUserId: target.userId, objects: moves },
         undefined
      );
      expectOnlyOriginalCacheChanged();
   });

   it("lists and moves folder contents only on the captured server", async () => {
      h.get.mockResolvedValue({ objects, nextToken: null });
      h.post.mockResolvedValue({ moved: [objectKey], failed: [] });
      const input = {
         ...target,
         prefix: "folder/",
         newPrefix: "archive/",
         signal: new AbortController().signal,
      };
      const mutation = useMovePrefix() as unknown as Mutation<
         typeof input,
         MoveSummary
      >;
      const result = await mutation.mutationFn(input);
      const latest = useMovePrefix() as unknown as typeof mutation;
      latest.onSettled(result, null, input);
      expect(h.get).toHaveBeenCalledWith(`${originalPath}/keys`, input.signal);
      expect(h.post).toHaveBeenCalledWith(
         `${originalPath}/v3/move`,
         {
            expectedUserId: target.userId,
            objects: [
               {
                  key: objectKey,
                  newKey: newObjectKey,
                  expectedETag: '"reviewed"',
               },
            ],
         },
         input.signal
      );
      expectOnlyOriginalCacheChanged();
   });

   it("copies on the captured server and forgets only the destination key", async () => {
      for (const scope of scopes)
         h.client?.setQueryData(previewKey(scope, newObjectKey), "cached copy");
      h.post.mockResolvedValue({ key: newObjectKey, size: 1, eTag: '"copy"' });
      const input = {
         ...target,
         objectKey,
         newObjectKey,
         expectedETag: '"reviewed"',
      };
      const mutation = useCopyObject() as unknown as Mutation<
         typeof input,
         unknown
      >;
      const result = await mutation.mutationFn(input);
      const latest = useCopyObject() as unknown as typeof mutation;
      latest.onSettled(result, null, input);
      expect(h.post).toHaveBeenCalledWith(`${originalPath}/v3/copy`, {
         expectedUserId: target.userId,
         objectKey,
         newObjectKey,
         expectedETag: '"reviewed"',
      });
      // the source is unchanged, so an open view of it keeps its preview
      expect(h.client?.getQueryData(previewKey(target))).toBe("cached preview");
      expect(
         h.client?.getQueryData(previewKey(target, newObjectKey))
      ).toBeUndefined();
      expect(h.client?.getQueryState(listingKey(target))?.isInvalidated).toBe(
         true
      );
      for (const scope of scopes.slice(1)) {
         expect(h.client?.getQueryData(previewKey(scope, newObjectKey))).toBe(
            "cached copy"
         );
         expect(h.client?.getQueryState(listingKey(scope))?.isInvalidated).toBe(
            false
         );
      }
   });

   it("creates a folder only on the captured server", async () => {
      const folderKey = "folder/reports/";
      for (const scope of scopes)
         h.client?.setQueryData(previewKey(scope, folderKey), "cached marker");
      h.post.mockResolvedValue({ key: folderKey });
      const input = { ...target, folderKey };
      const mutation = useCreateFolder() as unknown as Mutation<
         typeof input,
         unknown
      >;
      const result = await mutation.mutationFn(input);
      const latest = useCreateFolder() as unknown as typeof mutation;
      latest.onSettled(result, null, input);
      expect(h.post).toHaveBeenCalledWith(`${originalPath}/v3/folders`, {
         expectedUserId: target.userId,
         folderKey,
      });
      expect(
         h.client?.getQueryData(previewKey(target, folderKey))
      ).toBeUndefined();
      for (const scope of scopes.slice(1))
         expect(h.client?.getQueryData(previewKey(scope, folderKey))).toBe(
            "cached marker"
         );
   });

   it("saves settings on the captured server and forgets that object", async () => {
      h.patch.mockResolvedValue({ contentType: "text/plain" });
      const input = {
         ...target,
         objectKey,
         expectedETag: '"reviewed"',
         contentType: "text/plain",
      };
      const mutation = useUpdateObjectSettings() as unknown as Mutation<
         typeof input,
         unknown
      >;
      const result = await mutation.mutationFn(input);
      const latest = useUpdateObjectSettings() as unknown as typeof mutation;
      latest.onSettled(result, null, input);
      expect(h.patch).toHaveBeenCalledWith(`${originalPath}/v3/settings`, {
         expectedUserId: target.userId,
         objectKey,
         expectedETag: '"reviewed"',
         contentType: "text/plain",
      });
      expectOnlyOriginalCacheChanged();
   });
});

describe("an open object view after a mutation that did not go through", () => {
   const watch = (key: string) =>
      new QueryObserver(h.client!, {
         queryKey: previewKey(target, key),
         queryFn: async () => "fresh preview",
         staleTime: Infinity,
      }).subscribe(() => undefined);
   const cached = (key: string) =>
      h.client?.getQueryCache().find({ queryKey: previewKey(target, key) });

   it("keeps a view whose delete storage refused, and drops the one it confirmed", async () => {
      const kept = "folder/kept.txt";
      watch(objectKey);
      watch(kept);
      const input = {
         ...target,
         objects: [...objects, { key: kept, expectedETag: '"reviewed"' }],
      };
      const mutation = useDeleteObjects() as unknown as Mutation<
         typeof input,
         DeleteSummary
      >;
      h.delete.mockResolvedValue({
         deleted: [objectKey],
         failed: [{ key: kept, message: "Changed", retryable: false }],
      });
      mutation.onSettled(await mutation.mutationFn(input), null, input);
      expect(cached(objectKey)).toBeUndefined();
      expect(cached(kept)).toBeDefined();
   });

   it("keeps the view of an object whose rename failed", () => {
      watch(objectKey);
      const input = { ...target, objectKey, newObjectKey };
      const mutation = useRenameObject() as unknown as Mutation<
         typeof input,
         void
      >;
      mutation.onSettled(undefined, new Error("Changed"), input);
      expect(cached(objectKey)).toBeDefined();
      mutation.onSettled(undefined, null, input);
      expect(cached(objectKey)).toBeUndefined();
   });
});
