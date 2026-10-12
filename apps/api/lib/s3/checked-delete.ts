import {
   DeleteObjectCommand,
   DeleteObjectsCommand,
   type DeleteObjectsCommandOutput,
} from "@aws-sdk/client-s3";
import {
   S3_MAX_KEYS_PER_REQUEST,
   chunk,
   mapLimit,
   type S3DeleteResult,
   type S3DeleteTarget,
} from "@s3-viewer/types";
import { HEAD_CONCURRENCY } from "@/lib/constants";
import { classifyS3Error, deleteFailureMessage } from "./classify";
import { onBuild } from "./conditions";
import { refusedFailure } from "./errors";
import { isConflict, isConflictCode } from "./failure";
import { sendHead } from "./head";
import type { S3Scope } from "./listing";
import { requiresIndividualDelete } from "./keys";

type DeleteFailure = S3DeleteResult["failed"][number];
type Outcome = { key: string; failure?: DeleteFailure; gone?: true };
type DeleteTarget = { key: string; expectedETag?: string };

type DeleteAnswer =
   | { kind: "deleted" }
   | { kind: "unconfirmed" }
   | { kind: "error"; code: string | undefined; deletionReported: boolean };

const deleteResponse = (
   response: Pick<DeleteObjectsCommandOutput, "Deleted" | "Errors">
): ((key: string) => DeleteAnswer) => {
   const deleted = new Set((response.Deleted ?? []).map(({ Key }) => Key));
   const errors = new Map(
      (response.Errors ?? []).map(({ Key, Code }) => [Key, Code])
   );
   return (key) => {
      if (errors.has(key)) {
         return {
            kind: "error",
            code: errors.get(key),
            deletionReported: deleted.has(key),
         };
      }
      return { kind: deleted.has(key) ? "deleted" : "unconfirmed" };
   };
};

const UNCONFIRMED =
   "Deletion was not confirmed. Refresh and check this object before trying again.";
// a request that may have removed the object leaves the audit log unable to say it did not.
const isUnconfirmed = ({ message }: DeleteFailure): boolean =>
   message === UNCONFIRMED;

const THROTTLED = "Storage is throttling requests. Try again shortly.";
const THROTTLE_CODES: ReadonlySet<string> = new Set([
   "SlowDown",
   "ServiceUnavailable",
   "Throttling",
   "ThrottlingException",
   "RequestLimitExceeded",
   "TooManyRequests",
   "TooManyRequestsException",
   "RequestThrottled",
]);

const throttleFailure = (
   key: string,
   code: string | undefined,
   signal: AbortSignal | undefined
): DeleteFailure | undefined =>
   !signal?.aborted && THROTTLE_CODES.has(code ?? "")
      ? { key, message: THROTTLED, retryable: true }
      : undefined;

const sentMarker = <T extends { middlewareStack: unknown }>(
   command: T
): (() => boolean) => {
   let sent = false;
   onBuild(command, "sentMarker", () => {
      sent = true;
   });
   return () => sent;
};

const objectMissing = (error: unknown): boolean => {
   const { status, name } = classifyS3Error(error);
   return status === 404 && name !== "NoSuchBucket";
};

const deleteRequestFailure = (
   error: unknown,
   key: string,
   deleteSent: boolean,
   signal: AbortSignal | undefined
): DeleteFailure => {
   const refused =
      deleteSent || signal?.aborted ? undefined : refusedFailure(error, key);
   if (refused) return refused;
   const { status, message, name } = classifyS3Error(error);
   const throttled = throttleFailure(key, name, signal);
   if (throttled) return throttled;
   return {
      key,
      message: isConflict(error)
         ? deleteFailureMessage("PreconditionFailed")
         : deleteSent && (signal?.aborted || status >= 500 || status === 404)
           ? UNCONFIRMED
           : signal?.aborted
             ? "Deletion was cancelled. Refresh and check this object before trying again."
             : message,
      retryable: false,
   };
};

const outcomeFor = (
   error: unknown,
   key: string,
   deleteSent: boolean,
   signal: AbortSignal | undefined
): Outcome =>
   objectMissing(error)
      ? { key, gone: true }
      : { key, failure: deleteRequestFailure(error, key, deleteSent, signal) };

