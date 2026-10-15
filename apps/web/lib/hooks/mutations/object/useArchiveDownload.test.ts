import { beforeEach, describe, expect, it, vi } from "vitest";

type MutationOptions = {
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
   open: vi.fn(),
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
   toast: { dismiss: h.dismiss, error: h.error },
}));
vi.mock("@/lib/api", async (original) => ({
   ...(await original<typeof import("@/lib/api")>()),
   isAborted: () => h.aborted,
}));
vi.mock("@/lib/utils/s3/archive", () => ({
   requestArchive: vi.fn(),
   archiveUrl: (serverId: string, bucketName: string, token: string) =>
      `https://api.test/${serverId}/${bucketName}/${token}`,
}));
vi.mock("@/lib/utils/download", () => ({ downloadUrl: h.open }));

import { ApiError } from "@/lib/api";
import useArchiveDownload from "./useArchiveDownload";

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
});

describe("useArchiveDownload", () => {
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
