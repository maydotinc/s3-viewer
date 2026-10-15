import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import type { S3DeleteResult, S3DeleteTarget } from "@s3-viewer/types";

const h = vi.hoisted(() => ({
   slots: [] as unknown[],
   cursor: 0,
   get: vi.fn(),
   remove: vi.fn(),
   pending: [] as Promise<unknown>[],
   provider: "S3",
}));

vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [
         h.slots[index],
         (value: unknown) => {
            h.slots[index] =
               typeof value === "function"
                  ? (value as (previous: unknown) => unknown)(h.slots[index])
                  : value;
         },
      ];
   },
   useRef: (current: unknown) => {
      const index = h.cursor++;
      return (h.slots[index] ??= { current });
   },
   useMemo: (factory: () => unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = factory();
      return h.slots[index];
   },
   useEffect: () => undefined,
}));
vi.mock("@/lib/hooks/useBeforeUnload", () => ({ useBeforeUnload: vi.fn() }));
vi.mock("@/components/Modals/confirm-dialog", () => ({
   ConfirmDialog: () => null,
}));
vi.mock("@/lib/hooks/queries/server/useServers", () => ({
   default: () => ({ servers: [{ id: "server123", provider: h.provider }] }),
}));
vi.mock("@s3-viewer/ui/components/toast", async () =>
   (await import("@/components/test-helpers")).toastMock()
);
vi.mock("@tanstack/react-query", () => ({
   useQueryClient: () => ({}),
   useMutation: (options: {
      mutationFn: (input: unknown) => Promise<unknown>;
   }) => ({
      isPending: false,
      mutate: (
         input: unknown,
         callbacks: { onSuccess: (result: unknown) => void }
      ) => {
         h.pending.push(options.mutationFn(input).then(callbacks.onSuccess));
      },
   }),
}));
vi.mock("@/lib/api", async (original) => ({
   ApiError: (await original<typeof import("@/lib/api")>()).ApiError,
   api: { delete: h.remove, get: h.get },
   objectsPath: () => "/objects",
   qs: () => "",
   cancelledError: () => new Error("cancelled"),
   isAborted: () => false,
   errorMessage: String,
}));

import Modal from "./index";

const reviewed = Array.from({ length: 150 }, (_, index) => ({
   key: `folder/secret-${index}.txt`,
   expectedETag: `"reviewed-${index}"`,
}));
const renderModal = (objects: S3DeleteTarget[], onClose: () => void) => {
   h.cursor = 0;
   return Modal({
      userId: "user12345",
      serverId: "server123",
      bucketName: "bucket",
      objects,
      onClose,
   }) as React.ReactElement<{
      onConfirm: () => void;
      confirmLabel: string;
      confirmDisabled: boolean;
      error: string | null;
      description: string;
   }>;
};
const confirm = async (objects: S3DeleteTarget[], onClose: () => void) => {
   renderModal(objects, onClose).props.onConfirm();
   await Promise.all(h.pending);
};

beforeEach(() => {
   vi.clearAllMocks();
   h.get.mockReset();
   h.remove.mockReset();
   h.slots = [];
   h.cursor = 0;
   h.pending = [];
   h.provider = "S3";
   h.remove
      .mockImplementationOnce(
         async (
            _path,
            input: { objects: S3DeleteTarget[] }
         ): Promise<S3DeleteResult> => ({
            deleted: [],
            failed: input.objects.map(({ key }) => ({
               key,
               message: "Access denied",
               retryable: true,
            })),
         })
      )
      .mockImplementation(
         async (
            _path,
            input: { objects: S3DeleteTarget[] }
         ): Promise<S3DeleteResult> => ({
            deleted: input.objects.map(({ key }) => key),
            failed: [],
         })
      );
});
afterEach(() => {
   vi.useRealTimers();
});

