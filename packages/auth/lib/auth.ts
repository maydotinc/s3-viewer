import { prisma } from "@s3-viewer/db";
import { sendAuthLinkEmail } from "@s3-viewer/email";
import {
   AUTH_BASE_PATH,
   AUTH_LINK_TTL_HOURS,
   CLIENT_IP_HEADER,
   DAY_MS,
   HOUR_MS,
   INVITE_TOKEN_HEADER,
   MINUTE_MS,
   MAX_EMAIL_LENGTH,
   PASSWORD_MAX_LENGTH,
   PASSWORD_MIN_LENGTH,
   SECOND_MS,
   SESSION_FRESH_HOURS,
   SESSION_TTL_DAYS,
   SITE_PATHS,
   normalizeEmail,
   profileNameSchema,
   describeError,
} from "@s3-viewer/types";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
   APIError,
   createAuthMiddleware,
   getSessionFromCtx,
   isAPIError,
} from "better-auth/api";
import { authEnv, signUpPolicy } from "./env";
import { AuthErrorCode, TOO_MANY_ATTEMPTS } from "./errors";
import { validateNewProfile, validateProfileChange } from "./profile";
import {
   assertPasswordSignUpAllowed,
   assertSignUpAllowed,
} from "./sign-up-policy";
import {
   clearExpiredSessionCookie,
   enforceAbsoluteTtlAfterRead,
   enforceSessionPolicy,
} from "./session-policy";
import {
   createThrottle,
   perAddress,
   perAddressAndIp,
   perIp,
   type Throttle,
   type ThrottleKey,
} from "./throttle";
import { onUserDeletion, userDeletionHooks } from "./user-deletion";

const DAY_SECONDS = DAY_MS / SECOND_MS;
const HOUR_SECONDS = HOUR_MS / SECOND_MS;
const AUTH_LINK_TTL_SECONDS = AUTH_LINK_TTL_HOURS * HOUR_SECONDS;

type HookBody = { email?: unknown } | undefined;

const withoutTokens = <T extends Record<string, unknown>>(account: T): T => ({
   ...account,
   accessToken: null,
   refreshToken: null,
   idToken: null,
});

// rules with `spend` are charged up front and refunded in the after hook for the other outcome.
type ThrottleRule = {
   throttle: Throttle;
   key: ThrottleKey;
   spend?: "failure" | "success";
};

const shared = authEnv.rateLimitStore === "postgres";
const makeThrottle = (
   name: string,
   limit: number,
   windowMs: number
): Throttle => createThrottle(limit, windowMs, { name, shared });

// request-level mail limits are per source; per-address limits only suppress
// delivery, so nobody else can spend a victim's budget into a 429.
const MAIL_RULES: readonly ThrottleRule[] = [
   { throttle: makeThrottle("mail-ip", 10, 10 * MINUTE_MS), key: perIp },
];
const MAIL_PER_ADDRESS: readonly Throttle[] = [
   makeThrottle("mail-address-burst", 1, MINUTE_MS),
   makeThrottle("mail-address", 10, HOUR_MS),
];
const PASSWORD_SIGN_UP_PATH = "/sign-up/email";
const SIGN_IN_PATH = "/sign-in/email";

const THROTTLES: Readonly<Record<string, readonly ThrottleRule[]>> = {
   [SIGN_IN_PATH]: [
      {
         throttle: makeThrottle("sign-in", 10, 10 * MINUTE_MS),
         key: perAddressAndIp,
      },
      // successful sign-ins are refunded so a third party cannot lock the owner out.
      {
         throttle: makeThrottle("sign-in-address-failures", 100, HOUR_MS),
         key: perAddress,
         spend: "failure",
      },
   ],
   [PASSWORD_SIGN_UP_PATH]: [
      {
         throttle: makeThrottle("sign-up", 10, 10 * MINUTE_MS),
         key: perAddressAndIp,
      },
      // mirrors the Express limiter on the canonical path, which no URL trick can dodge.
      {
         throttle: makeThrottle("sign-up-ip", 10, HOUR_MS),
         key: perIp,
         spend: "success",
      },
   ],
   "/send-verification-email": MAIL_RULES,
   "/request-password-reset": MAIL_RULES,
};

