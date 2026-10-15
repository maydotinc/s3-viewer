import type { AuditLogEntry } from "@s3-viewer/types";
import { describe, expect, it } from "vitest";
import { bucketDetailText, parseBucketDetail } from "./bucket-detail";
import { metaOf } from "./labels";

describe("reading the buckets recorded with an access change", () => {
   it("reads whole-bucket and folder grants", () => {
      expect(
         parseBucketDetail('alpha:EDITOR["landing/","a b/"],zeta:VIEWER')
      ).toEqual([
         { bucketName: "alpha", role: "EDITOR", folders: ["landing/", "a b/"] },
         { bucketName: "zeta", role: "VIEWER", folders: null },
      ]);
   });

   it("keeps folder names whole when they hold commas, brackets or quotes", () => {
      expect(
         parseBucketDetail('a:VIEWER["x,y/","]z[/","q\\"r/"],b:ADMIN')
      ).toEqual([
         {
            bucketName: "a",
            role: "VIEWER",
            folders: ["x,y/", "]z[/", 'q"r/'],
         },
         { bucketName: "b", role: "ADMIN", folders: null },
      ]);
   });

   it("reads a list only kept as a digest as a count", () => {
      expect(
         parseBucketDetail("b:VIEWER[20 folders sha256:abcdef0123456789]")
      ).toEqual([{ bucketName: "b", role: "VIEWER", folders: 20 }]);
   });

   it.each([
      "",
      "alpha",
      ":EDITOR",
      "alpha:editor",
      "alpha:EDITOR,",
      'alpha:EDITOR["unclosed/',
      "alpha:EDITOR[not json]",
      "alpha:EDITOR[1,2]",
      "alpha:EDITORzeta:VIEWER",
   ])("gives up on %j rather than guessing", (raw) => {
      expect(parseBucketDetail(raw)).toBeNull();
   });

   it("writes it out for people", () => {
      expect(
         bucketDetailText("b:VIEWER[20 folders sha256:abcdef0123456789]")
      ).toBe("b: Viewer in 20 folders");
      expect(bucketDetailText("something else")).toBe("something else");
   });
});

describe("the activity log", () => {
   const entry = (
      action: AuditLogEntry["action"],
      detail: AuditLogEntry["detail"]
   ) => ({ action, detail }) as AuditLogEntry;

   it("shows what a role change gave access to", () => {
      expect(
         metaOf(
            entry("member.role_change", {
               role: "VIEWER",
               buckets: 'alpha:EDITOR["landing/"],zeta:VIEWER',
            })
         )
      ).toBe("Viewer role · alpha: Editor in landing/; zeta: Viewer");
   });

   it("still shows the role alone when no buckets were recorded", () => {
      expect(metaOf(entry("member.role_change", { role: "ADMIN" }))).toBe(
         "Admin role"
      );
   });
});
