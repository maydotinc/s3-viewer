import {
   GetObjectLegalHoldCommand,
   GetObjectLockConfigurationCommand,
   GetObjectRetentionCommand,
   S3ServiceException,
   type ObjectLockConfiguration,
   type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { ApiHttpError } from "../http";
import { throwHttpError } from "./errors";
import type { S3Scope } from "./listing";

type ObjectLockAttributes = Pick<
   PutObjectCommandInput,
   "ObjectLockMode" | "ObjectLockRetainUntilDate" | "ObjectLockLegalHoldStatus"
>;
type ObjectLockIdentity = { Key: string; VersionId?: string };
type ObjectLockSnapshot = {
   configuration: ObjectLockConfiguration | null;
   attributes: ObjectLockAttributes;
};

const cannotVerify = (): never => {
   throw new ApiHttpError(
      409,
      "The object's retention and legal hold settings could not be verified. No objects were changed."
   );
};
const validMode = (mode: unknown): mode is "GOVERNANCE" | "COMPLIANCE" =>
   mode === "GOVERNANCE" || mode === "COMPLIANCE";

// HEAD omits retention/legal-hold fields when the caller cannot read them.
// Their absence is never proof that an object is unlocked.
const readObjectLockSnapshot = async (
   { client, bucket, signal }: S3Scope,
   identity: ObjectLockIdentity
): Promise<ObjectLockSnapshot> => {
   const options = { abortSignal: signal };
   const out = await client
      .send(new GetObjectLockConfigurationCommand({ Bucket: bucket }), options)
      .catch((error: unknown) => {
         if (
            error instanceof S3ServiceException &&
            error.name === "ObjectLockConfigurationNotFoundError" &&
            error.$metadata.httpStatusCode === 404
         )
            return null;
         return throwHttpError(error);
      });
   if (out === null) return { configuration: null, attributes: {} };
   const configuration = out.ObjectLockConfiguration;
   if (!configuration || configuration.ObjectLockEnabled !== "Enabled")
      return cannotVerify();
   if (configuration.Rule !== undefined) {
      const defaults = configuration.Rule.DefaultRetention;
      if (!defaults || !validMode(defaults.Mode)) return cannotVerify();
      const { Days: days, Years: years } = defaults;
      const duration = days ?? years;
      if (
         (days !== undefined && years !== undefined) ||
         !Number.isSafeInteger(duration) ||
         duration === undefined ||
         duration <= 0
      )
         return cannotVerify();
   }
   const request = {
      Bucket: bucket,
      Key: identity.Key,
      ...(identity.VersionId !== undefined && {
         VersionId: identity.VersionId,
      }),
   };
   const { Retention: retention } = await client
      .send(new GetObjectRetentionCommand(request), options)
      .catch(throwHttpError);
   if (!retention || typeof retention !== "object") return cannotVerify();
   const { Mode: mode, RetainUntilDate: until } = retention;
   if (
      (mode !== undefined || until !== undefined) &&
      (!validMode(mode) ||
         !(until instanceof Date) ||
         !Number.isFinite(until.getTime()))
   )
      return cannotVerify();
   const { LegalHold: legalHold } = await client
      .send(new GetObjectLegalHoldCommand(request), options)
      .catch(throwHttpError);
   if (legalHold?.Status !== "ON" && legalHold?.Status !== "OFF")
      return cannotVerify();
   return {
      configuration,
      attributes: {
         ...(mode !== undefined && {
            ObjectLockMode: mode,
            ObjectLockRetainUntilDate: until,
         }),
         ObjectLockLegalHoldStatus: legalHold.Status,
      },
   };
};

const readObjectLockSettings = async (
   scope: S3Scope,
   identity: ObjectLockIdentity
): Promise<ObjectLockAttributes> =>
   (await readObjectLockSnapshot(scope, identity)).attributes;

export { readObjectLockSettings, readObjectLockSnapshot };
export type { ObjectLockAttributes, ObjectLockIdentity, ObjectLockSnapshot };
