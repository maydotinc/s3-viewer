import type { AuditAction } from "@s3-viewer/types";
import { APIError, type getSessionFromCtx } from "better-auth/api";
import { emitAuthEvent } from "./audit";
import { describeFailure, normalizeEmail } from "./utils";

type EventContext = Parameters<typeof getSessionFromCtx>[0];

// `auditActorId` is what the before hook returned; `returned` is the endpoint
// result better auth stores before it runs the after hooks, and is missing
// from the context type the middleware helpers expose
type AuditContext = {
   auditActorId?: string | undefined;
   returned?: unknown;
};

const SESSION_REVOKE_PATHS = new Set([
   "/revoke-session",
   "/revoke-sessions",
   "/revoke-other-sessions",
]);

const bodyEmail = (ctx: EventContext): string | null => {
   const email = (ctx.body as { email?: unknown } | undefined)?.email;
   return typeof email === "string" ? normalizeEmail(email) : null;
};

const contextOf = (ctx: EventContext): AuditContext =>
   ctx.context as typeof ctx.context & AuditContext;

const actorOf = (ctx: EventContext): string | null =>
   ctx.context.newSession?.user.id ??
   ctx.context.session?.user.id ??
   contextOf(ctx).auditActorId ??
   null;

// `/sign-out` deletes the session row before any after hook can read it, so
// the owner has to be resolved while the cookie still points at something
const captureAuditActor = async (
   ctx: EventContext
): Promise<string | undefined> => {
   if (ctx.path !== "/sign-out") return undefined;
   const token = await ctx.getSignedCookie(
      ctx.context.authCookies.sessionToken.name,
      ctx.context.secret
   );
   if (!token) return undefined;
   const existing = await ctx.context.internalAdapter.findSession(token);
   return existing?.user.id;
};

const record = (
   action: AuditAction,
   actorId: string | null,
   target: string | null
): void => emitAuthEvent({ action, actorId, target });

const recordSignIn = (ctx: EventContext, provider: string): void => {
   const actorId = actorOf(ctx);
   if (actorId) record("auth.sign_in", actorId, provider);
};

// the attempted address is never stored: a failed sign-in is only worth a row
// when it names an account someone can be shown it against, and persisting a
// raw address would keep the typo'd and probed ones forever too. the lookup
// is a side effect of a request that has already answered, so it can only log
const recordSignInFailure = (ctx: EventContext): void => {
   const email = bodyEmail(ctx);
   if (!email) return;
   void ctx.context.internalAdapter
      .findUserByEmail(email)
      .then((found) => {
         if (found) record("auth.sign_in_failed", found.user.id, "password");
      })
      .catch((error: unknown) => {
         console.error(
            `[auth] failed sign-in lookup: ${describeFailure(error)}`
         );
      });
};

const SIMPLE_EVENTS: Readonly<Record<string, AuditAction>> = {
   "/sign-out": "auth.sign_out",
   "/change-password": "auth.password_change",
};

// runs after the endpoint, including when it threw: better auth turns an
// endpoint APIError into the response before the after hooks see it
const recordAuthEvent = (ctx: EventContext): void => {
   const failed = contextOf(ctx).returned instanceof APIError;
   if (ctx.path === "/sign-in/email") {
      if (failed) recordSignInFailure(ctx);
      else recordSignIn(ctx, "password");
      return;
   }
   // an oauth callback always ends in a redirect, so only a new session tells
   // a completed sign-in from a rejected one
   if (ctx.path === "/callback/:id") {
      const provider = (ctx.params as { id?: string } | undefined)?.id;
      if (provider && ctx.context.newSession) recordSignIn(ctx, provider);
      return;
   }
   if (failed) return;
   if (SESSION_REVOKE_PATHS.has(ctx.path)) {
      record("auth.sessions_revoked", actorOf(ctx), null);
      return;
   }
   const action = Object.hasOwn(SIMPLE_EVENTS, ctx.path)
      ? SIMPLE_EVENTS[ctx.path]
      : undefined;
   if (action) record(action, actorOf(ctx), null);
};

export { captureAuditActor, recordAuthEvent };
