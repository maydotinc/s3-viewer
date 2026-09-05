import { describe, expect, it } from "vitest";
import {
   contentDispositionFilename,
   encodeCopySource,
   inlineContentType,
   inlineDisposition,
} from "./keys";

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

describe("inlineContentType", () => {
   it("serves html as plain text, parameters and casing included", () => {
      for (const stored of [
         "text/html",
         "TEXT/HTML",
         "text/html; charset=utf-8",
         "application/xhtml+xml",
         "text/xml",
         "application/xml; charset=utf-8",
      ]) {
         expect(inlineContentType(stored), stored).toBe("text/plain");
      }
   });

   it("leaves every other stored type alone", () => {
      for (const stored of [
         "image/svg+xml",
         "application/json",
         "text/plain; charset=utf-8",
         "video/mp4",
      ]) {
         expect(inlineContentType(stored), stored).toBe(stored);
      }
   });
});

describe("inlineDisposition", () => {
   it("downloads svg when opened directly and shows everything else inline", () => {
      expect(inlineDisposition("image/svg+xml; charset=utf-8")).toBe(
         "attachment"
      );
      expect(inlineDisposition("image/png")).toBe("inline");
      expect(inlineDisposition("text/html")).toBe("inline");
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

   it("strips control characters out of the RFC 5987 value too, not just the quoted one", () => {
      const withControlChars = "evil\x00\x01\x1b\x7f\r\nname.txt";
      const result = contentDispositionFilename(withControlChars);
      expect(result).toBe(
         `attachment; filename="evilname.txt"; filename*=UTF-8''evilname.txt`
      );
      // eslint-disable-next-line no-control-regex
      expect(/[\x00-\x1f\x7f]/.test(result)).toBe(false);
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