const headCheckedObject = async (
   scope: S3Scope,
   { key, expectedETag }: S3DeleteTarget
): Promise<Outcome | undefined> => {
   const { signal } = scope;
   try {
      signal?.throwIfAborted();
      const head = await sendHead(scope, key, expectedETag ?? undefined);
      if (expectedETag !== null && head.ETag !== expectedETag)
         return {
            key,
            failure: {
               key,
               message: deleteFailureMessage("PreconditionFailed"),
               retryable: false,
            },
         };
      signal?.throwIfAborted();
      return undefined;
   } catch (error) {
      return outcomeFor(error, key, false, signal);
   }
};

const deleteExactKey = async (
   { client, bucket, signal }: S3Scope,
   key: string,
   expectedETag?: string
): Promise<Outcome> => {
   const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(expectedETag === undefined ? {} : { IfMatch: expectedETag }),
   });
   const sent = sentMarker(command);
   try {
      signal?.throwIfAborted();
      await client.send(command, { abortSignal: signal });
      return { key };
   } catch (error) {
      return outcomeFor(error, key, sent(), signal);
   }
};

const answerOutcome = (
   key: string,
   answer: DeleteAnswer,
   signal: AbortSignal | undefined
): Outcome => {
   if (answer.kind === "deleted") return { key };
   if (answer.kind === "unconfirmed")
      return { key, failure: { key, message: UNCONFIRMED, retryable: false } };
   const throttled = answer.deletionReported
      ? undefined
      : throttleFailure(key, answer.code, signal);
   if (throttled) return { key, failure: throttled };
   const error = { name: answer.code ?? "Unknown" };
   const outcome = outcomeFor(error, key, true, signal);
   return outcome.failure
      ? {
           key,
           failure: {
              ...outcome.failure,
              retryable:
                 !answer.deletionReported &&
                 !signal?.aborted &&
                 !isConflictCode(answer.code) &&
                 classifyS3Error(error).status < 500,
           },
        }
      : outcome;
};

const sendDeleteObjects = async (
   { client, bucket, signal }: S3Scope,
   targets: readonly DeleteTarget[]
): Promise<Outcome[]> => {
   const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
         Objects: targets.map(({ key, expectedETag }) => ({
            Key: key,
            ETag: expectedETag?.slice(1, -1),
         })),
         Quiet: false,
      },
   });
   const sent = sentMarker(command);
   try {
      signal?.throwIfAborted();
      const answerFor = deleteResponse(
         await client.send(command, { abortSignal: signal })
      );
      return targets.map(({ key }) =>
         answerOutcome(key, answerFor(key), signal)
      );
   } catch (error) {
      return targets.map(({ key }) => ({
         key,
         failure: deleteRequestFailure(error, key, sent(), signal),
      }));
   }
};

const DELETE_CONCURRENCY = HEAD_CONCURRENCY;

const deleteTargets = async (
   scope: S3Scope,
   targets: readonly DeleteTarget[]
): Promise<Outcome[]> => {
   const individual: DeleteTarget[] = [];
   const batched: DeleteTarget[] = [];
   for (const target of targets) {
      if (requiresIndividualDelete(target.key)) individual.push(target);
      else batched.push(target);
   }
   const outcomes = await mapLimit(
      individual,
      DELETE_CONCURRENCY,
      ({ key, expectedETag }) => deleteExactKey(scope, key, expectedETag)
   );
   for (const batch of chunk(batched, S3_MAX_KEYS_PER_REQUEST)) {
      outcomes.push(...(await sendDeleteObjects(scope, batch)));
   }
   return outcomes;
};

const deleteCheckedKeys = async (
   scope: S3Scope,
   objects: readonly S3DeleteTarget[]
): Promise<Outcome[]> => {
   const checked = await mapLimit(objects, HEAD_CONCURRENCY, (object) =>
      headCheckedObject(scope, object)
   );
   return [
      ...checked.filter((outcome) => outcome !== undefined),
      ...(await deleteTargets(
         scope,
         objects.flatMap(({ key }, index) => (checked[index] ? [] : [{ key }]))
      )),
   ];
};

export {
   deleteCheckedKeys,
   deleteRequestFailure,
   deleteTargets,
   isUnconfirmed,
   objectMissing,
};
export type { Outcome };
