import {
   headerValidationIssues,
   updateObjectSettingsBodySchema,
} from "@s3-viewer/shared";
import { describe, expect, it } from "vitest";
import {
   expiresToSave,
   fromDateTimeLocal,
   validateHeader,
   metadataFromRows,
   rowsFromMetadata,
   toDateTimeLocal,
   validateExpires,
   validateMetadata,
   type MetadataRow,
} from "./fields";

const rows = (...entries: [string, string][]): MetadataRow[] =>
   entries.map(([key, value], id) => ({ id, key, value }));

describe("custom metadata rows", () => {
   it("round-trips the metadata S3 returned", () => {
      const metadata = { owner: "ops", "review-by": "2026-10-01" };
      expect(metadataFromRows(rowsFromMetadata(metadata))).toEqual(metadata);
   });

   it("lower-cases and trims names, and drops untouched rows", () => {
      expect(
         metadataFromRows(rows([" Owner ", "ops"], ["", ""], ["Team", "core"]))
      ).toEqual({ owner: "ops", team: "core" });
   });

   it("keeps a value the user cleared, so the header is removed", () => {
      expect(metadataFromRows(rows(["owner", ""]))).toEqual({ owner: "" });
   });

   it.each([
      [rows(["owner", "ops"], ["review-by", "soon"]), null],
      [rows(["", "ops"]), "Give every metadata value a name."],
      [rows(["owner!", "ops"]), "isn't a valid name"],
      [rows(["owner_id", "ops"]), "isn't a valid name"],
      [rows(["owner", "a"], ["OWNER", "b"]), "is listed twice"],
      [rows(["owner", "first"], ["owner", "second"]), "is listed twice"],
      [rows(["owner", "x".repeat(1025)]), "longer than 1 KiB"],
      [rows(["owner", "two\nlines"]), "a header can't carry"],
   ])("validates %#", (input, expected) => {
      const result = validateMetadata(input);
      if (expected === null) expect(result).toBeNull();
      else expect(result).toContain(expected);
   });

   it("refuses more than 50 entries", () => {
      const many = Array.from({ length: 51 }, (_, id) => ({
         id,
         key: `k${id}`,
         value: "v",
      }));
      expect(validateMetadata(many)).toContain("50 entries");
   });

   it("refuses more than 2 KiB of metadata in total", () => {
      const heavy = Array.from({ length: 4 }, (_, id) => ({
         id,
         key: `key-${id}`,
         value: "x".repeat(600),
      }));
      expect(validateMetadata(heavy)).toContain("2 KiB in total");
   });
});

describe("header values", () => {
   it.each(["líne", "two\nlines", "\ttab"])(
      "refuses %j, which no header can carry",
      (value) =>
         expect(validateHeader("Cache-Control", value)).toContain("can't carry")
   );

   it("refuses a header past the length limit", () =>
      expect(validateHeader("Cache-Control", "a".repeat(1025))).toContain(
         "too long"
      ));
});

describe("expires field", () => {
   it("shows an instant as local wall time and sends it back as an instant", () => {
      const local = toDateTimeLocal("2026-03-04T05:06:00.000Z");
      expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(new Date(fromDateTimeLocal(local)).toISOString()).toBe(
         "2026-03-04T05:06:00.000Z"
      );
   });

   it.each([null, "not a date"])("shows nothing for %s", (value) =>
      expect(toDateTimeLocal(value)).toBe("")
   );

   it("treats an empty field as no expiry", () => {
      expect(fromDateTimeLocal("")).toBe("");
      expect(validateExpires("")).toBeNull();
   });

   it("reports an unparseable date", () => {
      expect(validateExpires("tomorrow")).toBe("That isn't a valid date.");
   });

   it("keeps the stored seconds when the field was left as loaded", () => {
      const stored = "2031-01-01T00:00:30.000Z";
      expect(expiresToSave(toDateTimeLocal(stored), stored)).toBe(stored);
   });

   it("sends an edited or cleared value instead of the stored one", () => {
      const stored = "2031-01-01T00:00:30.000Z";
      const edited = toDateTimeLocal("2031-02-01T00:00:00.000Z");
      expect(expiresToSave(edited, stored)).toBe("2031-02-01T00:00:00.000Z");
      expect(expiresToSave("", stored)).toBe("");
      expect(expiresToSave(edited, null)).toBe("2031-02-01T00:00:00.000Z");
   });
});

describe("shared API and form metadata validation", () => {
   const payload = {
      serverId: "server12345",
      bucketName: "bucket",
      objectKey: "file.txt",
      expectedUserId: "user12345",
      expectedETag: '"reviewed"',
      contentType: "text/plain",
   };
   it.each<[string, string][]>([
      [["Owner", "ops"]],
      [
         [" owner ", "ops"],
         ["OWNER", "other"],
      ],
      [["", "value"]],
      [["invalid!", "value"]],
      [["owner", "line\nbreak"]],
      [["owner", "é"]],
      [["owner", "x".repeat(1025)]],
      [
         ["a", "x".repeat(1023)],
         ["b", "x".repeat(1023)],
      ],
      [
         ["a", "x".repeat(1024)],
         ["b", "x".repeat(1024)],
      ],
   ])("accepts the same populated rows as the API: %j", (...entries) => {
      const input = rows(...entries);
      const accepted = updateObjectSettingsBodySchema.safeParse({
         ...payload,
         metadata: Object.fromEntries(entries),
      }).success;
      expect(validateMetadata(input) === null).toBe(accepted);
   });
   it.each([
      "",
      "max-age=30",
      "a".repeat(1024),
      "a".repeat(1025),
      "new\nline",
      "é",
   ])("shares header acceptance for %j", (value) => {
      const accepted = updateObjectSettingsBodySchema.safeParse({
         ...payload,
         metadata: {},
         cacheControl: value,
      }).success;
      expect(headerValidationIssues(value).length === 0).toBe(accepted);
      expect(validateHeader("Cache-Control", value) === null).toBe(accepted);
   });
});
