import { beforeEach, describe, expect, it, vi } from "vitest";

type MutationOptions = {
   mutationFn: (input: unknown) => Promise<unknown>;
   onMutate: (input: unknown) => { toastId: number };
   onSuccess: (
      result: { token: string },
      input: { serverId: string; bucketName: string },
      context: { toastId: number } | undefined
   ) => void;
   onError: (
      error: unknown,
      input: unknown,
      context: { toastId: number } | undefined
   ) => void;
};

const h = vi.hoisted(() => ({
   options: null as unknown,
   post: vi.fn(),
   open: vi.fn(),
   loading: vi.fn(() => 7),
   dismiss: vi.fn(),
   error: vi.fn(),
   aborted: false,
}));

vi.mock("@tanstack/react-query", () => ({
   useMutation: (options: unknown) => {
      h.options = options;
      return { mutate: vi.fn(), isPending: false };
   },
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { loading: h.loading, dismiss: h.dismiss, error: h.error },
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   isAborted: () => h.aborted,
}));
vi.mock("@/lib/utils/s3/archive", () => ({
   requestArchive: h.post,
   archiveUrl: (serverId: string, bucketName: string, token: string) =>
      `https://api.test/${serverId}/${bucketName}/${token}`,
}));
vi.mock("@/lib/utils/download", () => ({ downloadUrl: h.open }));

import { ApiError } from "@/lib/api";
import useArchiveDownload, { ARCHIVE_MUTATION_KEY } from "./useArchiveDownload";

const useOptions = (): MutationOptions => {
   useArchiveDownload();
   return h.options as MutationOptions;
};

const input = {
   userId: "user1",
   serverId: "server1",
   bucketName: "bucket",
   objectKeys: ["photos/"],
};

beforeEach(() => {
   vi.clearAllMocks();
   h.aborted = false;
   h.post.mockResolvedValue({ token: "tok" });
   h.loading.mockReturnValue(7);
});

describe("useArchiveDownload", () => {
   it("asks the api for a ticket before navigating anywhere", async () => {
      await useOptions().mutationFn(input);
      expect(h.post).toHaveBeenCalledWith(
         "server1",
         "bucket",
         "user1",
         ["photos/"],
         undefined
      );
      expect(h.open).not.toHaveBeenCalled();
   });

   it("shares one mutation key so every caller can see a ticket in flight", () => {
      expect(useOptions()).toMatchObject({
         mutationKey: ARCHIVE_MUTATION_KEY,
      });
   });

   it("shows the preparing toast while the ticket is issued", () => {
      expect(useOptions().onMutate(input)).toEqual({ toastId: 7 });
      expect(h.loading).toHaveBeenCalledWith("Preparing zip…");
   });

   it("navigates to the token url and clears the toast", () => {
      useOptions().onSuccess({ token: "tok" }, input, { toastId: 7 });
      expect(h.dismiss).toHaveBeenCalledWith(7);
      expect(h.open).toHaveBeenCalledWith(
         "https://api.test/server1/bucket/tok"
      );
   });

   it("surfaces the post's error instead of opening a download", () => {
      useOptions().onError(new Error("Too many objects"), input, {
         toastId: 7,
      });
      expect(h.dismiss).toHaveBeenCalledWith(7);
      expect(h.open).not.toHaveBeenCalled();
      expect(h.error).toHaveBeenCalledWith("Couldn't prepare the zip", {
         description: "Too many objects",
      });
   });

   it("says so when the selection expands to nothing", () => {
      useOptions().onError(new ApiError(404, "No objects"), input, {
         toastId: 7,
      });
      expect(h.error).toHaveBeenCalledWith("Nothing to download", {
         description: "There are no objects under this selection.",
      });
   });

   it("stays quiet when the request was cancelled", () => {
      h.aborted = true;
      useOptions().onError(new Error("Request cancelled"), input, {
         toastId: 7,
      });
      expect(h.dismiss).toHaveBeenCalledWith(7);
      expect(h.error).not.toHaveBeenCalled();
   });

   it("never dismisses every toast when no context was captured", () => {
      useOptions().onError(new Error("boom"), input, undefined);
      expect(h.dismiss).not.toHaveBeenCalled();
   });
});
