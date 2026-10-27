import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, keysetAfter } from "./cursor";

describe("keyset cursors", () => {
   it("round-trips a position through base64url", () => {
      const position = {
         createdAt: new Date("2026-09-01T00:00:00.000Z"),
         id: "m1",
      };
      const cursor = encodeCursor(position);
      expect(decodeCursor(cursor)).toEqual(position);
   });

   it("seeks past a position with one row-value comparison in the page's order", () => {
      const position = {
         createdAt: new Date("2026-09-01T00:00:00.000Z"),
         id: "m1",
      };
      const older = keysetAfter(position, "desc");
      expect(older.text).toBe('("createdAt", "id") < ($1::timestamp, $2)');
      expect(older.values).toEqual(["2026-09-01T00:00:00.000Z", "m1"]);
      expect(keysetAfter(position, "asc").text).toBe(
         '("createdAt", "id") > ($1::timestamp, $2)'
      );
   });

   it("rejects a cursor that decodes to no id or an unreadable date", () => {
      const invalid = { status: 400, message: "Invalid cursor" };
      expect(() => decodeCursor("nope")).toThrowError(
         expect.objectContaining(invalid)
      );
      expect(() =>
         decodeCursor(
            Buffer.from("2026-09-01T00:00:00.000Z|").toString("base64url")
         )
      ).toThrowError(expect.objectContaining(invalid));
      expect(() =>
         decodeCursor(Buffer.from("not-a-date|m1").toString("base64url"))
      ).toThrowError(expect.objectContaining(invalid));
   });
});

it.each([
   "2026-09-01T00:00:00.000Z|bad\0id",
   "2026-09-01T00:00:00.000Z|id|extra",
   "2026-09-01T00:00:00.000Z|" + "i".repeat(65),
   "0000-01-01T00:00:00.000Z|m1",
   "-000001-01-01T00:00:00.000Z|m1",
   "+010000-01-01T00:00:00.000Z|m1",
])("rejects unsafe decoded cursor text", (value) => {
   expect(() =>
      decodeCursor(Buffer.from(value).toString("base64url"))
   ).toThrowError(expect.objectContaining({ status: 400 }));
});

it("rejects noncanonical or malformed UTF-8 encodings", () => {
   for (const cursor of [
      "a".repeat(513),
      "YQ==",
      Buffer.from([0xff, 0x7c, 0x61]).toString("base64url"),
   ])
      expect(() => decodeCursor(cursor)).toThrowError(
         expect.objectContaining({ status: 400 })
      );
});
