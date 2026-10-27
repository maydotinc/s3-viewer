import { asyncHandler } from "@/lib/http";
import { AccessDeniedError, type Denial } from "./access-denied";
import {
   assertInFolders,
   authorize,
   authorizeAudit,
   getAuth,
   type AuthorizeOptions,
} from "./authorize";
import { requireExpectedUser } from "./expected-user";
import { isSameSite } from "./origin";
import { input, validate } from "./validate";
import { recentlySeen, writeAudit } from "@/lib/audit/writer";
import { Permission } from "@s3-viewer/permissions";
import type {
   ErrorRequestHandler,
   Request,
   RequestHandler,
   Response,
} from "express";
import type { TypeOf, ZodTypeAny } from "zod";

type Handler<T> = (req: Request, res: Response, input: T) => Promise<unknown>;

const handle = <S extends ZodTypeAny>(
   handler: Handler<TypeOf<S>>
): RequestHandler =>
   asyncHandler((req, res) => handler(req, res, input<TypeOf<S>>(res)));

// entry.bucket is null for names the server doesn't hold, so guessed names still share one key.
const denialKey = (
   { actorId, serverId, entry }: Denial,
   unverifiedOrigin: boolean
): string =>
   `${actorId}:${serverId}:${entry.detail.permission}:${entry.detail.reason}:${entry.bucket ?? "-"}${unverifiedOrigin ? ":unverified" : ""}`;

// a denial never fails its request, and a repeat within the window is not written again.
const recordDenial = (
   denial: Denial,
   email: string,
   unverifiedOrigin = false
): Promise<void> => {
   if (recentlySeen(denialKey(denial, unverifiedOrigin)))
      return Promise.resolve();
   const { actorId, entry, ...scope } = denial;
   return writeAudit({
      ...scope,
      entry: unverifiedOrigin
         ? { ...entry, detail: { ...entry.detail, unverifiedOrigin } }
         : entry,
      actor: { id: actorId, email },
   }).catch(() => undefined);
};

const READ_METHODS = new Set(["GET", "HEAD"]);

const recordDenials: ErrorRequestHandler = (err, req, _res, next) => {
   if (!(err instanceof AccessDeniedError)) {
      next(err);
      return;
   }
   void recordDenial(
      err.denial,
      req.user?.email ?? "",
      READ_METHODS.has(req.method) && !isSameSite(req)
   )
      .finally(() => next(err))
      .catch(() => undefined);
};

const validatedRoute = <S extends ZodTypeAny>(
   schema: S,
   handler: Handler<TypeOf<S>>
): RequestHandler[] => [validate(schema), handle<S>(handler)];

const guarded = <S extends ZodTypeAny>(
   permission: Permission,
   options: AuthorizeOptions,
   schema: S,
   handler: Handler<TypeOf<S>>
): RequestHandler[] => [
   validate(schema),
   authorize(permission, options),
   handle<S>(handler),
];

const serverRoute = <S extends ZodTypeAny>(
   permission: Permission,
   schema: S,
   handler: Handler<TypeOf<S>>,
   { credentials = true }: { credentials?: boolean } = {}
): RequestHandler[] =>
   guarded(permission, { scope: "server", credentials }, schema, handler);

type Paths<T> = (input: T) => readonly string[];

// "" is outside every folder, so limited members are refused.
const wholeBucket: Paths<unknown> = () => [""];
const foldersCheckedInHandler: Paths<unknown> = () => [];
const byObjectKey: Paths<{ objectKey: string }> = ({ objectKey }) => [
   objectKey,
];

const bucketRoute = <S extends ZodTypeAny>(
   permission: Permission,
   schema: S,
   paths: Paths<TypeOf<S>>,
   handler: Handler<TypeOf<S>>
): RequestHandler[] =>
   guarded(permission, { scope: "bucket" }, schema, (req, res, input) => {
      const { bucketName, expectedUserId } = input as {
         bucketName: string;
         expectedUserId?: unknown;
      };
      if (typeof expectedUserId === "string")
         requireExpectedUser(res, expectedUserId);
      assertInFolders(getAuth(res), bucketName, permission, paths(input));
      return handler(req, res, input);
   });

const memberRoute = <S extends ZodTypeAny>(
   schema: S,
   handler: Handler<TypeOf<S>>
): RequestHandler[] =>
   serverRoute(Permission.MANAGE_MEMBERS, schema, handler, {
      credentials: false,
   });

const auditRoute = <S extends ZodTypeAny>(
   kind: "view" | "manage",
   schema: S,
   handler: Handler<TypeOf<S>>
): RequestHandler[] => [
   validate(schema),
   authorizeAudit(kind),
   handle<S>(handler),
];

export {
   auditRoute,
   bucketRoute,
   byObjectKey,
   foldersCheckedInHandler,
   memberRoute,
   recordDenial,
   recordDenials,
   serverRoute,
   validatedRoute,
   wholeBucket,
};
