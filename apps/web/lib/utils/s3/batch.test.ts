import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
   success: vi.fn(),
   error: vi.fn(),
   walk: vi.fn(),
}));

vi.mock("@s3-viewer/ui/components/toast", () => ({
   toast: { success: h.success, error: h.error },
}));
vi.mock("./walk-prefix", () => ({ walkPrefix: h.walk }));

import { batchOutcome } from "@/components/Modals/batch-outcome";
import { ApiError, cancelledError } from "@/lib/api";
import { ErrorCode } from "@s3-viewer/types";
import {
   batchProgressSentence,
   type BatchSummary,
   isBatchComplete,
   reportBatchResult,
   runBatched,
   runPrefixBatches,
} from "./batch";

const LIMITED = "Your access to this bucket is limited to landing/";

type Target = { key: string; newKey?: string };

const targets = (count: number): Target[] =>
   Array.from({ length: count }, (_unused, index) => ({
      key: `photos/${index}.jpg`,
   }));

const allConfirmed = (batch: Target[]) => ({
   confirmed: new Set(batch.map(({ key }) => key)),
   failed: new Map<string, { message: string; retryable?: boolean }>(),
});

const run = (
   overrides: Partial<Parameters<typeof runBatched<Target, Target[]>>[0]> = {}
) =>
   runBatched<Target, Target[]>({
      targets: targets(2),
      targetId: ({ key }) => key,
      limit: 2,
      send: (batch) => Promise.resolve(batch),
      answer: allConfirmed,
      unconfirmedMessage: "Storage said nothing about this object.",
      ...overrides,
   });

