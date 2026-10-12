import type { ParsedUrlQuery } from "querystring";
import { isLossyKeySegment } from "./key-segments";

const BUCKETS_ROUTE = "/buckets/[[...slug]]";

const isLossy = (segments: readonly string[]): boolean =>
   segments.some((segment) => isLossyKeySegment(segment));

const prefixFromSegments = (segments: readonly string[]): string =>
   segments.length ? `${segments.join("/")}/` : "";

const segmentsFromKey = (key: string): string[] =>
   key
      .split("/")
      .filter(
         (segment, index, all) => segment !== "" || index < all.length - 1
      );

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
