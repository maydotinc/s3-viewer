import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import type { S3DeleteResult, S3DeleteTarget } from "@s3-viewer/types";

const h = vi.hoisted(() => ({
   slots: [] as unknown[],
   cursor: 0,
   get: vi.fn(),
   remove: vi.fn(),
   pending: [] as Promise<unknown>[],
}));

vi.mock("react", async (original) => ({
   ...(await original<typeof React>()),
   useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.slots)) h.slots[index] = initial;
      return [
         h.slots[index],
         (value: unknown) => {
            h.slots[index] = value;
         },
      ];
   },
   useRef: (current: unknown) => {
      const index = h.cursor++;
      return (h.slots[index] ??= { current });
   },
   useEffect: () => undefined,
}));
vi.mock("@/components/Modals/confirm-dialog", () => ({
   ConfirmDialog: () => null,
}));
vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: vi.fn(), error: vi.fn() },
}));
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
vi.mock("@/lib/api", () => ({
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
   }>;
};
const confirm = async (objects: S3DeleteTarget[], onClose: () => void) => {
   renderModal(objects, onClose).props.onConfirm();
   await Promise.all(h.pending);
};

beforeEach(() => {
   vi.clearAllMocks();
   h.slots = [];
   h.cursor = 0;
   h.pending = [];
   vi.stubGlobal("React", React);
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
afterEach(() => vi.unstubAllGlobals());

describe("delete confirmation retry accounting", () => {
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

   it("retries the original folder targets without relisting or adopting replacements", async () => {
      const folder = [{ key: "folder/", expectedETag: null }];
      h.get.mockResolvedValue({ objects: reviewed, nextToken: null });
      const onClose = vi.fn();
      await confirm(folder, onClose);
      await confirm(folder, onClose);
      expect(h.get).toHaveBeenCalledTimes(1);
      expect(
         h.remove.mock.calls.map(([, input]) => input.objects.length)
      ).toEqual([150, 150]);
      expect(h.remove.mock.calls[1]?.[1].objects).toMatchObject(reviewed);
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

   it("keeps incomplete folder enumeration visible after retrying known failures", async () => {
      const folder = [{ key: "folder/", expectedETag: null }];
      h.get
         .mockResolvedValueOnce({ objects: reviewed, nextToken: "next" })
         .mockRejectedValueOnce(new Error("Listing failed"));
      const onClose = vi.fn();
      await confirm(folder, onClose);
      await confirm(folder, onClose);
      const view = renderModal(folder, onClose);
      expect(view.props.error).toContain("Folder deletion is incomplete");
      expect(view.props.confirmDisabled).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(h.get).toHaveBeenCalledTimes(2);
   });
});
