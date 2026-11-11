import { describe, expect, it } from "vitest";
import {
   canAnalyze,
   detectEditorLanguage,
   type EditorLanguage,
} from "./editor-language";
import { loadEditorSupport } from "./editor-support";

describe("editor language detection", () => {
   it.each([
      ["path/CONFIG.JSON", "text/plain", "json"],
      ["main.ts", "application/json", "typescript"],
      ["widget.tsx", "", "tsx"],
      [".env.production", "", "properties"],
      ["settings", "Application/Problem+JSON; charset=utf-8", "json"],
      ["image", "image/svg+xml", "xml"],
      ["file", "application/x-yaml", "yaml"],
      ["data.csv", "application/json", "text"],
      ["__proto__", "text/plain", "text"],
   ])("detects %s with %s", (name, mime, expected) => {
      expect(detectEditorLanguage(name, mime)).toBe(expected);
   });
});

describe("editor syntax checks", () => {
   it.each<[EditorLanguage, string, string]>([
      ["json", '{"enabled":true}', '{"enabled":}'],
      ["javascript", "const enabled = true;", "const enabled = ;"],
      ["typescript", "const count: number = 1;", "const count: = 1;"],
      ["jsx", "const view = <div />;", "const view = <div;"],
      ["tsx", "const view: JSX.Element = <div />;", "const view: = <div />;"],
      ["css", "body { color: red; }", "body { color: red;"],
      ["html", "<p>Hello</p>", "<div></span>"],
      ["xml", "<root><item /></root>", "<root><item></root>"],
      ["yaml", "enabled: true\n", "enabled: [true\n"],
   ])(
      "reports positioned errors for %s and clears them after a fix",
      async (language, valid, invalid) => {
         const { validate } = await loadEditorSupport(language);
         expect(validate!(valid)).toEqual([]);
         const errors = validate!(invalid);
         expect(errors.length).toBeGreaterThan(0);
         for (const error of errors) {
            expect(error.from).toBeGreaterThanOrEqual(0);
            expect(error.to).toBeGreaterThanOrEqual(error.from);
            expect(error.to).toBeLessThanOrEqual(invalid.length);
            expect(error.message).not.toBe("");
         }
         expect(validate!(valid)).toEqual([]);
      }
   );

   it.each(["", '{"a": 1,}', "// comment\n{}", "NaN", "{a: 1}"])(
      "rejects invalid strict JSON: %j",
      async (text) => {
         const { validate } = await loadEditorSupport("json");
         expect(validate!(text).length).toBeGreaterThan(0);
      }
   );

   it("validates multi-document YAML and duplicate keys", async () => {
      const { validate } = await loadEditorSupport("yaml");
      expect(validate!("a: 1\n---\nb: 2\n")).toEqual([]);
      expect(validate!("a: 1\na: 2\n")[0]?.message).toContain("unique");
   });

   it.each<EditorLanguage>(["text", "markdown", "shell", "toml", "properties"])(
      "does not claim validation support for %s",
      async (language) => {
         expect((await loadEditorSupport(language)).validate).toBeUndefined();
      }
   );

   it("limits diagnostic output on highly malformed input", async () => {
      const { validate } = await loadEditorSupport("javascript");
      expect(validate!("const = ;\n".repeat(500)).length).toBeLessThanOrEqual(
         100
      );
   });

   it("bounds analysis for both long lines and many short lines", () => {
      expect(canAnalyze("x".repeat(200_000))).toBe(true);
      expect(canAnalyze("x".repeat(200_001))).toBe(false);
      expect(canAnalyze("\n".repeat(9_999))).toBe(true);
      expect(canAnalyze("\n".repeat(10_000))).toBe(false);
   });
});
