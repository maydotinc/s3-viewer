import {
   DAY_MS,
   ACCOUNT_CHANGED_MESSAGE,
   EXPECTED_USER_ID_HEADER,
   ErrorCode,
   SESSION_ABSOLUTE_TTL_DAYS,
   isSessionFresh,
   deleteAccountSchema,
   normalizeEmail,
} from "@s3-viewer/types";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { AuthErrorCode, PASSWORD_NOT_SET_MESSAGE } from "./errors";
import { DELETE_USER_PATH } from "./paths";
import { assertSharedServersAcknowledged } from "./user-deletion";

const ABSOLUTE_TTL_MS = SESSION_ABSOLUTE_TTL_DAYS * DAY_MS;

type SessionPolicyContext = Parameters<typeof getSessionFromCtx>[0];

// /get-session reads its own row; check its age afterward to avoid a duplicate query.
const SELF_READING_PATH = "/get-session";

const isOverAge = (createdAt: Date | string | number): boolean => {
   const created = new Date(createdAt).getTime();
   return !Number.isFinite(created) || Date.now() - created >= ABSOLUTE_TTL_MS;
};

const revokeIfOverAge = async (ctx: SessionPolicyContext): Promise<boolean> => {
   const existing = ctx.context.session;
   if (!existing || !isOverAge(existing.session.createdAt)) return false;
   await ctx.context.internalAdapter.deleteSession(existing.session.token);
   ctx.context.session = null;
   deleteSessionCookie(ctx);
   return true;
};

// nested auth middleware would discard the cookie-clearing headers.
const enforceSessionPolicy = async (
   ctx: SessionPolicyContext
): Promise<boolean> => {
   let expired = false;
   if (ctx.path !== SELF_READING_PATH) {
      await getSessionFromCtx(ctx, {
         disableCookieCache: true,
         disableRefresh: true,
      });
      expired = await revokeIfOverAge(ctx);
   }

   const expectedUserId = ctx.headers?.get(EXPECTED_USER_ID_HEADER);
   const alreadySignedOut = ctx.path === "/sign-out" && !ctx.context.session;
   if (
      ctx.path !== SELF_READING_PATH &&
      !alreadySignedOut &&
      expectedUserId !== null &&
      expectedUserId !== undefined &&
      expectedUserId !== ctx.context.session?.user.id
   ) {
      throw new APIError("FORBIDDEN", {
         message: ACCOUNT_CHANGED_MESSAGE,
         code: ErrorCode.ACCOUNT_CHANGED,
      });
   }

   if (ctx.path === `${DELETE_USER_PATH}/callback`) {
      throw new APIError("NOT_FOUND", { message: "Not found" });
   }
   if (ctx.path !== DELETE_USER_PATH) return expired;

   // check binding before Better Auth strips the extra confirmation fields.
   const confirmation = deleteAccountSchema.safeParse(ctx.body);
   if (!confirmation.success) {
      throw new APIError("BAD_REQUEST", {
         message:
            "Confirm the account ID, email and password before deleting your account.",
         code: AuthErrorCode.ACCOUNT_CONFIRMATION_REQUIRED,
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
      throw new APIError("FORBIDDEN", {
         message: ACCOUNT_CHANGED_MESSAGE,
         code: ErrorCode.ACCOUNT_CHANGED,
      });
   }
   if (!isSessionFresh(current.session.createdAt)) {
      throw new APIError("BAD_REQUEST", {
         message: "Sign in again before deleting your account.",
         code: AuthErrorCode.SESSION_EXPIRED,
      });
   }
   if (ctx.body?.token) {
      throw new APIError("BAD_REQUEST", {
         message: "Deletion tokens are not supported.",
      });
   }
   // Better Auth skips password verification when no credential row exists.
   const credential = await ctx.context.internalAdapter.findCredentialAccount(
      current.user.id
   );
   if (!credential?.password) {
      throw new APIError("BAD_REQUEST", {
         message: PASSWORD_NOT_SET_MESSAGE,
         code: AuthErrorCode.PASSWORD_NOT_SET,
      });
   }
   await assertSharedServersAcknowledged(
      current.user.id,
      confirmation.data.acknowledgeSharedServers === true
   );
   return expired;
};

// returning null replaces the revoked session payload; undefined keeps the response.
const enforceAbsoluteTtlAfterRead = async (
   ctx: SessionPolicyContext
): Promise<null | undefined> => {
   if (ctx.path !== SELF_READING_PATH) return undefined;
   return (await revokeIfOverAge(ctx)) ? null : undefined;
};

const clearExpiredSessionCookie = (ctx: SessionPolicyContext): void => {
   const context = ctx.context as typeof ctx.context & {
      absoluteSessionExpired?: boolean;
   };
   // endpoint headers replace before-hook headers; repeat expiry unless sign-in succeeded.
   if (context.absoluteSessionExpired && !context.newSession)
      deleteSessionCookie(ctx);
};

export {
   clearExpiredSessionCookie,
   enforceAbsoluteTtlAfterRead,
   enforceSessionPolicy,
};
