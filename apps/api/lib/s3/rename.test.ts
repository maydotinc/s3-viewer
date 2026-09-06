import {
   CopyObjectCommand,
   DeleteObjectCommand,
   HeadObjectCommand,
   S3ServiceException,
   type S3Client,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { describe, expect, it, vi } from "vitest";
import { renameObject } from "./rename";

const error = (name: string, code: number) =>
   new S3ServiceException({
      name,
      message: name,
      $fault: "client",
      $metadata: { httpStatusCode: code },
   });
const fixture = (
   options: {
      beforeCopy?: (objects: Map<string, string>) => void;
      afterCopy?: (objects: Map<string, string>) => void;
      deleteError?: boolean;
      timeoutAfterDelete?: boolean;
      noETag?: boolean;
   } = {}
) => {
   const objects = new Map([["old.txt", "original"]]);
   const send = vi.fn(
      async (
         command: HeadObjectCommand | CopyObjectCommand | DeleteObjectCommand
      ) => {
         const key = command.input.Key ?? "";
         if (command instanceof HeadObjectCommand) {
            if (!objects.has(key)) throw error("NotFound", 404);
            return {
               ContentLength: 8,
               ...(options.noETag ? {} : { ETag: objects.get(key) }),
            };
         }
         if (command instanceof CopyObjectCommand) {
            options.beforeCopy?.(objects);
            if (
               command.input.CopySourceIfMatch !== objects.get("old.txt") ||
               (command.input.IfNoneMatch === "*" && objects.has(key))
            )
               throw error("PreconditionFailed", 412);
            objects.set(key, objects.get("old.txt")!);
            options.afterCopy?.(objects);
            return { CopyObjectResult: { ETag: "original" } };
         }
         if (command instanceof DeleteObjectCommand) {
            if (command.input.IfMatch !== objects.get(key))
               throw error("PreconditionFailed", 412);
            if (options.deleteError) throw error("AccessDenied", 403);
            objects.delete(key);
            if (options.timeoutAfterDelete) throw error("TimeoutError", 500);
            return {};
         }
         throw new Error("Unexpected S3 request");
      }
   );
   const client = { send } as unknown as S3Client;
   const run = (provider = Provider.S3) =>
      renameObject(
         { client, bucket: "bucket", signal: new AbortController().signal },
         provider,
         "old.txt",
         "new.txt"
      );
   return { objects, send, run };
};

describe("safe rename", () => {
   it("renames an unchanged source", async () => {
      const f = fixture();
      await f.run();
      expect([...f.objects]).toEqual([["new.txt", "original"]]);
   });
   it("refuses a source changed between HEAD and copy", async () => {
      const f = fixture({
         beforeCopy: (objects) => objects.set("old.txt", "new contents"),
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect([...f.objects]).toEqual([["old.txt", "new contents"]]);
   });
   it("preserves a source changed between copy and delete", async () => {
      const f = fixture({
         afterCopy: (objects) => objects.set("old.txt", "new contents"),
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.objects.get("old.txt")).toBe("new contents");
      expect(f.objects.get("new.txt")).toBe("original");
   });
   it("never rolls back a destination another writer changed", async () => {
      const f = fixture({
         deleteError: true,
         afterCopy: (objects) => objects.set("new.txt", "another writer"),
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.objects.get("new.txt")).toBe("another writer");
      expect(f.objects.get("old.txt")).toBe("original");
      expect(
         f.send.mock.calls.filter(
            ([command]) => command instanceof DeleteObjectCommand
         )
      ).toHaveLength(1);
   });
   it("does not overwrite a destination created concurrently", async () => {
      const f = fixture({
         beforeCopy: (objects) => objects.set("new.txt", "someone else's file"),
      });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.objects.get("new.txt")).toBe("someone else's file");
      expect(f.objects.get("old.txt")).toBe("original");
   });
   it("recognizes a timed-out delete that actually succeeded", async () => {
      const f = fixture({ timeoutAfterDelete: true });
      await expect(f.run()).resolves.toBeUndefined();
      expect([...f.objects]).toEqual([["new.txt", "original"]]);
   });
   it("rejects an unsupported provider before making any S3 request", async () => {
      const f = fixture();
      await expect(f.run(Provider.R2)).rejects.toMatchObject({ status: 409 });
      await expect(f.run(Provider.Other)).rejects.toMatchObject({
         status: 409,
      });
      expect(f.send).not.toHaveBeenCalled();
   });
   it("refuses to mutate an object without an ETag", async () => {
      const f = fixture({ noETag: true });
      await expect(f.run()).rejects.toMatchObject({ status: 409 });
      expect(f.send).toHaveBeenCalledTimes(1);
   });
});
