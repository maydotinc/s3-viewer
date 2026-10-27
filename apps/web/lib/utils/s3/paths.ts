import type { S3Bucket } from "@s3-viewer/shared";
import type { ParsedUrlQuery } from "querystring";
import { isLossyKeySegment } from "./key-segments";

const BUCKETS_ROUTE = "/servers/[serverId]/buckets/[[...slug]]";

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

const folderHref = (
   serverId: string,
   bucketName: string,
   segments: readonly string[]
) =>
   isLossy(segments)
      ? {
           pathname: BUCKETS_ROUTE,
           query: {
              serverId,
              slug: [bucketName],
              prefix: prefixFromSegments(segments),
           },
        }
      : {
           pathname: BUCKETS_ROUTE,
           query: { serverId, slug: [bucketName, ...segments] },
        };

// a member limited to one folder has nothing to see above it
const bucketEntryHref = (
   serverId: string,
   { name, folders }: Pick<S3Bucket, "name" | "folders">
) =>
   folderHref(
      serverId,
      name,
      folders?.length === 1 ? segmentsFromKey(folders[0]!) : []
   );

const objectHref = (serverId: string, bucketName: string, key: string) => {
   const segments = segmentsFromObjectKey(key);
   return isLossy(segments)
      ? {
           pathname: BUCKETS_ROUTE,
           query: { serverId, slug: [bucketName], key, view: "object" },
        }
      : {
           pathname: BUCKETS_ROUTE,
           query: {
              serverId,
              slug: [bucketName, ...segments],
              view: "object",
           },
        };
};

const scopedBucketHref = (serverId: string, query: ParsedUrlQuery) => ({
   pathname: BUCKETS_ROUTE,
   query: { ...query, serverId },
});

type BucketRoute = {
   serverId: string;
   bucketName: string;
   path: string[];
   isObjectView: boolean;
};

const bucketRoute = (query: ParsedUrlQuery): BucketRoute => {
   const { serverId, slug } = query;
   const segments = Array.isArray(slug)
      ? slug
      : typeof slug === "string"
        ? [slug]
        : [];
   const isObjectView = query.view === "object";
   const explicit = isObjectView ? query.key : query.prefix;
   return {
      serverId: typeof serverId === "string" ? serverId : "",
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
   bucketEntryHref,
   bucketRoute,
   folderHref,
   objectHref,
   prefixFromSegments,
   scopedBucketHref,
   segmentsFromKey,
   segmentsFromObjectKey,
};