describe("delete confirmation retry accounting", () => {
   it("enables R2 deletion with explicit key-deletion limits", () => {
      h.provider = "R2";
      const view = renderModal(reviewed.slice(0, 2), vi.fn());
      expect(view.props.confirmDisabled).toBe(false);
      expect(view.props.confirmLabel).toBe("Delete");
      expect(view.props.description).toContain("R2 deletes are permanent");
      expect(view.props.description).not.toContain("versioning");
   });

   it("retries all 150 failures before closing the dialog", async () => {
      const onClose = vi.fn();
      await confirm(reviewed, onClose);
      expect(onClose).not.toHaveBeenCalled();
      expect(renderModal(reviewed, onClose).props.confirmLabel).toBe("Retry");
      await confirm(reviewed, onClose);
      expect(
         h.remove.mock.calls.map(([, input]) => input.objects.length)
      ).toEqual([150, 150]);
      expect(h.remove.mock.calls[1]?.[1].objects).toMatchObject(reviewed);
      expect(onClose).toHaveBeenCalledOnce();
   });

   it("resumes a folder deletion by relisting what storage still holds", async () => {
      const folder = [{ key: "folder/", expectedETag: null }];
      h.get.mockResolvedValue({ objects: reviewed, nextToken: null });
      const onClose = vi.fn();
      await confirm(folder, onClose);
      expect(renderModal(folder, onClose).props.confirmLabel).toBe(
         "Continue deleting"
      );
      await confirm(folder, onClose);
      expect(h.get).toHaveBeenCalledTimes(2);
      expect(
         h.remove.mock.calls.map(([, input]) => input.objects.length)
      ).toEqual([150, 150]);
      expect(h.remove.mock.calls[1]?.[1].objects).toMatchObject(reviewed);
      expect(onClose).toHaveBeenCalledOnce();
   });

   it("keeps deleted progress when a batch keeps failing and totals it across the resume", async () => {
      vi.useFakeTimers();
      const folder = [{ key: "folder/", expectedETag: null }];
      const succeed = async (
         _path: string,
         input: { objects: S3DeleteTarget[] }
      ): Promise<S3DeleteResult> => ({
         deleted: input.objects.map(({ key }) => key),
         failed: [],
      });
      h.get
         .mockResolvedValueOnce({
            objects: reviewed.slice(0, 100),
            nextToken: "n2",
         })
         .mockResolvedValue({ objects: reviewed.slice(100), nextToken: null });
      const refuse = async (
         _path: string,
         input: { objects: S3DeleteTarget[] }
      ): Promise<S3DeleteResult> => ({
         deleted: [],
         failed: input.objects.map(({ key }) => ({
            key,
            message: "Access denied",
            retryable: true,
         })),
      });
      h.remove
         .mockReset()
         .mockImplementationOnce(succeed)
         .mockImplementation(refuse);
      const onClose = vi.fn();
      renderModal(folder, onClose).props.onConfirm();
      await vi.runAllTimersAsync();
      await Promise.all(h.pending);
      const view = renderModal(folder, onClose);
      expect(view.props.error).toContain("Deleted 100 of this folder");
      expect(view.props.error).toContain("50 failed");
      expect(view.props.confirmLabel).toBe("Continue deleting");
      expect(onClose).not.toHaveBeenCalled();
      expect(
         h.remove.mock.calls.map(([, input]) => input.objects.length)
      ).toEqual([100, 50]);
      h.remove.mockImplementation(succeed);
      renderModal(folder, onClose).props.onConfirm();
      await vi.runAllTimersAsync();
      await Promise.all(h.pending);
      expect(h.get).toHaveBeenCalledTimes(3);
      expect(h.remove.mock.calls.at(-1)?.[1].objects).toHaveLength(50);
      expect(h.remove).toHaveBeenCalledTimes(3);
      expect(onClose).toHaveBeenCalledOnce();
   });

   it("finishes a folder without a manual resume once a refused page goes through", async () => {
      vi.useFakeTimers();
      const folder = [{ key: "folder/", expectedETag: null }];
      h.get
         .mockResolvedValueOnce({
            objects: reviewed.slice(0, 100),
            nextToken: "n2",
         })
         .mockResolvedValue({ objects: reviewed.slice(100), nextToken: null });
      const succeed = async (
         _path: string,
         input: { objects: S3DeleteTarget[] }
      ): Promise<S3DeleteResult> => ({
         deleted: input.objects.map(({ key }) => key),
         failed: [],
      });
      h.remove
         .mockReset()
         .mockImplementationOnce(succeed)
         .mockImplementationOnce(
            async (
               _path,
               input: { objects: S3DeleteTarget[] }
            ): Promise<S3DeleteResult> => ({
               deleted: [],
               failed: input.objects.map(({ key }) => ({
                  key,
                  message: "Too many storage requests.",
                  retryable: true,
                  refused: true,
               })),
            })
         )
         .mockImplementation(succeed);
      const onClose = vi.fn();
      renderModal(folder, onClose).props.onConfirm();
      await vi.runAllTimersAsync();
      await Promise.all(h.pending);
      expect(
         h.remove.mock.calls.map(([, input]) => input.objects.length)
      ).toEqual([100, 50, 50]);
      expect(h.get).toHaveBeenCalledTimes(2);
      expect(onClose).toHaveBeenCalledOnce();
   });

   it("does not replay a deletion after its HTTP response is lost", async () => {
      h.remove.mockReset().mockRejectedValueOnce(new Error("Response lost"));
      const onClose = vi.fn();
      await confirm(reviewed, onClose);
      expect(renderModal(reviewed, onClose).props.confirmDisabled).toBe(true);
      await confirm(reviewed, onClose);
      expect(h.remove).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
      expect(renderModal(reviewed, onClose).props.error).toContain(
         "reviewed again"
      );
   });

   it("retries confirmed failures while keeping uncertain outcomes visible", async () => {
      const targets = reviewed.slice(0, 2);
      h.remove
         .mockReset()
         .mockResolvedValueOnce({
            deleted: [],
            failed: [
               {
                  key: targets[0]!.key,
                  message: "Access denied",
                  retryable: true,
               },
               {
                  key: targets[1]!.key,
                  message: "Storage did not confirm deletion",
                  retryable: false,
               },
            ],
         })
         .mockImplementation(
            async (
               _path,
               input: { objects: S3DeleteTarget[] }
            ): Promise<S3DeleteResult> => ({
               deleted: input.objects.map(({ key }) => key),
               failed: [],
            })
         );
      const onClose = vi.fn();
      await confirm(targets, onClose);
      await confirm(targets, onClose);
      expect(h.remove.mock.calls[1]?.[1].objects).toEqual([targets[0]]);
      expect(renderModal(targets, onClose).props.confirmDisabled).toBe(true);
      expect(renderModal(targets, onClose).props.error).toContain(
         "reviewed again"
      );
      expect(onClose).not.toHaveBeenCalled();
   });

   it("stops at a failing batch and stays resumable while enumeration is incomplete", async () => {
      const folder = [{ key: "folder/", expectedETag: null }];
      h.get
         .mockResolvedValueOnce({ objects: reviewed, nextToken: "next" })
         .mockRejectedValueOnce(new Error("Listing failed"));
      const onClose = vi.fn();
      await confirm(folder, onClose);
      const stopped = renderModal(folder, onClose);
      expect(h.get).toHaveBeenCalledTimes(1);
      expect(stopped.props.error).toContain("more remain");
      expect(stopped.props.confirmLabel).toBe("Continue deleting");
      await confirm(folder, onClose);
      const view = renderModal(folder, onClose);
      expect(view.props.error).toContain("Folder deletion is incomplete");
      expect(view.props.confirmDisabled).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
      expect(h.get).toHaveBeenCalledTimes(2);
   });

   it("counts a failing last page as work remaining, not as a clean finish", async () => {
      const folder = [{ key: "folder/", expectedETag: null }];
      h.get.mockResolvedValue({ objects: reviewed, nextToken: null });
      const onClose = vi.fn();
      await confirm(folder, onClose);
      const view = renderModal(folder, onClose);
      expect(view.props.error).toContain("more remain");
      expect(view.props.confirmDisabled).toBe(false);
      expect(view.props.confirmLabel).toBe("Continue deleting");
      expect(onClose).not.toHaveBeenCalled();
   });

   it("blocks a folder resume once only unreviewable failures are left", async () => {
      const folder = [{ key: "folder/", expectedETag: null }];
      h.get.mockResolvedValue({ objects: reviewed, nextToken: null });
      h.remove.mockReset().mockRejectedValue(new Error("Response lost"));
      const onClose = vi.fn();
      await confirm(folder, onClose);
      const view = renderModal(folder, onClose);
      expect(view.props.confirmDisabled).toBe(true);
      expect(view.props.error).toContain("reviewed again");
      await confirm(folder, onClose);
      expect(h.get).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
   });
});

it("blocks folder continuation when any outcome needs review even alongside retryable failures", async () => {
   const folder = [{ key: "folder/", expectedETag: null }];
   h.get.mockResolvedValue({
      objects: reviewed.slice(0, 2),
      nextToken: "next",
   });
   h.remove.mockReset().mockResolvedValue({
      deleted: [],
      failed: [
         { key: reviewed[0]!.key, message: "Busy", retryable: true },
         {
            key: reviewed[1]!.key,
            message: "Unknown outcome",
            retryable: false,
         },
      ],
   });
   const onClose = vi.fn();
   await confirm(folder, onClose);
   expect(renderModal(folder, onClose).props.confirmDisabled).toBe(true);
   await confirm(folder, onClose);
   expect(h.remove).toHaveBeenCalledOnce();
});
