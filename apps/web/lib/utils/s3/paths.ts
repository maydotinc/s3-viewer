import type { ParsedUrlQuery } from "querystring";

const BUCKETS_ROUTE = "/buckets/[[...slug]]";

// the browser and Next resolve "." and ".." and collapse "" away inside a URL
// path, so a key holding one of them cannot travel as path segments at all.
const LOSSY_SEGMENTS = new Set(["", ".", ".."]);

const isLossy = (segments: readonly string[]): boolean =>
   segments.some((segment) => LOSSY_SEGMENTS.has(segment));

const prefixFromSegments = (segments: readonly string[]): string =>
   segments.length ? `${segments.join("/")}/` : "";

// a folder prefix carries its trailing "/" implicitly, so "docs/" is the folder
// ["docs"]; every other empty segment is real and must survive.
const segmentsFromKey = (key: string): string[] =>
   key
      .split("/")
      .filter(
         (segment, index, all) => segment !== "" || index < all.length - 1
      );

// an object key is not a prefix: "docs/" is a folder-marker object, a different
// thing from the object "docs", so its trailing empty segment is kept.
const segmentsFromObjectKey = (key: string): string[] =>
   key === "" ? [] : key.split("/");

const folderHref = (bucketName: string, segments: readonly string[]) =>
   isLossy(segments)
      ? {
           pathname: BUCKETS_ROUTE,
           query: {
              slug: [bucketName],
              prefix: prefixFromSegments(segments),
           },
        }
      : { pathname: BUCKETS_ROUTE, query: { slug: [bucketName, ...segments] } };

const objectHref = (bucketName: string, key: string) => {
   const segments = segmentsFromObjectKey(key);
   return isLossy(segments)
      ? {
           pathname: BUCKETS_ROUTE,
           query: { slug: [bucketName], key, view: "object" },
        }
      : {
           pathname: BUCKETS_ROUTE,
           query: {
              slug: [bucketName, ...segments],
              view: "object",
           },
        };
};

/** the inverse of folderHref/objectHref: both URL shapes give the same path. */
const bucketRoute = (
   query: ParsedUrlQuery
): { bucketName: string; path: string[]; isObjectView: boolean } => {
   const { slug } = query;
   const segments = Array.isArray(slug)
      ? slug
      : typeof slug === "string"
        ? [slug]
        : [];
   const isObjectView = query.view === "object";
   const explicit = isObjectView ? query.key : query.prefix;
   return {
      bucketName: segments[0] ?? "",
      path:
         typeof explicit === "string"
            ? isObjectView
               ? segmentsFromObjectKey(explicit)
               : segmentsFromKey(explicit)
            : segments.slice(1),
      isObjectView,
   };
};

export {
   bucketRoute,
   folderHref,
   objectHref,
   prefixFromSegments,
   segmentsFromKey,
   segmentsFromObjectKey,
};
