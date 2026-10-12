import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ userId: "user1" }));

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("@/lib/stores/session-store", () => ({
   default: Object.assign(() => "server1", {
      getState: () => ({ userId: h.userId }),
   }),
   useUserId: () => h.userId,
}));

import { ApiError, ClientErrorCode, setUnauthorizedHandler } from "@/lib/api";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
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

beforeEach(() => {
   vi.clearAllMocks();
   h.userId = "user1";
});
afterEach(() => vi.unstubAllGlobals());

describe("reading an object into the editor", () => {
   it("returns the body and the version it was read at", async () => {
      respond("line one\nline two");
      await expect(read()).resolves.toEqual({
         text: "line one\nline two",
         eTag: '"v1"',
      });
   });

   it("keeps every byte of a multibyte file", async () => {
      respond("héllo — ok\n");
      await expect(read()).resolves.toMatchObject({ text: "héllo — ok\n" });
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

   it("refuses a lone continuation byte", async () => {
      respond(new Uint8Array([0x61, 0x80, 0x62]));
      await expect(read()).rejects.toThrow(NOT_TEXT_MESSAGE);
   });

   it("reports a cancelled read as cancelled, not as a network failure", async () => {
      vi.stubGlobal(
         "fetch",
         vi.fn(async () => {
            throw new DOMException("Aborted", "AbortError");
         })
      );
      await expect(read()).rejects.toMatchObject({
         code: ClientErrorCode.ABORTED,
      });
   });
});

describe("a refused read", () => {
   const refuse = (status: number, body: string) =>
      vi.stubGlobal(
         "fetch",
         vi.fn(async () => new Response(body, { status }))
      );

   it("signs the reader out when their session has ended", async () => {
      const signedOut = vi.fn();
      setUnauthorizedHandler(signedOut);
      refuse(401, JSON.stringify({ message: "Sign in to continue" }));
      const error = await read().catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
         status: 401,
         message: "Sign in to continue",
      });
      expect(signedOut).toHaveBeenCalledOnce();
   });

   it("leaves a newer account signed in", async () => {
      const signedOut = vi.fn();
      setUnauthorizedHandler(signedOut);
      vi.stubGlobal(
         "fetch",
         vi.fn(async () => {
            h.userId = "user2";
            return new Response("{}", { status: 401 });
         })
      );
      await expect(read()).rejects.toMatchObject({ status: 401 });
      expect(signedOut).not.toHaveBeenCalled();
   });

   it("keeps the API's code and falls back to a generic message", async () => {
      refuse(412, JSON.stringify({ message: "Changed", code: "STALE" }));
      await expect(read()).rejects.toMatchObject({
         status: 412,
         message: "Changed",
         code: "STALE",
      });
      refuse(502, "<html>Bad gateway</html>");
      await expect(read()).rejects.toMatchObject({
         status: 502,
         message: GENERIC_ERROR_MESSAGE,
      });
   });
});