const passwordCheckThrottle = makeThrottle(
   "password-check",
   10,
   10 * MINUTE_MS
);
const SESSION_THROTTLES: Readonly<Record<string, Throttle>> = {
   "/change-password": passwordCheckThrottle,
   "/delete-user": passwordCheckThrottle,
   // disabled over HTTP below; kept so a server-side auth.api.verifyPassword caller stays bounded.
   "/verify-password": passwordCheckThrottle,
};

// these endpoints let a stolen cookie probe or replace an unknown password.
const DISABLED_PATHS: string[] = ["/verify-password", "/unlink-account"];

const lookup = <T>(table: Readonly<Record<string, T>>, path: string) =>
   Object.hasOwn(table, path) ? table[path] : undefined;

const tooManyAttempts = (): APIError =>
   new APIError("TOO_MANY_REQUESTS", {
      message: TOO_MANY_ATTEMPTS,
      code: AuthErrorCode.RATE_LIMITED,
   });

const allowedBy = async (
   rules: readonly ThrottleRule[],
   ip: string,
   email: string
): Promise<boolean> => {
   for (const { throttle, key } of rules) {
      const bucket = key(ip, email);
      if (bucket !== null && !(await throttle.allow(bucket))) return false;
   }
   return true;
};

const settleThrottles = async (
   rules: readonly ThrottleRule[] | undefined,
   ip: string,
   email: string,
   succeeded: boolean
): Promise<void> => {
   for (const { throttle, key, spend } of rules ?? []) {
      const bucket = key(ip, email);
      if (
         spend &&
         bucket !== null &&
         spend !== (succeeded ? "success" : "failure")
      )
         await throttle.refund(bucket);
   }
};

const OVERLONG_EMAIL = "<overlong>";

const profileOrThrow = <T>(
   result: { ok: true; data: T } | { ok: false; message: string }
): T => {
   if (!result.ok)
      throw new APIError("BAD_REQUEST", { message: result.message });
   return result.data;
};

const bodyEmail = (body: HookBody): string => {
   if (typeof body?.email !== "string") return "";
   return body.email.length > MAX_EMAIL_LENGTH
      ? OVERLONG_EMAIL
      : normalizeEmail(body.email);
};

const mailAllowed = async (to: string): Promise<boolean> => {
   const address = normalizeEmail(to);
   for (const throttle of MAIL_PER_ADDRESS) {
      if (!(await throttle.allow(address))) return false;
   }
   return true;
};

const deliverLink = async (
   intent: "verify" | "reset",
   to: string,
   url: string
): Promise<void> => {
   try {
      if (!(await mailAllowed(to))) {
         console.warn(
            `[auth] ${intent} email suppressed: address mailed recently`
         );
         return;
      }
      await sendAuthLinkEmail({
         to,
         intent,
         url,
         expiresInHours: AUTH_LINK_TTL_HOURS,
      });
   } catch (error) {
      console.error(`[auth] ${intent} email failed: ${describeError(error)}`);
   }
};

// Better Auth answers unknown addresses at once; awaiting delivery would reveal accounts.
const sendLink = async (
   ...link: Parameters<typeof deliverLink>
): Promise<void> => {
   void deliverLink(...link);
};

type HookContext = Parameters<typeof getSessionFromCtx>[0];
type HookState = { resetUserId?: string; priorSessionUserId?: string };

const RESET_PASSWORD_PATH = "/reset-password";
const CHANGE_PASSWORD_PATH = "/change-password";
const VERIFY_EMAIL_PATH = "/verify-email";

const hookThrottles = (ctx: HookContext, body: HookBody) => {
   const email = bodyEmail(body);
   return {
      rules: email ? lookup(THROTTLES, ctx.path) : undefined,
      ip: ctx.headers?.get(CLIENT_IP_HEADER) ?? "",
      email,
   };
};

