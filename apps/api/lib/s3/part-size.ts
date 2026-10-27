import { MAX_MULTIPART_PARTS, MIB } from "@s3-viewer/shared";

const MAX_DERIVED_PART_BYTES = 64 * MIB;

const minPartSizeFor = (contentLength: number): number =>
   Math.ceil(contentLength / MAX_MULTIPART_PARTS);

const maxPartBytesFor = (basePartBytes: number): number =>
   Math.max(basePartBytes, MAX_DERIVED_PART_BYTES);

const exceedsMaxPartSize = (
   length: number | undefined,
   maxPartBytes: number
): boolean => length !== undefined && minPartSizeFor(length) > maxPartBytes;

const partSizeFor = (
   contentLength: number | undefined,
   basePartBytes: number
): number =>
   contentLength === undefined
      ? basePartBytes
      : Math.min(
           maxPartBytesFor(basePartBytes),
           Math.max(basePartBytes, minPartSizeFor(contentLength))
        );

export { exceedsMaxPartSize, maxPartBytesFor, minPartSizeFor, partSizeFor };
