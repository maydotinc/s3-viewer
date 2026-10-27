import { describe, expect, it } from "vitest";
import {
   estimateXmlMemory,
   XML_MAX_DEPTH,
   XML_MAX_NAME_BYTES,
   XML_MAX_NODES,
   XML_MAX_VALUE_BYTES,
} from "./xml-response-guard";

const estimate = (xml: string) => estimateXmlMemory(Buffer.from(xml));

describe("XML response complexity admission", () => {
   it("leaves non-XML responses to the existing byte limit", () => {
      expect(estimate("")).toBe(0);
      expect(estimate(" plain text <a/>".repeat(10_000))).toBe(0);
      expect(estimate('{"policy": "<a/>"}')).toBe(0);
   });

   it("also checks BOM-prefixed XML if a decoder strips the BOM", () => {
      expect(estimate("\ufeff <r/>")).toBe(estimate("<r/>"));
      expect(() =>
         estimate("\ufeff<r>" + "<a/>".repeat(XML_MAX_NODES) + "</r>")
      ).toThrow(/XML complexity/);
   });

   it.each([
      () => `<r>${"<a/>".repeat(XML_MAX_NODES)}</r>`,
      () => `<r>${"<![CDATA[]]>".repeat(XML_MAX_NODES)}</r>`,
      () => `<r ${'a="" '.repeat(XML_MAX_NODES)}/>`,
   ])("bounds structural allocations before deserialization", (xml) => {
      expect(() => estimate(xml())).toThrow(/XML complexity/);
   });

   it("limits recursion including self-closing children", () => {
      expect(() =>
         estimate(
            "<r>".repeat(XML_MAX_DEPTH - 1) +
               "<a/>" +
               "</r>".repeat(XML_MAX_DEPTH - 1)
         )
      ).not.toThrow();
      expect(() =>
         estimate(
            "<r>".repeat(XML_MAX_DEPTH) + "<a/>" + "</r>".repeat(XML_MAX_DEPTH)
         )
      ).toThrow(/XML complexity/);
   });

   it.each([
      (span: string) => `<r>${span}</r>`,
      (span: string) => `<r a="${span}"/>`,
      (span: string) => `<r><![CDATA[${span}]]></r>`,
   ])("bounds ordinary text, attribute and CDATA spans", (xml) => {
      expect(() =>
         estimate(xml("a".repeat(XML_MAX_VALUE_BYTES)))
      ).not.toThrow();
      expect(() => estimate(xml("a".repeat(XML_MAX_VALUE_BYTES + 1)))).toThrow(
         /XML complexity/
      );
   });

   it.each([
      (span: string) => `<![CDATA[${span}]]><![CDATA[${span}]]>`,
      (span: string) => `${span}<!-- split -->${span}`,
      (span: string) => `${span}<?split?><![CDATA[${span}]]>`,
      (span: string) => `${span}<child/>${span}`,
   ])(
      "bounds a value assembled from separate direct text fragments",
      (contents) => {
         const xml = `<Key>${contents("a".repeat(9 * 1024))}</Key>`;
         expect(() => estimate(xml)).toThrow(/XML complexity/);
      }
   );

   it("keeps child and attribute values separate from their parent's direct text", () => {
      const span = "a".repeat(XML_MAX_VALUE_BYTES / 2);
      expect(() =>
         estimate(
            `<r attr="${span}${span}">${span}<child>${span}${span}</child><![CDATA[${span}]]></r>`
         )
      ).not.toThrow();
   });

   it("accepts 1,000 separately bounded keys in a pretty-printed listing", () => {
      const key = encodeURIComponent("😀".repeat(256));
      const object = `  <Contents>\n    <Key>${key}</Key>\n    <Size>1</Size>\n  </Contents>\n`;
      expect(() =>
         estimate(
            `<ListBucketResult>\n${object.repeat(1_000)}</ListBucketResult>`
         )
      ).not.toThrow();
   });

   it.each([
      (name: string) => `<${name}/>`,
      (name: string) => `<r ${name}=""/>`,
   ])("bounds tag and attribute name construction", (xml) => {
      expect(() => estimate(xml("a".repeat(XML_MAX_NAME_BYTES)))).not.toThrow();
      expect(() => estimate(xml("a".repeat(XML_MAX_NAME_BYTES + 1)))).toThrow(
         /XML complexity/
      );
   });

   it("recognizes quoted delimiters, comments, processing instructions and CDATA", () => {
      const xml = `<?xml version="1.0"?>\n<!-- <broken> -->\n<r attr="a/> <b>"><![CDATA[<unclosed> & value]]><key>a&amp;b&lt;c&gt;</key><?ignored <tag>?></r>`;
      expect(() => estimate(xml)).not.toThrow();
   });

   it.each([
      "<!DOCTYPE r><r/>",
      "<!doctype r><r/>",
      '<r attr="unterminated>',
      "<r><!-- unclosed</r>",
      "<r><![CDATA[unclosed</r>",
      "<r>",
   ])("refuses unsupported or unterminated markup: %s", (xml) => {
      expect(() => estimate(xml)).toThrow(/XML complexity/);
   });
});
