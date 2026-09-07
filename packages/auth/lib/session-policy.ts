import {
   DAY_MS,
   HOUR_MS,
   SESSION_ABSOLUTE_TTL_DAYS,
   SESSION_FRESH_HOURS,
   deleteAccountSchema,
} from "@s3-viewer/types";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { normalizeEmail } from "./utils";

const ABSOLUTE_TTL_MS = SESSION_ABSOLUTE_TTL_DAYS * DAY_MS;
const FRESH_SESSION_MS = SESSION_FRESH_HOURS * HOUR_MS;

// This runs for HTTP and auth.api calls before any endpoint can refresh or
// consume the session. Revoke the row, not merely its cookie: replaying an old
// cookie must never renew it. Continue without it so sign-in and sign-out work.
type SessionPolicyContext = Parameters<typeof getSessionFromCtx>[0];

// Reuse the caller's context directly: wrapping this in another auth middleware
// would put cookie-clearing headers in an ignored nested middleware result.
const enforceSessionPolicy = async (
   ctx: SessionPolicyContext
): Promise<boolean> => {
   let expired = false;
   const token = await ctx.getSignedCookie(
      ctx.context.authCookies.sessionToken.name,
      ctx.context.secret
   );
   if (token) {
      const existing = await ctx.context.internalAdapter.findSession(token);
      if (existing) {
         const createdAt = new Date(existing.session.createdAt).getTime();
         if (
            !Number.isFinite(createdAt) ||
            Date.now() - createdAt >= ABSOLUTE_TTL_MS
         ) {
            await ctx.context.internalAdapter.deleteSession(token);
            ctx.context.session = null;
            expired = true;
            deleteSessionCookie(ctx);
         }
      }
   }

   // This application uses a fresh session and a typed confirmation, never a
   // token callback. Keep that alternate deletion entry point closed.
   if (ctx.path === "/delete-user/callback") {
      throw new APIError("NOT_FOUND", { message: "Not found" });
   }
   if (ctx.path !== "/delete-user") return expired;

   // Better Auth's before hook receives the original body before its built-in
   // endpoint schema strips extra fields. Check the binding here so calling
   // /auth/delete-user directly cannot bypass the application's confirmation.
   const confirmation = deleteAccountSchema.safeParse(ctx.body);
   if (!confirmation.success) {
      throw new APIError("BAD_REQUEST", {
         message:
            "Confirm the account ID, email and password before deleting your account.",
         code: "ACCOUNT_CONFIRMATION_REQUIRED",
      });
   }
   const current = await getSessionFromCtx(ctx, {
      disableCookieCache: true,
      disableRefresh: true,
   });
   if (!current) {
      throw new APIError("UNAUTHORIZED", {
         message: "Sign in required",
         code: "UNAUTHORIZED",
      });
   }
   if (
      confirmation.data.expectedUserId !== current.user.id ||
      confirmation.data.confirmedEmail !== normalizeEmail(current.user.email)
   ) {
      throw new APIError("CONFLICT", {
         message:
            "Your account changed. Reopen the deletion dialog and confirm again.",
         code: "ACCOUNT_CHANGED",
      });
   }
   // Apply freshness even if a caller supplies a password or deletion token;
   // neither is an alternate way around the application's confirmation flow.
   if (
      Date.now() - new Date(current.session.createdAt).getTime() >=
      FRESH_SESSION_MS
   ) {
      throw new APIError("BAD_REQUEST", {
         message: "Sign in again before deleting your account.",
         code: "SESSION_EXPIRED",
      });
   }
   if (ctx.body?.token) {
      throw new APIError("BAD_REQUEST", {
         message: "Deletion tokens are not supported.",
      });
   }
   // Better Auth verifies the supplied password itself, but only when the
   // account has a credential row: without this an oauth-only account would
   // be deletable by anyone holding the session cookie alone.
   const credential = await ctx.context.internalAdapter.findCredentialAccount(
      current.user.id
   );
   if (!credential?.password) {
      throw new APIError("BAD_REQUEST", {
         message: "Set a password in Settings before deleting your account.",
         code: "PASSWORD_NOT_SET",
      });
   }
   return expired;
};

const clearExpiredSessionCookie = (ctx: SessionPolicyContext): void => {
   const context = ctx.context as typeof ctx.context & {
      absoluteSessionExpired?: boolean;
   };
   // Better Auth replaces the before-hook response headers with the endpoint's
   // headers. Set the expiry again after the endpoint, unless sign-in just
   // established a new session whose cookie must remain usable.
   if (context.absoluteSessionExpired && !context.newSession)
      deleteSessionCookie(ctx);
};

export { clearExpiredSessionCookie, enforceSessionPolicy };
