import { describe, expect, it } from "vitest";
import {
   bucketEntryHref,
   bucketRoute,
   folderHref,
   objectHref,
   prefixFromSegments,
   segmentsFromKey,
   segmentsFromObjectKey,
} from "./paths";

const BUCKETS_ROUTE = "/buckets/[[...slug]]";

const routeOf = (href: { query: Record<string, unknown> }) =>
   bucketRoute(href.query as Parameters<typeof bucketRoute>[0]);

describe("pretty path segments for ordinary keys", () => {
   it("keeps folders, objects and the bucket root on the slug", () => {
      expect(folderHref("backups", ["docs", "2026"])).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { slug: ["backups", "docs", "2026"] },
      });
      expect(objectHref("backups", "docs/report.pdf")).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { slug: ["backups", "docs", "report.pdf"], view: "object" },
      });
      expect(folderHref("backups", [])).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { slug: ["backups"] },
      });
   });

   it.each([
      ["", []],
      ["report.pdf", ["report.pdf"]],
      ["docs/2026/report.pdf", ["docs", "2026", "report.pdf"]],
      ["docs/2026/", ["docs", "2026"]],
   ])("splits the prefix %j into segments", (key, segments) => {
      expect(segmentsFromKey(key)).toEqual(segments);
   });

   it.each([
      ["", []],
      ["report.pdf", ["report.pdf"]],
      ["docs/2026/report.pdf", ["docs", "2026", "report.pdf"]],
      ["docs/", ["docs", ""]],
   ])("splits the object key %j without losing a segment", (key, segments) => {
      expect(segmentsFromObjectKey(key)).toEqual(segments);
   });

   it.each([
      [[], ""],
      [["docs"], "docs/"],
      [["docs", "2026"], "docs/2026/"],
   ])("joins %j back into a prefix", (segments, prefix) => {
      expect(prefixFromSegments(segments)).toEqual(prefix);
   });
});

describe("keys the URL path cannot carry travel in the query", () => {
   it.each([
      ["docs/../secret.txt", ["docs", "..", "secret.txt"]],
      ["a//b.txt", ["a", "", "b.txt"]],
      ["./x", [".", "x"]],
      ["docs/", ["docs", ""]],
   ])("routes the object key %j through ?key", (key, segments) => {
      const href = objectHref("backups", key);
      expect(href).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { slug: ["backups"], key, view: "object" },
      });
      const route = routeOf(href);
      expect(route).toEqual({
         bucketName: "backups",
         path: segments,
         isObjectView: true,
      });
      expect(route.path.join("/")).toEqual(key);
   });

   it.each([
      ["docs/../", ["docs", ".."]],
      ["a//", ["a", ""]],
      ["./", ["."]],
   ])("routes the folder prefix %j through ?prefix", (prefix, segments) => {
      const href = folderHref("backups", segments);
      expect(href).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { slug: ["backups"], prefix },
      });
      const route = routeOf(href);
      expect(route).toEqual({
         bucketName: "backups",
         path: segments,
         isObjectView: false,
      });
      expect(prefixFromSegments(route.path)).toEqual(prefix);
   });
});

describe("bucketRoute reads both URL shapes", () => {
   it("reads a pretty folder URL", () => {
      expect(bucketRoute({ slug: ["backups", "docs", "2026"] })).toEqual({
         bucketName: "backups",
         path: ["docs", "2026"],
         isObjectView: false,
      });
   });

   it("reads a pretty object URL", () => {
      expect(
         bucketRoute({ slug: ["backups", "docs", "r.pdf"], view: "object" })
      ).toEqual({
         bucketName: "backups",
         path: ["docs", "r.pdf"],
         isObjectView: true,
      });
   });

   it("reads a single-segment slug", () => {
      expect(bucketRoute({ slug: "backups" })).toEqual({
         bucketName: "backups",
         path: [],
         isObjectView: false,
      });
   });

   it("reports no bucket without a slug", () => {
      expect(bucketRoute({})).toEqual({
         bucketName: "",
         path: [],
         isObjectView: false,
      });
   });

   it("ignores ?prefix on an object view and ?key off one", () => {
      expect(
         bucketRoute({
            slug: ["backups"],
            key: "a//b.txt",
            prefix: "other/",
            view: "object",
         }).path
      ).toEqual(["a", "", "b.txt"]);
      expect(
         bucketRoute({ slug: ["backups"], key: "a//b.txt", prefix: "a//" }).path
      ).toEqual(["a", ""]);
   });

   it("ignores repeated query values rather than guessing one", () => {
      expect(
         bucketRoute({ slug: ["backups", "docs"], prefix: ["a/", "b/"] }).path
      ).toEqual(["docs"]);
   });
});

describe("opening a bucket", () => {
   it("goes straight into the only folder someone was given, otherwise to the root", () => {
      expect(
         bucketEntryHref({ name: "site", folders: ["reports/2026/"] })
      ).toEqual(folderHref("site", ["reports", "2026"]));
      for (const folders of [null, ["a/", "b/"]])
         expect(bucketEntryHref({ name: "site", folders })).toEqual(
            folderHref("site", [])
         );
   });
});
