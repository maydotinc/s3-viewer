const BUCKETS_ROUTE = "/buckets/[[...slug]]";

const prefixFromSegments = (segments: readonly string[]): string =>
   segments.length ? `${segments.join("/")}/` : "";

const segmentsFromKey = (key: string): string[] =>
   key
      .split("/")
      .filter(
         (segment, index, all) => segment !== "" || index < all.length - 1
      );

const folderHref = (bucketName: string, segments: readonly string[]) => ({
   pathname: BUCKETS_ROUTE,
   query: { slug: [bucketName, ...segments] },
});

const objectHref = (bucketName: string, key: string) => ({
   pathname: BUCKETS_ROUTE,
   query: { slug: [bucketName, ...segmentsFromKey(key)], view: "object" },
});

export { folderHref, objectHref, prefixFromSegments, segmentsFromKey };
