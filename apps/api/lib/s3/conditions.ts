import type { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { UPLOAD_CONFLICT } from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { throwHttpError } from "./errors";
import { describeFailure, isConflict } from "./failure";
import type { S3Scope } from "./listing";
import { headIfExists } from "./head";

// endpoints that check the condition on initiation refuse with a bare 409.
const uploadConflict = (error: unknown): boolean =>
   isConflict(error) || describeFailure(error).httpStatus === 409;

const uploadConflictError = (): ApiHttpError =>
   new ApiHttpError(409, UPLOAD_CONFLICT);

const conflictAs =
   (
      conflict: () => ApiHttpError,
      matches: (error: unknown) => boolean = isConflict
   ) =>
   (error: unknown): never => {
      if (matches(error)) throw conflict();
      return throwHttpError(error);
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
   if (await objectPresent(scope, key)) throw new ApiHttpError(409, message);
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
   assertDestinationAbsent,
   conditionalInitiation,
   conditionHeaders,
   conflictAs,
   enforcesConditions,
   objectPresent,
   onBuild,
   uploadConflict,
   uploadConflictError,
   withRequestHeaders,
   writeCondition,
};
export type { WriteCondition };