// read before the endpoint consumes the row, which is the only link from token to user.
const resetTokenOwner = async (
   ctx: HookContext
): Promise<string | undefined> => {
   const token =
      (ctx.body as { token?: unknown } | undefined)?.token ?? ctx.query?.token;
   if (typeof token !== "string" || !token) return undefined;
   const row = await ctx.context.internalAdapter.findVerificationValue(
      `reset-password:${token}`
   );
   return row?.value;
};

// reset rows store the user id as their value; identifiers are hashed.
const dropOutstandingResetLinks = async (
   ctx: HookContext,
   userId: string
): Promise<void> => {
   await ctx.context.adapter.deleteMany({
      model: "verification",
      where: [{ field: "value", value: userId }],
   });
};

// whoever registered the address before its owner verified it must keep neither a session nor the password.
// a verifier without a prior session of their own is signed in passwordless and sets one in settings.
const secureVerifiedAccount = async (ctx: HookContext): Promise<void> => {
   const verifier = ctx.context.newSession;
   if (!verifier) return;
   const userId = verifier.user.id;
   const sessions = await ctx.context.internalAdapter.listSessions(userId);
   const others = sessions
      .map((session) => session.token)
      .filter((token) => token !== verifier.session.token);
   if (others.length > 0)
      await ctx.context.internalAdapter.deleteSessions(others);
   if ((ctx.context as HookState).priorSessionUserId === userId) return;
   const credential =
      await ctx.context.internalAdapter.findCredentialAccount(userId);
   if (credential)
      await ctx.context.internalAdapter.deleteAccount(credential.id);
   await dropOutstandingResetLinks(ctx, userId);
};

