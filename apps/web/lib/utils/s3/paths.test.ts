import { describe, expect, it } from "vitest";
import {
   bucketEntryHref,
   bucketRoute,
   folderHref,
   objectHref,
   prefixFromSegments,
   scopedBucketHref,
   segmentsFromKey,
   segmentsFromObjectKey,
} from "./paths";

const BUCKETS_ROUTE = "/servers/[serverId]/buckets/[[...slug]]";
const SERVER = "server-a";

const routeOf = (href: { query: Record<string, unknown> }) =>
   bucketRoute(href.query as Parameters<typeof bucketRoute>[0]);

describe("pretty path segments for ordinary keys", () => {
   it("keeps folders, objects and the bucket root on the slug", () => {
      expect(folderHref(SERVER, "backups", ["docs", "2026"])).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { serverId: SERVER, slug: ["backups", "docs", "2026"] },
      });
      expect(objectHref(SERVER, "backups", "docs/report.pdf")).toEqual({
         pathname: BUCKETS_ROUTE,
         query: {
            serverId: SERVER,
            slug: ["backups", "docs", "report.pdf"],
            view: "object",
         },
      });
      expect(folderHref(SERVER, "backups", [])).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { serverId: SERVER, slug: ["backups"] },
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
      const href = objectHref(SERVER, "backups", key);
      expect(href).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { serverId: SERVER, slug: ["backups"], key, view: "object" },
      });
      const route = routeOf(href);
      expect(route).toEqual({
         serverId: SERVER,
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
      const href = folderHref(SERVER, "backups", segments);
      expect(href).toEqual({
         pathname: BUCKETS_ROUTE,
         query: { serverId: SERVER, slug: ["backups"], prefix },
      });
      const route = routeOf(href);
      expect(route).toEqual({
         serverId: SERVER,
         bucketName: "backups",
         path: segments,
         isObjectView: false,
      });
      expect(prefixFromSegments(route.path)).toEqual(prefix);
   });
});

describe("bucketRoute reads both URL shapes", () => {
   it("reads a pretty folder URL", () => {
      expect(
         bucketRoute({ serverId: SERVER, slug: ["backups", "docs", "2026"] })
      ).toEqual({
         serverId: SERVER,
         bucketName: "backups",
         path: ["docs", "2026"],
         isObjectView: false,
      });
   });

   it("reads a pretty object URL", () => {
      expect(
         bucketRoute({ slug: ["backups", "docs", "r.pdf"], view: "object" })
      ).toEqual({
         serverId: "",
         bucketName: "backups",
         path: ["docs", "r.pdf"],
         isObjectView: true,
      });
   });

   it("reads a single-segment slug", () => {
      expect(bucketRoute({ slug: "backups" })).toEqual({
         serverId: "",
         bucketName: "backups",
         path: [],
         isObjectView: false,
      });
   });

   it("reports no bucket without a slug", () => {
      expect(bucketRoute({})).toEqual({
         serverId: "",
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
         bucketEntryHref(SERVER, { name: "site", folders: ["reports/2026/"] })
      ).toEqual(folderHref(SERVER, "site", ["reports", "2026"]));
      for (const folders of [null, ["a/", "b/"]])
         expect(bucketEntryHref(SERVER, { name: "site", folders })).toEqual(
            folderHref(SERVER, "site", [])
         );
   });
});

describe("a bucket link without a server", () => {
   it("keeps its bucket, path and query on the given server's URL", () => {
      const href = scopedBucketHref(SERVER, {
         slug: ["backups"],
         key: "a//b.txt",
         view: "object",
      });
      expect(href).toEqual(objectHref(SERVER, "backups", "a//b.txt"));
   });

   it("cannot be pointed at another server through its query", () => {
      expect(
         scopedBucketHref(SERVER, { slug: ["backups"], serverId: "other" })
      ).toEqual(folderHref(SERVER, "backups", []));
   });
});
