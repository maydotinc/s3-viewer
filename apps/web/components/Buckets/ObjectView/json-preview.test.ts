// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, mountedRuntime } from "@/components/test-helpers";
import type { S3ObjectPreview } from "@s3-viewer/types";
import {
   JSON_STRING_PREVIEW_CHARS,
   MAX_BODY_PREVIEW_BYTES,
   RAW_TEXT_PREVIEW_CHARS,
} from "@/lib/utils/file-utils";
import JsonPreview from "./json-preview";

const h = vi.hoisted(() => ({ text: "", failTree: false }));
vi.mock("@/components/Buckets/Context", () => ({
   useBucketContext: () => ({ bucketName: "bucket" }),
}));
vi.mock("./preview-message", () => ({ PreviewMessage: () => null }));
vi.mock("@/lib/hooks/queries/s3/useObjectBody", () => ({
   default: () => ({ data: h.text, isPending: false, isError: false }),
   ObjectBodyError: class extends Error {},
}));
vi.mock("./json-rows", async (original) => {
   const actual = await original<typeof import("./json-rows")>();
   return {
      ...actual,
      flattenJson: (...args: Parameters<typeof actual.flattenJson>) => {
         if (h.failTree) throw new Error("Unexpected tree failure");
         return actual.flattenJson(...args);
      },
   };
});
vi.mock("@tanstack/react-virtual", () => ({
   useVirtualizer: ({
      count,
      getItemKey,
   }: {
      count: number;
      getItemKey: (index: number) => string;
   }) => ({
      getTotalSize: () => count * 24,
      getVirtualItems: () =>
         Array.from({ length: count }, (_, index) => ({
            index,
            key: getItemKey(index),
            start: index * 24,
         })),
      measureElement: () => {},
   }),
}));

const preview = {
   contentLength: 100,
   url: "https://storage.test/data.json",
   eTag: '"one"',
   versionId: null,
   contentEncoding: null,
} as S3ObjectPreview;
const view = mountedRuntime(() => {
   vi.restoreAllMocks();
   vi.unstubAllGlobals();
});
let update!: (props: { objectKey: string; preview: S3ObjectPreview }) => void;
const Probe = () => {
   const [props, setProps] = useState({ objectKey: "one.json", preview });
   update = setProps;
   return createElement(
      "main",
      null,
      createElement("nav", null, "Bucket navigation"),
      createElement(JsonPreview, { ...props, fileName: props.objectKey })
   );
};

beforeEach(() => {
   h.text = '{"ok":true}';
   h.failTree = false;
});

describe("JSON preview containment", () => {
   it.each(["scalar", "key", "nested"])(
      "bounds a near-limit JSON %s while copying the entire original",
      async (shape) => {
         const long = "x".repeat(MAX_BODY_PREVIEW_BYTES - 100);
         h.text = JSON.stringify(
            shape === "scalar"
               ? long
               : shape === "key"
                 ? { [long]: true }
                 : { nested: { value: long } }
         );
         const writeText = vi
            .spyOn(navigator.clipboard, "writeText")
            .mockResolvedValue();
         await view.mount(createElement(Probe));
         expect(view.current.container.textContent).toContain("… truncated");
         expect(view.current.container.textContent!.length).toBeLessThan(
            JSON_STRING_PREVIEW_CHARS + 250
         );
         const copy = [
            ...view.current.container.querySelectorAll("button"),
         ].find((button) => button.textContent === "Copy");
         await act(async () => copy!.click());
         expect(writeText).toHaveBeenCalledWith(h.text);
      }
   );

   it("keeps a surrogate pair intact at the display boundary", async () => {
      h.text = JSON.stringify(
         "a".repeat(JSON_STRING_PREVIEW_CHARS - 1) + "😀tail"
      );
      await view.mount(createElement(Probe));
      expect(view.current.container.textContent).toContain("… truncated");
      expect(view.current.container.textContent).not.toContain("\\ud83d");
   });

   it("copies the original deep-and-wide document without pretty-printing it", async () => {
      h.text =
         "[".repeat(1500) +
         Array.from({ length: 1000 }, () => "0").join(",") +
         "]".repeat(1500);
      const stringify = vi.spyOn(JSON, "stringify");
      const writeText = vi
         .spyOn(navigator.clipboard, "writeText")
         .mockResolvedValue();
      await view.mount(createElement(Probe));
      const copy = buttonByText(view.current.container, "Copy");
      expect(copy).toBeDefined();
      await act(async () => copy!.click());
      expect(writeText).toHaveBeenCalledWith(h.text);
      expect(stringify.mock.calls.every((call) => call[2] === undefined)).toBe(
         true
      );
      expect(view.current.container.textContent).not.toContain(
         "Couldn't render"
      );
   });

   it("renders escaped lone surrogates as valid JSON keys", async () => {
      h.text = '{"\\ud800":{"\\udfff":1},"a/b":2,"truncated":3}';
      await view.mount(createElement(Probe));
      expect(view.current.container.textContent).toContain('"\\ud800"');
      expect(view.current.container.textContent).toContain('"\\udfff"');
      expect(view.current.container.textContent).not.toContain(
         "Couldn't render"
      );
   });

   it.each(["object", "version"])(
      "contains an unexpected render error and recovers on a new %s",
      async (change) => {
         h.failTree = true;
         h.text = JSON.stringify({
            text: "x".repeat(RAW_TEXT_PREVIEW_CHARS + 10),
         });
         vi.spyOn(console, "error").mockImplementation(() => {});
         await view.mount(createElement(Probe));
         expect(view.current.container.textContent).toContain(
            "Bucket navigation"
         );
         expect(view.current.container.textContent).toContain(
            "Couldn't render this JSON"
         );
         expect(
            view.current.container.querySelector("pre")?.textContent
         ).toHaveLength(RAW_TEXT_PREVIEW_CHARS);
         h.failTree = false;
         h.text = '{"recovered":true}';
         await act(async () =>
            update({
               objectKey: change === "object" ? "two.json" : "one.json",
               preview:
                  change === "version"
                     ? { ...preview, eTag: '"two"' }
                     : preview,
            })
         );
         expect(view.current.container.textContent).toContain('"recovered"');
         expect(view.current.container.textContent).not.toContain(
            "Couldn't render"
         );
      }
   );
});

describe("JSON tree keyboard folding", () => {
   it("keeps focus on a branch row when it is collapsed and expanded", async () => {
      h.text = '{"nested":{"value":1}}';
      await view.mount(createElement(Probe));
      const branch = () =>
         [
            ...view.current.container.querySelectorAll("button[aria-expanded]"),
         ].find((button) =>
            button.textContent?.includes('"nested"')
         ) as HTMLButtonElement;
      const row = branch();
      row.focus();
      const expanded = row.getAttribute("aria-expanded");
      await act(async () => row.click());
      expect(branch()).toBe(row);
      expect(row.getAttribute("aria-expanded")).not.toBe(expanded);
      expect(document.activeElement).toBe(row);
   });
});
