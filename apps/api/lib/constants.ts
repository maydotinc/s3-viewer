import { MIB, SECOND_MS, MINUTE_MS } from "@s3-viewer/shared";

const SERVER_NOT_FOUND = "Server not found";
const MEMBER_NOT_FOUND = "Member not found";
const OBJECT_EXISTS = "An object with that name already exists";
const UPLOAD_CONFLICT =
   "The file changed or already exists. Refresh the folder and confirm the upload again.";

const SERVER_MOUNT = "/servers/:serverId";
const BUCKETS_PATH = "/buckets";
// middleware that runs before express strips the mount sees the raw path, so it matches any server id itself.
const underAnyServer = (...paths: readonly string[]): string =>
   `^${SERVER_MOUNT.replace(":serverId", "[^/]+")}(?:${paths.join("|")})`;

const S3_ROUTE_TIMEOUT_MS = MINUTE_MS;
const HEAD_CONCURRENCY = 16;
const CLEANUP_TIMEOUT_MS = 10 * SECOND_MS;
const STREAM_IDLE_TIMEOUT_MS = 2 * MINUTE_MS;
const ARCHIVE_MIN_BYTES_PER_SECOND = MIB;
const ARCHIVE_MS_PER_OBJECT = 500;
const ARCHIVE_DRAIN_FLOOR_FRACTION = 1 / 32;
// the web client runs three uploads in parallel over one uplink, so each sees a third of it.
const UPLOAD_FLOOR_BYTES_PER_SECOND = 128 * 1024;
// storage backpressure is tolerated at half the client floor; slow backends are not the abuse vector.
const STORAGE_FLOOR_BYTES_PER_SECOND = 64 * 1024;
const SLOT_MIN_LIFETIME_MS = 10 * MINUTE_MS;
const SLOT_MIN_BYTES_PER_SECOND = 256 * 1024;
const COPY_MIN_BYTES_PER_SECOND = 8 * MIB;
const copyWorkMs = (bytes: number): number =>
   (bytes / COPY_MIN_BYTES_PER_SECOND) * SECOND_MS;
// AbortSignal.timeout refuses a fractional delay, and most sizes are not whole MiB.
const copyDeadlineMs = (bytes: number): number =>
   Math.ceil(Math.max(S3_ROUTE_TIMEOUT_MS, copyWorkMs(bytes)));
const UPLOAD_PART_QUEUE_SIZE = 2;
const UPLOAD_ASSEMBLY_BUFFERS = 2;
const UPLOAD_BUFFERS_PER_UPLOAD =
   UPLOAD_PART_QUEUE_SIZE + UPLOAD_ASSEMBLY_BUFFERS;
const uploadMemoryFor = (partBytes: number): number =>
   UPLOAD_BUFFERS_PER_UPLOAD * partBytes;

export {
   ARCHIVE_DRAIN_FLOOR_FRACTION,
   ARCHIVE_MIN_BYTES_PER_SECOND,
   ARCHIVE_MS_PER_OBJECT,
   BUCKETS_PATH,
   CLEANUP_TIMEOUT_MS,
   HEAD_CONCURRENCY,
   MEMBER_NOT_FOUND,
   OBJECT_EXISTS,
   S3_ROUTE_TIMEOUT_MS,
   SERVER_MOUNT,
   SERVER_NOT_FOUND,
   SLOT_MIN_BYTES_PER_SECOND,
   SLOT_MIN_LIFETIME_MS,
   STORAGE_FLOOR_BYTES_PER_SECOND,
   STREAM_IDLE_TIMEOUT_MS,
   UPLOAD_BUFFERS_PER_UPLOAD,
   UPLOAD_CONFLICT,
   UPLOAD_FLOOR_BYTES_PER_SECOND,
   UPLOAD_PART_QUEUE_SIZE,
   copyDeadlineMs,
   copyWorkMs,
   underAnyServer,
   uploadMemoryFor,
};
