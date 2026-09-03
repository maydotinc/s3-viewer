import { describe, expect, it } from "vitest";
import { contentDispositionFilename, encodeCopySource } from "./keys";

describe("encodeCopySource", () => {
   it("encodes each segment but keeps the slashes", () => {
      expect(encodeCopySource("bkt", "a/b c/d+e.txt")).toBe(
         "bkt/a/b%20c/d%2Be.txt"
      );
      expect(encodeCopySource("bkt", "ünï/cødé?.txt")).toBe(
         "bkt/%C3%BCn%C3%AF/c%C3%B8d%C3%A9%3F.txt"
      );
      expect(encodeCopySource("bkt", "plain.txt")).toBe("bkt/plain.txt");
   });
});

describe("contentDispositionFilename", () => {
   it("uses the base name with an RFC 5987 form", () => {
      expect(contentDispositionFilename("docs/report.pdf")).toBe(
         `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`
      );
   });

   it("strips quotes, backslashes and control characters", () => {
      expect(contentDispositionFilename('a"b\\c d\r\n.txt')).toBe(
         `attachment; filename="abc d.txt"; filename*=UTF-8''abc%20d.txt`
      );
   });

   it("keeps unicode in filename* with an ASCII fallback", () => {
      expect(contentDispositionFilename("photos/été (1)*.jpg")).toBe(
         `attachment; filename="_t_ (1)*.jpg"; filename*=UTF-8''%C3%A9t%C3%A9%20%281%29%2A.jpg`
      );
   });

   it("falls back when nothing usable remains", () => {
      expect(contentDispositionFilename('"""')).toBe(
         `attachment; filename="download"; filename*=UTF-8''download`
      );
      expect(contentDispositionFilename("folder/")).toBe(
         `attachment; filename="folder"; filename*=UTF-8''folder`
      );
   });
});
