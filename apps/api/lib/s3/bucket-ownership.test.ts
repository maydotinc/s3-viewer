import { afterEach, describe, expect, it, vi } from "vitest";
import {
   AWS_ENDPOINT,
   errorXml,
   reply,
   s3Fixture,
} from "@/lib/testing/s3-fixture";
import { destinationAcceptsAcl } from "./bucket-ownership";
import { withoutRetries } from "./no-retry";

type Reply = { status: number; body: string };

const controls = (ownership: string): Reply => ({
   status: 200,
   body: `<OwnershipControls><Rule><ObjectOwnership>${ownership}</ObjectOwnership></Rule></OwnershipControls>`,
});
const failure = (status: number, code: string): Reply => ({
   status,
   body: errorXml(code),
});

const fixture = (answer: (bucket: string) => Reply) => {
   const asked: string[] = [];
   const { client } = s3Fixture(
      async (request) => {
         const bucket = request.path.split("/")[1]!;
         asked.push(bucket);
         const { status, body } = answer(bucket);
         return reply(status, body);
      },
      { endpoint: AWS_ENDPOINT }
   );
   return { asked, client };
};

afterEach(() => {
   vi.useRealTimers();
});

describe("remembering a bucket's ownership setting", () => {
   it("asks once per bucket for a batch of copies and again after ten seconds", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      let ownership = "BucketOwnerEnforced";
      const { asked, client } = fixture(() => controls(ownership));
      try {
         const scope = { client: withoutRetries(client), bucket: "archive" };
         expect(await destinationAcceptsAcl(scope)).toBe(false);
         ownership = "ObjectWriter";
         expect(await destinationAcceptsAcl(scope)).toBe(false);
         expect(
            await destinationAcceptsAcl({ ...scope, bucket: "other" })
         ).toBe(true);
         expect(asked).toEqual(["archive", "other"]);
         vi.advanceTimersByTime(10_000);
         expect(await destinationAcceptsAcl(scope)).toBe(true);
         expect(asked).toEqual(["archive", "other", "archive"]);
      } finally {
         client.destroy();
      }
   });

   it.each([
      [
         "missing controls",
         failure(404, "OwnershipControlsNotFoundError"),
         true,
      ],
      ["a denied read", failure(403, "AccessDenied"), false],
   ])("remembers the answer drawn from %s", async (_name, reply, accepts) => {
      const { asked, client } = fixture(() => reply);
      try {
         const scope = { client, bucket: "archive" };
         expect(await destinationAcceptsAcl(scope)).toBe(accepts);
         expect(await destinationAcceptsAcl(scope)).toBe(accepts);
         expect(asked).toHaveLength(1);
      } finally {
         client.destroy();
      }
   });

   it("does not remember a failed read or share answers between clients", async () => {
      let failing = true;
      const { asked, client } = fixture(() =>
         failing ? failure(500, "InternalError") : controls("ObjectWriter")
      );
      const other = fixture(() => controls("BucketOwnerEnforced"));
      try {
         const scope = { client, bucket: "archive" };
         await expect(destinationAcceptsAcl(scope)).rejects.toMatchObject({
            status: 502,
         });
         failing = false;
         expect(await destinationAcceptsAcl(scope)).toBe(true);
         expect(asked).toHaveLength(2);
         expect(
            await destinationAcceptsAcl({
               client: other.client,
               bucket: "archive",
            })
         ).toBe(false);
         expect(other.asked).toHaveLength(1);
      } finally {
         client.destroy();
         other.client.destroy();
      }
   });
});
