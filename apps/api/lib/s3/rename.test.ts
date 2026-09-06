import { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { renameObject } from "./rename";

const endpoints = [
   "https://s3.us-east-1.amazonaws.com",
   "https://account.r2.cloudflarestorage.com",
   "https://s3.us-west-004.backblazeb2.com",
   "https://minio.example.com",
];

describe("rename refuses unsafe copy/delete operations", () => {
   it.each(endpoints)(
      "leaves both filenames and their permissions untouched on %s",
      async (endpoint) => {
         const objects = new Map([
            ["old.txt", { data: "original", access: "private" }],
            ["new.txt", { data: "another writer's data", access: "private" }],
         ]);
         const before = structuredClone(objects);
         const handle = vi.fn(async () => {
            // The old production copy/delete path could reach a transport that
            // deletes the destination after verification, losing both copies.
            // No storage request should reach that race window now.
            objects.clear();
            throw new Error("Unsafe storage call");
         });
         const client = new S3Client({
            endpoint,
            region: "us-east-1",
            credentials: { accessKeyId: "test", secretAccessKey: "test" },
            requestHandler: { handle },
         });
         try {
            await expect(
               renameObject(
                  { client, bucket: "bucket" },
                  "old.txt",
                  "new.txt",
                  '"reviewed"'
               )
            ).rejects.toMatchObject({
               status: 409,
               message: expect.stringContaining("No objects were changed"),
            });
            expect(handle).not.toHaveBeenCalled();
            expect(objects).toEqual(before);
         } finally {
            client.destroy();
         }
      }
   );
});
