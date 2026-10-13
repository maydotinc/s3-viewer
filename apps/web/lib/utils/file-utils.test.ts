import { describe, expect, it } from "vitest";
import { archiveLabel, previewKind } from "./file-utils";

describe("archives", () => {
   it.each([
      ["application/zip", "kit.zip", "ZIP archive"],
      ["application/x-zip-compressed", "kit.zip", "ZIP archive"],
      ["application/gzip", "logs.tar.gz", "Gzipped TAR archive"],
      ["application/gzip", "logs.gz", "Gzip archive"],
      ["application/x-7z-compressed", "kit", "7-Zip archive"],
      ["application/octet-stream", "kit.zip", "ZIP archive"],
      ["binary/octet-stream", "kit.tgz", "Gzipped TAR archive"],
      ["", "kit.rar", "RAR archive"],
   ])("labels %s %s as %s", (contentType, fileName, label) => {
      expect(archiveLabel(contentType, fileName)).toBe(label);
      expect(previewKind(contentType, fileName)).toBe("archive");
   });

   it("trusts a specific content type over an archive-looking name", () => {
      expect(archiveLabel("image/png", "shot.zip")).toBeNull();
      expect(previewKind("image/png", "shot.zip")).toBe("image");
   });

   it("leaves unknown binaries without a preview", () => {
      expect(archiveLabel("application/octet-stream", "blob")).toBeNull();
      expect(previewKind("application/octet-stream", "blob")).toBe("none");
   });
});

describe("markdown", () => {
   it.each([
      ["text/markdown", "README", "markdown"],
      ["text/x-markdown; charset=utf-8", "notes.txt", "markdown"],
      ["application/octet-stream", "README.md", "markdown"],
      ["text/plain", "guide.markdown", "markdown"],
      ["text/plain", "notes.txt", "text"],
      ["image/png", "shot.md", "image"],
   ])("previews %s %s as %s", (contentType, fileName, kind) => {
      expect(previewKind(contentType, fileName)).toBe(kind);
   });
});
