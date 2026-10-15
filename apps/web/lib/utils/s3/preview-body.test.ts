import { describe, expect, it, vi } from "vitest";
import {
   changedETag,
   PreviewTooLargeError,
   readPreviewText,
} from "./preview-body";

describe("ETag comparison", () => {
   it.each([
      ['"one"', '"one"'],
      ['"one"', 'W/"one"'],
      ['W/"one"', '"one"'],
      ['"one"', "one"],
   ])("treats %s and %s as the same object", (reviewed, served) => {
      expect(changedETag(reviewed, served)).toBe(false);
   });

   it.each([
      ['"one"', '"two"'],
      ['"one"', 'W/"two"'],
      ['"one-2"', '"one"'],
   ])("treats %s and %s as a change", (reviewed, served) => {
      expect(changedETag(reviewed, served)).toBe(true);
   });

   it.each([
      [null, '"one"'],
      ['"one"', null],
      ["", '"one"'],
   ])("skips the check when a side is missing (%s, %s)", (reviewed, served) => {
      expect(changedETag(reviewed, served)).toBe(false);
   });
});

const streamed = (
   chunks: Uint8Array[],
   headers: Record<string, string> = {}
) => {
   const cancel = vi.fn();
   const pull = vi.fn(
      (controller: ReadableStreamDefaultController<Uint8Array>) => {
         const chunk = chunks.shift();
         if (chunk) controller.enqueue(chunk);
         else controller.close();
      }
   );
   const body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
   return { response: new Response(body, { headers }), cancel, pull };
};

describe("bounded decoded JSON preview reads", () => {
   it("decodes split UTF-8 sequences and accepts exactly the limit", async () => {
      const bytes = new TextEncoder().encode('{"name":"é"}');
      const { response } = streamed([bytes.slice(0, 10), bytes.slice(10)]);
      await expect(readPreviewText(response, bytes.length)).resolves.toBe(
         '{"name":"é"}'
      );
   });

   it.each<Record<string, string>>([{}, { "content-length": "1" }])(
      "cancels at the decoded limit with headers %j",
      async (headers) => {
         const stream = streamed(
            [new Uint8Array(8), new Uint8Array(8), new Uint8Array(8)],
            headers
         );
         await expect(
            readPreviewText(stream.response, 10)
         ).rejects.toBeInstanceOf(PreviewTooLargeError);
         expect(stream.cancel).toHaveBeenCalledOnce();
         expect(stream.pull).toHaveBeenCalledTimes(2);
         expect(stream.response.body?.locked).toBe(false);
      }
   );

   it("cancels an oversized Content-Length without reading a chunk", async () => {
      const stream = streamed([new Uint8Array(8)], { "content-length": "20" });
      await expect(readPreviewText(stream.response, 10)).rejects.toBeInstanceOf(
         PreviewTooLargeError
      );
      expect(stream.pull).not.toHaveBeenCalled();
      expect(stream.cancel).toHaveBeenCalledOnce();
   });

   it("releases the reader after a failed transport", async () => {
      const failure = new Error("Disconnected");
      const response = new Response(
         new ReadableStream({
            pull: () => {
               throw failure;
            },
         })
      );
      await expect(readPreviewText(response, 10)).rejects.toBe(failure);
      expect(response.body?.locked).toBe(false);
   });
});