beforeEach(() => {
   vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("running a bulk request in batches", () => {
   it("splits the targets by the batch limit and counts what landed", async () => {
      const send = vi.fn((batch: Target[]) => Promise.resolve(batch));
      const outcome = await run({ targets: targets(5), send });
      expect(send.mock.calls.map(([batch]) => batch.length)).toEqual([2, 2, 1]);
      expect(outcome).toEqual({
         done: 5,
         failed: [],
         unsent: [],
         listingError: null,
         remaining: false,
         aborted: false,
      });
   });

   it("sends a duplicated target once", async () => {
      const send = vi.fn((batch: Target[]) => Promise.resolve(batch));
      const one = { key: "photos/0.jpg" };
      const outcome = await run({ targets: [one, { ...one }], send });
      expect(send).toHaveBeenCalledWith([one]);
      expect(outcome.done).toBe(1);
   });

   it("treats silence about a target as unfinished, not as success", async () => {
      const outcome = await run({
         answer: () => ({
            confirmed: new Set(["photos/0.jpg"]),
            failed: new Map(),
         }),
      });
      expect(outcome.done).toBe(1);
      expect(outcome.failed).toEqual([
         {
            key: "photos/1.jpg",
            message: "Storage said nothing about this object.",
            retryable: false,
         },
      ]);
   });

   it("carries through what storage said about a target it refused", async () => {
      const outcome = await run({
         answer: () => ({
            confirmed: new Set(["photos/0.jpg"]),
            failed: new Map([
               ["photos/1.jpg", { message: "Try again.", retryable: true }],
            ]),
         }),
      });
      expect(outcome.failed).toEqual([
         { key: "photos/1.jpg", message: "Try again.", retryable: true },
      ]);
   });

   it("names a target the way storage answers about it", async () => {
      const outcome = await runBatched<Target, unknown>({
         targets: [{ key: "a.jpg", newKey: "b.jpg" }],
         targetId: ({ key, newKey }) => `${key}>${newKey}`,
         responseTargetName: ({ key }) => key,
         limit: 2,
         send: () => Promise.resolve(null),
         answer: () => ({ confirmed: new Set(["a.jpg"]), failed: new Map() }),
         unconfirmedMessage: "no answer",
      });
      expect(outcome.done).toBe(1);
   });

   it("fails every target in a batch the request never landed", async () => {
      const outcome = await run({
         send: () => Promise.reject(new ApiError(500, "Storage is down.")),
         transportFailureSuffix: "Refresh before trying again.",
      });
      expect(outcome.failed.map(({ message }) => message)).toEqual([
         "Storage is down. Refresh before trying again.",
         "Storage is down. Refresh before trying again.",
      ]);
   });

   it("raises a folder refusal once instead of failing every target", async () => {
      const refusal = new ApiError(403, LIMITED, ErrorCode.FOLDER_ACCESS);
      await expect(run({ send: () => Promise.reject(refusal) })).rejects.toBe(
         refusal
      );
   });

   it("keeps per-target accounting for a folder refusal after progress", async () => {
      const refusal = new ApiError(403, LIMITED, ErrorCode.FOLDER_ACCESS);
      const send = vi
         .fn<(batch: Target[]) => Promise<Target[]>>()
         .mockResolvedValueOnce(targets(2))
         .mockRejectedValueOnce(refusal);
      const outcome = await run({ targets: targets(3), send });
      expect(outcome.done).toBe(2);
      expect(outcome.failed).toEqual([
         { key: "photos/2.jpg", message: LIMITED, retryable: false },
      ]);
   });

   it("keeps what landed before the caller cancelled instead of throwing", async () => {
      const controller = new AbortController();
      const send = vi.fn((batch: Target[]) => {
         controller.abort();
         return Promise.resolve(batch);
      });
      const outcome = await run({
         targets: targets(4),
         send,
         signal: controller.signal,
      });
      expect(send).toHaveBeenCalledOnce();
      expect(outcome).toMatchObject({
         done: 2,
         aborted: true,
         remaining: true,
      });
   });

   it("hands back every target a cancel left unconfirmed so a retry resends it", async () => {
      const controller = new AbortController();
      const send = vi
         .fn<(batch: Target[]) => Promise<Target[]>>()
         .mockResolvedValueOnce(targets(2))
         .mockImplementationOnce(() => {
            controller.abort();
            return Promise.reject(cancelledError());
         });
      const outcome = await run({
         targets: targets(5),
         send,
         signal: controller.signal,
      });
      expect(send).toHaveBeenCalledTimes(2);
      expect(outcome).toMatchObject({ done: 2, failed: [], aborted: true });
      expect(outcome.unsent.map(({ key }) => key)).toEqual([
         "photos/2.jpg",
         "photos/3.jpg",
         "photos/4.jpg",
      ]);
      const { retryable, stuck } = batchOutcome({
         failed: [...outcome.failed, ...outcome.unsent],
      });
      expect(stuck).toBe(false);
      expect(retryable.map(({ key }) => key)).toEqual([
         "photos/2.jpg",
         "photos/3.jpg",
         "photos/4.jpg",
      ]);
   });
});

describe("reporting what a bulk run did", () => {
   const wording = {
      pastTenseVerb: "deleted",
      incomplete: "Deletion is incomplete",
   };

   it("says nothing when nothing was touched", () => {
      reportBatchResult({ done: 0, failed: [] }, wording);
      expect(h.success).not.toHaveBeenCalled();
      expect(h.error).not.toHaveBeenCalled();
   });

   it("still speaks up when nothing was touched but there is a note", () => {
      reportBatchResult(
         { done: 0, failed: [] },
         {
            ...wording,
            pastTenseVerb: "copied",
            successNote: "3 already existed.",
         }
      );
      expect(h.success).toHaveBeenCalledWith("0 objects copied.", {
         description: "3 already existed.",
      });
   });

   it("counts a clean run, and adds the note it was given", () => {
      reportBatchResult({ done: 1, failed: [] }, wording);
      expect(h.success).toHaveBeenLastCalledWith("1 object deleted.");
      reportBatchResult(
         { done: 4, failed: [] },
         { ...wording, successNote: "2 skipped." }
      );
      expect(h.success).toHaveBeenLastCalledWith("4 objects deleted.", {
         description: "2 skipped.",
      });
   });

   it("names the first failures, totals the rest and flags what is left", () => {
      reportBatchResult(
         { done: 1, failed: targets(5), remaining: true },
         wording
      );
      expect(h.error).toHaveBeenCalledWith("Deletion is incomplete", {
         description:
            "1 deleted, 5 failed: photos/0.jpg, photos/1.jpg, photos/2.jpg and 2 more. More objects remain.",
      });
   });

   it("reports the listing error instead when the walk itself broke", () => {
      reportBatchResult(
         { done: 2, failed: targets(1), listingError: "Storage went away." },
         wording
      );
      expect(h.error).toHaveBeenCalledWith("Deletion is incomplete", {
         description: "Storage went away.",
      });
   });
});

describe("walking a folder in batches", () => {
   it("reports a refused walk once, as whole sentences", async () => {
      h.walk.mockImplementation(async function* () {
         yield* [];
         throw new ApiError(403, LIMITED, ErrorCode.FOLDER_ACCESS);
      });
      const run = vi.fn();
      const summary = await runPrefixBatches({
         path: "/objects",
         prefix: "private/",
         incomplete: "Folder deletion is incomplete.",
         run,
      });
      expect(run).not.toHaveBeenCalled();
      expect(summary).toEqual({
         done: 0,
         failed: [],
         unsent: [],
         listingError: `${LIMITED}. Folder deletion is incomplete.`,
         remaining: true,
         aborted: false,
      });
      reportBatchResult(summary, {
         pastTenseVerb: "deleted",
         incomplete: "Deletion is incomplete",
      });
      expect(h.error).toHaveBeenCalledExactlyOnceWith(
         "Deletion is incomplete",
         {
            description: `${LIMITED}. Folder deletion is incomplete.`,
         }
      );
   });
});

describe("retrying a folder page that was only refused", () => {
   type Failure = { key: string; retryable: boolean; refused?: boolean };
   type Page = BatchSummary<Failure>;
   const page = (keys: string[], nextToken: string | null = null) => ({
      objects: keys.map((key) => ({ key, expectedETag: null, size: null })),
      nextToken,
   });
   const pages = (...listed: ReturnType<typeof page>[]) =>
      h.walk.mockImplementation(async function* () {
         yield* listed;
      });
   const answer = (done: number, failed: Failure[] = []): Page => ({
      done,
      failed,
      unsent: [],
      listingError: null,
      remaining: false,
      aborted: false,
   });
   const refused = (...keys: string[]) =>
      keys.map((key) => ({ key, retryable: true, refused: true }));
   const walk = (run: (listed: { objects: { key: string }[] }) => Page) => {
      const progress = { done: 0 };
      const sent: string[][] = [];
      const finished = runPrefixBatches<Failure>({
         path: "/objects",
         prefix: "photos/",
         incomplete: "Folder deletion is incomplete.",
         run: async (listed) => {
            sent.push(listed.objects.map(({ key }) => key));
            return run(listed);
         },
         onProgress: (done) => {
            progress.done = done;
         },
      });
      return { progress, sent, finished };
   };

   it("re-sends only the refused keys after a pause and then moves on", async () => {
      vi.useFakeTimers();
      pages(page(["photos/a", "photos/b"], "next"), page(["photos/c"]));
      const answers = [answer(1, refused("photos/b")), answer(1), answer(1)];
      const { progress, sent, finished } = walk(() => answers.shift()!);
      await vi.advanceTimersByTimeAsync(1999);
      expect(sent).toEqual([["photos/a", "photos/b"]]);
      expect(progress.done).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      const summary = await finished;
      expect(sent).toEqual([
         ["photos/a", "photos/b"],
         ["photos/b"],
         ["photos/c"],
      ]);
      expect(summary).toEqual(answer(3));
   });

   it("waits out a refusal even when nothing in the run has gone through yet", async () => {
      vi.useFakeTimers();
      pages(page(["photos/a", "photos/b"]));
      const answers = [answer(0, refused("photos/a", "photos/b")), answer(2)];
      const { sent, finished } = walk(() => answers.shift()!);
      await vi.advanceTimersByTimeAsync(2000);
      const summary = await finished;
      expect(sent).toEqual([
         ["photos/a", "photos/b"],
         ["photos/a", "photos/b"],
      ]);
      expect(summary).toEqual(answer(2));
   });

   it("stops at once on failures storage itself reported as retryable", async () => {
      pages(page(["photos/a", "photos/b"], "next"), page(["photos/c"]));
      const failed = [{ key: "photos/b", retryable: true }];
      const { sent, finished } = walk(() => answer(1, failed));
      const summary = await finished;
      expect(sent).toEqual([["photos/a", "photos/b"]]);
      expect(summary).toEqual({ ...answer(1, failed), remaining: true });
   });

   it("stops at once when any failure needs a review", async () => {
      pages(page(["photos/a", "photos/b", "photos/c"]));
      const failed = [
         ...refused("photos/b"),
         { key: "photos/c", retryable: false },
      ];
      const { sent, finished } = walk(() => answer(1, failed));
      const summary = await finished;
      expect(sent).toHaveLength(1);
      expect(summary).toEqual({ ...answer(1, failed), remaining: true });
   });

   it("gives up after about a minute of waiting on one page", async () => {
      vi.useFakeTimers();
      pages(page(["photos/a", "photos/b"]));
      const { sent, finished } = walk(({ objects }) =>
         answer(objects.length - 1, refused("photos/b"))
      );
      await vi.advanceTimersByTimeAsync(61_999);
      expect(sent).toHaveLength(5);
      await vi.advanceTimersByTimeAsync(1);
      const summary = await finished;
      expect(sent).toHaveLength(6);
      expect(summary).toEqual({
         ...answer(1, refused("photos/b")),
         remaining: true,
      });
   });

   it("starts the wait budget over once a refused page goes through", async () => {
      vi.useFakeTimers();
      pages(
         page(["photos/a", "photos/b"], "two"),
         page(["photos/c", "photos/d"])
      );
      const answers = [
         answer(1, refused("photos/b")),
         answer(0, refused("photos/b")),
         answer(1),
         answer(1, refused("photos/d")),
         answer(1),
      ];
      const { sent, finished } = walk(() => answers.shift()!);
      await vi.advanceTimersByTimeAsync(2000 + 4000);
      expect(sent).toHaveLength(4);
      await vi.advanceTimersByTimeAsync(1999);
      expect(sent).toHaveLength(4);
      await vi.advanceTimersByTimeAsync(1);
      const summary = await finished;
      expect(sent.at(-1)).toEqual(["photos/d"]);
      expect(summary).toEqual(answer(4));
   });
});

describe("summing up a batch for a dialog", () => {
   it("is complete only with no failures, no listing error and nothing left", () => {
      expect(isBatchComplete({ failed: [] })).toBe(true);
      expect(
         isBatchComplete({ failed: [], listingError: null, remaining: false })
      ).toBe(true);
      expect(isBatchComplete({ failed: [{}] })).toBe(false);
      expect(isBatchComplete({ failed: [], listingError: "Stopped." })).toBe(
         false
      );
      expect(isBatchComplete({ failed: [], remaining: true })).toBe(false);
   });

   it("joins the lead, the extra, the failures and what is left", () => {
      expect(batchProgressSentence("Moved 3", 0, false)).toBe("Moved 3.");
      expect(batchProgressSentence("Moved 3", 1200, true)).toBe(
         `Moved 3; ${(1200).toLocaleString()} failed; more remain.`
      );
      expect(
         batchProgressSentence("Copied 3", 2, true, "4 already there")
      ).toBe("Copied 3; 4 already there; 2 failed; more remain.");
      expect(batchProgressSentence("Copied 3", 0, false, null)).toBe(
         "Copied 3."
      );
   });
});
