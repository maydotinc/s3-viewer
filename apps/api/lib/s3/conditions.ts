import type { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/shared";
import { UPLOAD_CONFLICT } from "@/lib/constants";
import { storageFailure } from "./classify";
import { StorageError } from "./errors";
import { describeFailure, isConflict } from "./failure";
import type { S3Scope } from "./listing";
import { headIfExists } from "./head";

// endpoints that check the condition on initiation refuse with a bare 409.
const isUploadConflict = (error: unknown): boolean =>
   isConflict(error) || describeFailure(error).httpStatus === 409;

const uploadConflict = (): StorageError =>
   new StorageError("conflict", UPLOAD_CONFLICT);

const conflictAs =
   (conflict: () => Error, matches: (error: unknown) => boolean = isConflict) =>
   (error: unknown): never => {
      if (matches(error)) throw conflict();
      throw storageFailure(error);
   };

const enforcesConditions = (provider: Provider): boolean =>
   provider === Provider.S3 || provider === Provider.R2;

const objectPresent = async (scope: S3Scope, key: string): Promise<boolean> =>
   (await headIfExists(scope, key)) !== null;

const assertDestinationAbsent = async (
   scope: S3Scope,
   key: string,
   message: string
): Promise<void> => {
   if (await objectPresent(scope, key))
      throw new StorageError("conflict", message);
};

type WriteCondition = { IfNoneMatch: "*" } | { IfMatch: string };

const writeCondition = (expectedETag: string | undefined): WriteCondition =>
   expectedETag === undefined
      ? { IfNoneMatch: "*" }
      : { IfMatch: expectedETag };

type Headers = Record<string, string>;
type BuildArgs = { request: unknown };
type BuildStack = {
   add: (
      middleware: (
         next: (args: BuildArgs) => Promise<unknown>
      ) => (args: BuildArgs) => Promise<unknown>,
      options: { step: "build"; name: string }
   ) => void;
};

const onBuild = <T extends { middlewareStack: unknown }>(
   command: T,
   name: string,
   run: (request: unknown) => void
): T => {
   (command.middlewareStack as unknown as BuildStack).add(
      (next) => (args) => {
         run(args.request);
         return next(args);
      },
      { step: "build", name }
   );
   return command;
};

// set once the request is built, past every local admission check.
const sentMarker = <T extends { middlewareStack: unknown }>(
   command: T
): (() => boolean) => {
   let sent = false;
   onBuild(command, "sentMarker", () => {
      sent = true;
   });
   return () => sent;
};

class UnconfirmedWriteError extends StorageError {
   constructor() {
      super(
         "upstream",
         "Storage may have completed this change. Refresh and check before trying again."
      );
   }
}

// storage keeps acting on a write it received even when the caller stops waiting, so a sent write
// with no definite answer (an abort, a dropped connection or a 5xx) is unconfirmed rather than failed.
const unconfirmedAfter = (sent: boolean, error: unknown): boolean => {
   const { httpStatus } = describeFailure(error);
   return sent && (httpStatus === undefined || httpStatus >= 500);
};

const unconfirmedOnceSent = <T extends { middlewareStack: unknown }>(
   command: T
): ((error: unknown) => unknown) => {
   const sent = sentMarker(command);
   return (error) =>
      unconfirmedAfter(sent(), error) ? new UnconfirmedWriteError() : error;
};

const withRequestHeaders = <T extends { middlewareStack: unknown }>(
   command: T,
   headers: Headers
): T =>
   Object.keys(headers).length === 0
      ? command
      : onBuild(command, "conditionHeaders", (request) => {
           Object.assign((request as { headers: Headers }).headers, headers);
        });

const conditionHeaders = (condition: WriteCondition): Headers =>
   "IfMatch" in condition
      ? { "if-match": condition.IfMatch }
      : { "if-none-match": "*" };

const conditionalInitiation = (
   command: CreateMultipartUploadCommand,
   condition: WriteCondition
): void => {
   withRequestHeaders(command, conditionHeaders(condition));
};

export {
   UnconfirmedWriteError,
   assertDestinationAbsent,
   conditionalInitiation,
   conditionHeaders,
   conflictAs,
   enforcesConditions,
   isUploadConflict,
   objectPresent,
   sentMarker,
   unconfirmedAfter,
   unconfirmedOnceSent,
   uploadConflict,
   withRequestHeaders,
   writeCondition,
};
export type { WriteCondition };
