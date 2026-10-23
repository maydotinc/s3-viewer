// @vitest-environment happy-dom
import { act, createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, mountedRuntime } from "@/components/test-helpers";
import type { S3ObjectPreview } from "@s3-viewer/types";
import {
   MARKDOWN_RENDER_BYTES,
   RAW_TEXT_PREVIEW_CHARS,
} from "@/lib/utils/file-utils";
import { marked } from "marked";
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
const view = mountedRuntime(() => vi.restoreAllMocks());
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
      expect(article().querySelector("td[align=right]")?.textContent).toBe("2");
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

   it("holds remote images back until their host is allowed", async () => {
      h.text = [
         "![chart](https://img.example.com/a.png) ![other](https://cdn.test/b.png)",
         "",
         "[![badge](https://img.example.com/badge.svg)](https://example.com)",
         "",
      ].join("\n");
      await mount();
      expect(article().querySelector("img")).toBeNull();
      const placeholder = buttonByText(container(), "chart", "prefix")!;
      expect(placeholder.textContent).toContain("img.example.com");
      expect(article().querySelector("a button")).toBeNull();
      expect(article().querySelector("a")?.textContent).toContain("badge");
      await act(async () => placeholder.click());
      expect(
         [...article().querySelectorAll("img")].map((img) =>
            img.getAttribute("src")
         )
      ).toEqual([
         "https://img.example.com/a.png",
         "https://img.example.com/badge.svg",
      ]);
      expect(
         article().querySelector("img")?.getAttribute("referrerpolicy")
      ).toBe("no-referrer");
      expect(buttonByText(container(), "other", "prefix")).not.toBeUndefined();
   });

   it("offers to load images that only appear inside links", async () => {
      h.text = [
         "[![ci](https://img.shields.io/ci.svg)](https://ci.test) [![npm](https://img.shields.io/npm.svg)](https://npm.test)",
         "",
         "| logo |",
         "| - |",
         "| [![logo](https://cdn.test/logo.png)](https://example.com) |",
         "",
      ].join("\n");
      await mount();
      expect(article().querySelector("img")).toBeNull();
      expect(article().textContent).toContain("3 remote images not loaded");
      await act(async () =>
         buttonByText(container(), "Load from img.shields.io")!.click()
      );
      expect(
         [...article().querySelectorAll("img")].map((img) =>
            img.getAttribute("src")
         )
      ).toEqual([
         "https://img.shields.io/ci.svg",
         "https://img.shields.io/npm.svg",
      ]);
      expect(article().textContent).toContain("1 remote image not loaded");
      expect(
         buttonByText(container(), "Load from img.shields.io")
      ).toBeUndefined();
      await act(async () =>
         buttonByText(container(), "Load from cdn.test")!.click()
      );
      expect(article().querySelectorAll("img")).toHaveLength(3);
      expect(article().textContent).not.toContain("not loaded");
   });

   it("shows a document past the render cap as source without lexing it", async () => {
      h.text = "*a ".repeat(Math.ceil(MARKDOWN_RENDER_BYTES / 3) + 1);
      const lexer = vi.spyOn(marked, "lexer");
      await mount();
      expect(lexer).not.toHaveBeenCalled();
      expect(container().querySelector("article")).toBeNull();
      expect(container().textContent).toContain("showing the raw file");
      expect(container().querySelector("pre")?.textContent).toBe(
         h.text.slice(0, RAW_TEXT_PREVIEW_CHARS)
      );
   });

   it("measures the render cap in bytes, not characters", async () => {
      h.text = "é".repeat(MARKDOWN_RENDER_BYTES / 2 + 1);
      expect(h.text.length).toBeLessThan(MARKDOWN_RENDER_BYTES);
      await mount();
      expect(container().querySelector("article")).toBeNull();
      expect(container().textContent).toContain("Markdown over 256 KiB");
   });
});
