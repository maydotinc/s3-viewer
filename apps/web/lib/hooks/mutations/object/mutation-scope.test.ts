import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { S3DeleteResult, S3DeleteTarget } from "@s3-viewer/types";

const h = vi.hoisted(() => ({
   client: null as QueryClient | null,
   session: { userId: "other-user", serverId: "other-server" },
   get: vi.fn(),
   post: vi.fn(),
   delete: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (original) => ({
   ...(await original<typeof import("@tanstack/react-query")>()),
   useQueryClient: () => h.client,
   useMutation: (options: unknown) => options,
}));
vi.mock("@/lib/stores/sessionStore", () => ({
   default: (select: (state: typeof h.session) => unknown) => select(h.session),
   useUserId: () => h.session.userId,
}));
vi.mock("@/lib/api", () => ({
   api: { get: h.get, post: h.post, delete: h.delete },
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

import useDeleteObjects, { type DeleteSummary } from "./useDeleteObjects";
import useDeletePrefix from "./useDeletePrefix";
import useRenameObject from "./useRenameObject";

type Scope = { userId: string; serverId: string; bucketName: string };
type Mutation<Input, Result> = {
   mutationFn: (input: Input) => Promise<Result>;
   onSettled: (result: Result, error: null, input: Input) => void;
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
   queryKeys.objects(scope.userId, scope.serverId, scope.bucketName, "");

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

describe("destructive object mutations keep the confirmed target", () => {
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
      });
      expectOnlyOriginalCacheChanged();
      expect(
         h.client?.getQueryData(previewKey(target, input.newObjectKey))
      ).toBeUndefined();
      for (const scope of scopes.slice(1))
         expect(
            h.client?.getQueryData(previewKey(scope, input.newObjectKey))
         ).toBe("destination preview");
   });
});
