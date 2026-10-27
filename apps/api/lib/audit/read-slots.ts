import { ApiHttpError, rateLimited } from "@/lib/http";
import {
   keyedSlots,
   type Release,
   type SlotClaim,
} from "@/lib/utils/keyed-slots";
import { SECOND_MS } from "@s3-viewer/shared";

// each read pins a pooled connection until its query or transaction timeout, so audit keeps most of the pool free.
const READ_CONCURRENCY = 4;
// exports never fill the last slot, so a burst of slow downloads cannot shut every search out.
const EXPORT_READ_CONCURRENCY = READ_CONCURRENCY - 1;
// aborting a request does not cancel its query, so quick filter changes from one person pile up.
const USER_READ_CONCURRENCY = 2;
// outlives the statement timeout so Postgres cancels the query before Prisma gives up.
const SEARCH_TRANSACTION_MS = 10 * SECOND_MS;

const readSlots = keyedSlots();
const waitingExports: ((release: Release) => void)[] = [];

const readsBusy = (): ApiHttpError =>
   rateLimited("Too many audit log reads are running. Try again shortly.");

const searchesBusy = (): ApiHttpError =>
   rateLimited(
      "Your earlier audit searches or integrity check are still running. Try again shortly."
   );

const ANY_READ: SlotClaim = ["all", READ_CONCURRENCY, readsBusy];
const EXPORT_READ: readonly SlotClaim[] = [
   ANY_READ,
   ["export", EXPORT_READ_CONCURRENCY, readsBusy],
];

// a freed slot passes straight to a waiting export, so a search arriving in between cannot take it.
const handOver = (): void => {
   const next = waitingExports[0];
   if (!next) return;
   const release = readSlots.tryAcquire(EXPORT_READ, handOver);
   if (!release) return;
   waitingExports.shift();
   next(release);
};

const waitForRead = (): Promise<Release> =>
   new Promise((resolve, reject) => {
      const turn = (release: Release) => {
         clearTimeout(timer);
         resolve(release);
      };
      const timer = setTimeout(() => {
         waitingExports.splice(waitingExports.indexOf(turn), 1);
         reject(readsBusy());
      }, SEARCH_TRANSACTION_MS);
      waitingExports.push(turn);
   });

// an export has already sent its headers, so its batches queue where a search fails fast.
const enterRead = async (
   exporting: boolean,
   reader?: string
): Promise<Release> => {
   if (exporting)
      return readSlots.tryAcquire(EXPORT_READ, handOver) ?? waitForRead();
   return readSlots.acquire(
      [
         reader
            ? [`reader:${reader}`, USER_READ_CONCURRENCY, searchesBusy]
            : undefined,
         ANY_READ,
      ],
      handOver
   );
};

export { SEARCH_TRANSACTION_MS, enterRead };
