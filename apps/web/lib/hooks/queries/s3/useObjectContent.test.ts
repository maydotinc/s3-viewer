import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stores/session-store", () => ({
   default: Object.assign(() => "server1", {
      getState: () => ({ userId: "user1" }),
   }),
   useUserId: () => "user1",
}));

import { readObjectContent } from "./useObjectContent";

const NOT_TEXT_MESSAGE =
   "This file isn't UTF-8 text, so it can't be edited here.";

const respond = (body: BodyInit, eTag = '"v1"') =>
   vi.stubGlobal(
      "fetch",
      vi.fn(
         async () =>
            new Response(body, {
               status: 200,
               headers: { ETag: eTag, "Content-Type": "text/plain" },
            })
      )
   );

const read = () => readObjectContent("server1", "bucket", "notes.txt");

afterEach(() => vi.unstubAllGlobals());

describe("reading an object into the editor", () => {
   it("returns the body and the version it was read at", async () => {
      respond("line one\nline two");
      await expect(read()).resolves.toEqual({
         text: "line one\nline two",
         eTag: '"v1"',
      });
   });

   it("keeps a byte-order mark so saving writes it back", async () => {
      respond(new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62]));
      const { text } = await read();
      expect([...new TextEncoder().encode(text)]).toEqual([
         0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62,
      ]);
   });

   it("refuses a file that is not utf-8 instead of mangling it", async () => {
      respond(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00, 0x80]));
      await expect(read()).rejects.toThrow(NOT_TEXT_MESSAGE);
   });
});
