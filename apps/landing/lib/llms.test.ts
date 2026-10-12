import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "@/pages/api/llms";

describe("llms.txt", () => {
   const body = buildLlmsTxt();

   it("starts with the product heading and credits the company", () => {
      expect(body).toMatch(/^# S3 Viewer\n/);
      expect(body).toContain("## Who builds S3 Viewer");
      expect(body).toContain("https://may.inc");
      expect(body).toContain("https://github.com/maydotinc");
   });

   it("has no unresolved template values", () => {
      expect(body).not.toMatch(/undefined|\$\{/);
   });
});