const auth = betterAuth({
   baseURL: authEnv.apiOrigin,
   basePath: AUTH_BASE_PATH,
   secret: authEnv.secret,
   database: prismaAdapter(prisma, { provider: "postgresql" }),
   trustedOrigins: [authEnv.siteOrigin],
   onAPIError: {
      errorURL: `${authEnv.siteOrigin}${SITE_PATHS.login}`,
   },
   advanced: {
      ipAddress: { disableIpTracking: true },
      defaultCookieAttributes: {
         sameSite: authEnv.cookieSameSite,
         secure: authEnv.apiIsHttps,
         httpOnly: true,
      },
   },
   session: {
      expiresIn: SESSION_TTL_DAYS * DAY_SECONDS,
      updateAge: DAY_SECONDS,
      freshAge: SESSION_FRESH_HOURS * HOUR_SECONDS,
      cookieCache: { enabled: false },
   },
   user: {
      deleteUser: { enabled: true, ...userDeletionHooks },
   },
   // require verified local and provider addresses to prevent pre-account takeover.
   account: {
      accountLinking: {
         enabled: true,
         requireLocalEmailVerified: true,
      },
   },
   verification: { storeIdentifier: "hashed" },
   rateLimit: { enabled: false },
   disabledPaths: DISABLED_PATHS,
   emailAndPassword: {
      enabled: true,
      disableSignUp: signUpPolicy.mode === "closed",
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: AUTH_LINK_TTL_SECONDS,
      sendResetPassword: ({ user, url }) => sendLink("reset", user.email, url),
   },
   emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: AUTH_LINK_TTL_SECONDS,
      sendVerificationEmail: ({ user, url }) =>
         sendLink("verify", user.email, url),
   },
   hooks: {
      before: createAuthMiddleware(async (ctx) => {
         const body = ctx.body as HookBody;
         const absoluteSessionExpired = await enforceSessionPolicy(ctx);
         const { rules, ip, email } = hookThrottles(ctx, body);
         if (rules && !(await allowedBy(rules, ip, email))) {
            throw tooManyAttempts();
         }
         if (ctx.path === PASSWORD_SIGN_UP_PATH) {
            try {
               await assertPasswordSignUpAllowed(
                  body?.email,
                  ctx.headers?.get(INVITE_TOKEN_HEADER) ?? undefined
               );
            } catch (error) {
               await settleThrottles(rules, ip, email, false);
               throw error;
            }
         }
         const sessionThrottle = lookup(SESSION_THROTTLES, ctx.path);
         if (sessionThrottle) {
            const session = await getSessionFromCtx(ctx);
            if (session && !(await sessionThrottle.allow(session.user.id))) {
               throw tooManyAttempts();
            }
         }
         const resetUserId =
            ctx.path === RESET_PASSWORD_PATH
               ? await resetTokenOwner(ctx)
               : undefined;
         // read before the endpoint runs, since the link's user is only known after it verifies the token.
         const priorSessionUserId =
            ctx.path === VERIFY_EMAIL_PATH
               ? (await getSessionFromCtx(ctx))?.user.id
               : undefined;
         return {
            context: {
               context: {
                  absoluteSessionExpired,
                  resetUserId,
                  priorSessionUserId,
               },
               // Better Auth keeps other sessions unless the caller asks; never let a direct call opt out.
               ...(ctx.path === CHANGE_PASSWORD_PATH && {
                  body: { ...ctx.body, revokeOtherSessions: true },
               }),
            },
         };
      }),
      // any non-undefined return replaces Better Auth's endpoint response.
      after: createAuthMiddleware(async (ctx) => {
         const { rules, ip, email } = hookThrottles(ctx, ctx.body as HookBody);
         await settleThrottles(
            rules,
            ip,
            email,
            Boolean(ctx.context.newSession)
         );
         if (ctx.path === VERIFY_EMAIL_PATH) await secureVerifiedAccount(ctx);
         const passwordOwner =
            ctx.path === RESET_PASSWORD_PATH
               ? (ctx.context as HookState).resetUserId
               : ctx.path === CHANGE_PASSWORD_PATH
                 ? ctx.context.session?.user.id
                 : undefined;
         if (passwordOwner && !isAPIError(ctx.context.returned)) {
            await dropOutstandingResetLinks(ctx, passwordOwner);
         }
         clearExpiredSessionCookie(ctx);
         return enforceAbsoluteTtlAfterRead(ctx);
      }),
   },
   databaseHooks: {
      account: {
         create: {
            before: async (account) => ({ data: withoutTokens(account) }),
         },
         update: {
            before: async (account) => ({ data: withoutTokens(account) }),
         },
      },
      user: {
         create: {
            before: async (user, ctx) => {
               const { email, name } = profileOrThrow(validateNewProfile(user));
               await assertSignUpAllowed(email, {
                  emailVerified: user.emailVerified === true,
                  inviteToken:
                     ctx?.headers?.get(INVITE_TOKEN_HEADER) ?? undefined,
                  passwordSignUp: ctx?.path === PASSWORD_SIGN_UP_PATH,
               });
               return { data: { ...user, name, email, image: null } };
            },
         },
         update: {
            before: async (user) => ({
               data: {
                  ...user,
                  ...profileOrThrow(validateProfileChange(user)),
               },
            }),
         },
      },
      session: {
         create: {
            // Better Auth merges this over the row; omitted properties would retain these fields.
            before: async () => ({
               data: { userAgent: undefined, ipAddress: undefined },
            }),
         },
      },
   },
   socialProviders: authEnv.github
      ? {
           github: {
              ...authEnv.github,
              disableSignUp: signUpPolicy.mode === "closed",
              mapProfileToUser: (profile) => ({
                 image: undefined,
                 name:
                    [profile.name, profile.login, "GitHub user"]
                       .map((name) => profileNameSchema.safeParse(name))
                       .find((result) => result.success)?.data ?? "GitHub user",
              }),
           },
        }
      : undefined,
});

export { auth, onUserDeletion, signUpPolicy };
export type { DeletedUser, UserDeletionHooks } from "./user-deletion";
