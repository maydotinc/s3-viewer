// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, mountedRuntime } from "@/components/test-helpers";
import type { S3ObjectPreview } from "@s3-viewer/types";
import MarkdownPreview from "./markdown-preview";

const h = vi.hoisted(() => ({ text: "" }));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({ bucketName: "bucket" }),
}));
vi.mock("./preview-message", () => ({ PreviewMessage: () => null }));
vi.mock("@/lib/hooks/queries/s3/useObjectBody", () => ({
   default: () => ({ data: h.text, isPending: false, isError: false }),
   ObjectBodyError: class extends Error {},
}));

const preview = {
   contentLength: 100,
   url: "https://storage.test/readme.md",
   eTag: '"one"',
   versionId: null,
   contentEncoding: null,
} as S3ObjectPreview;
const view = mountedRuntime(() => {
   vi.restoreAllMocks();
   vi.unstubAllGlobals();
});
const mount = () =>
   view.mount(
      createElement(MarkdownPreview, {
         preview,
         objectKey: "docs/readme.md",
         fileName: "readme.md",
      })
   );
const container = () => view.current.container;
const article = () => container().querySelector("article")!;
const switchTo = async (label: string) =>
   act(async () => buttonByText(container(), label)!.click());

beforeEach(() => {
   h.text = "# Hi\n";
});

describe("markdown preview", () => {
   it("renders GitHub-flavoured markdown", async () => {
      h.text = [
         "# Title",
         "",
         "Tom &amp; Jerry &copy; `a&b` ~~gone~~ \\*kept\\*",
         "",
         "- [x] done",
         "- [ ] todo",
         "",
         "3. three",
         "4. four",
         "",
         "| a | b |",
         "| - | -: |",
         "| 1 | 2 |",
         "",
         "```ts",
         "const x = 1;",
         "```",
         "",
      ].join("\n");
      await mount();
      expect(article().querySelector("h1")?.textContent).toBe("Title");
      expect(article().querySelector("p")?.textContent).toBe(
         "Tom & Jerry © a&b gone *kept*"
      );
      expect(article().querySelector("del")?.textContent).toBe("gone");
      expect(
         [...article().querySelectorAll("input[type=checkbox]")].map(
            (box) => (box as HTMLInputElement).checked
         )
      ).toEqual([true, false]);
      expect(article().querySelector("ol")?.getAttribute("start")).toBe("3");
      expect(article().querySelector("td[align=right]")?.textContent).toBe(
         "2"
      );
      expect(article().querySelector("pre code")?.className).toBe(
         "language-ts"
      );
      expect(container().textContent).toContain("24 words");
   });

   it("switches between the rendered view and the source", async () => {
      h.text = "# Title\n\nbody\n";
      await mount();
      expect(article().querySelector("h1")).not.toBeNull();
      await switchTo("Source");
      expect(container().querySelector("article")).toBeNull();
      expect(container().querySelector("pre")?.textContent).toBe(h.text);
      await switchTo("Preview");
      expect(article().querySelector("h1")?.textContent).toBe("Title");
   });

   it("keeps raw html, unsafe links and foreign images off the page", async () => {
      h.text = [
         "<script>window.pwned = true</script>",
         "",
         "[bad](javascript:alert(1)) [rel](./other.md) [ok](https://example.com) <b>raw</b> ![alt](data:image/png;base64,AAAA)",
         "",
      ].join("\n");
      await mount();
      expect(article().querySelector("script")).toBeNull();
      expect(article().querySelector("b")).toBeNull();
      expect(article().querySelector("img")).toBeNull();
      const links = [...article().querySelectorAll("a")];
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
         "https://example.com",
      ]);
      expect(links[0]?.getAttribute("rel")).toContain("noopener");
      expect(links[0]?.getAttribute("target")).toBe("_blank");
      for (const label of ["bad", "rel", "alt"])
         expect(article().textContent).toContain(label);
      expect((window as { pwned?: boolean }).pwned).toBeUndefined();
   });

   it("copies the original text", async () => {
      const writeText = vi
         .spyOn(navigator.clipboard, "writeText")
         .mockResolvedValue();
      await mount();
      await act(async () => buttonByText(container(), "Copy")!.click());
      expect(writeText).toHaveBeenCalledWith(h.text);
   });
});
