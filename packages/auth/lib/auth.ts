import { prisma } from "@s3-viewer/db";
import {
   AUTH_BASE_PATH,
   AUTH_LINK_TTL_HOURS,
   DAY_MS,
   HOUR_MS,
   INVITE_TOKEN_HEADER,
   MINUTE_MS,
   PASSWORD_MAX_LENGTH,
   PASSWORD_MIN_LENGTH,
   SECOND_MS,
   SESSION_ABSOLUTE_TTL_DAYS,
   SESSION_TTL_DAYS,
   SITE_PATHS,
   VERIFICATION_CODE_ATTEMPTS,
   VERIFICATION_CODE_LENGTH,
   VERIFICATION_CODE_TTL_MINUTES,
   profileNameSchema,
} from "@s3-viewer/shared";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
   APIError,
   createAuthMiddleware,
   getSessionFromCtx,
   isAPIError,
} from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { sendResetLink, sendVerificationCode } from "./auth-mail";
import { authEnv, signUpPolicy } from "./env";
import { EXISTS } from "./errors";
import {
   OVERLONG_EMAIL,
   SESSION_THROTTLES,
   allowedBy,
   codeGuessThrottle,
   hookThrottles,
   lookup,
   settleThrottles,
   succeeded,
   tooManyAttempts,
   type HookBody,
} from "./hook-throttles";
import {
   assertPasswordForCode,
   codeGuessesSpent,
   dropOutstandingResetLinks,
   expireStaleCode,
   resetTokenOwner,
} from "./password-checks";
import {
   CHANGE_PASSWORD_PATH,
   PASSWORD_SIGN_UP_PATH,
   RESET_PASSWORD_PATH,
   SEND_CODE_PATH,
   VERIFY_CODE_PATH,
} from "./paths";
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
import { setAuthLogger } from "./log";
import { onUserDeletion, userDeletionHooks } from "./user-deletion";

const DAY_SECONDS = DAY_MS / SECOND_MS;
const HOUR_SECONDS = HOUR_MS / SECOND_MS;
const MINUTE_SECONDS = MINUTE_MS / SECOND_MS;
const AUTH_LINK_TTL_SECONDS = AUTH_LINK_TTL_HOURS * HOUR_SECONDS;
const VERIFICATION_CODE_TTL_SECONDS =
   VERIFICATION_CODE_TTL_MINUTES * MINUTE_SECONDS;

const withoutTokens = <T extends Record<string, unknown>>(account: T): T => ({
   ...account,
   accessToken: null,
   refreshToken: null,
   idToken: null,
});

const DISABLED_PATHS: string[] = [
   // these let a stolen cookie probe or replace an unknown password.
   "/verify-password",
   "/unlink-account",
   // verification is by code; the link endpoints would bypass the password check below.
   "/send-verification-email",
   "/verify-email",
   // the OTP plugin also ships passwordless sign-in, resets and email changes; codes verify only.
   "/sign-in/email-otp",
   "/forget-password/email-otp",
   "/email-otp/request-password-reset",
   "/email-otp/reset-password",
   "/email-otp/request-email-change",
   "/email-otp/change-email",
   "/email-otp/check-verification-otp",
];

const profileOrThrow = <T>(
   result: { ok: true; data: T } | { ok: false; message: string }
): T => {
   if (!result.ok)
      throw new APIError("BAD_REQUEST", { message: result.message });
   return result.data;
};

type HookState = { resetUserId?: string };

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
      // Better Auth refuses /list-sessions once a session outlives freshAge ("Session is not fresh");
      // sessions end at the absolute TTL, so matching it never trips. actions that need a recent
      // sign-in check isSessionFresh.
      freshAge: SESSION_ABSOLUTE_TTL_DAYS * DAY_SECONDS,
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
      // no session exists until the address is verified; sign-in answers 403 EMAIL_NOT_VERIFIED instead.
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: AUTH_LINK_TTL_SECONDS,
      sendResetPassword: ({ user, url }) => sendResetLink(user.email, url),
   },
   emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
   },
   plugins: [
      emailOTP({
         otpLength: VERIFICATION_CODE_LENGTH,
         expiresIn: VERIFICATION_CODE_TTL_SECONDS,
         allowedAttempts: VERIFICATION_CODE_ATTEMPTS,
         storeOTP: "encrypted",
         // a resend or a repeated sign-in mails the code that is still valid, so every copy in the inbox
         // works; each send also restarts its expiry, bounded by the attempt count and the password gate.
         resendStrategy: "reuse",
         disableSignUp: true,
         overrideDefaultEmailVerification: true,
         sendVerificationOTP: ({ email, otp, type }) =>
            type === "email-verification"
               ? sendVerificationCode(email, otp)
               : Promise.resolve(),
      }),
   ],
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
               // with verification required, Better Auth answers a taken address with a fake
               // success and no mail; the form would then wait for a code that never comes.
               if (
                  email &&
                  email !== OVERLONG_EMAIL &&
                  (await ctx.context.internalAdapter.findUserByEmail(email))
               ) {
                  throw new APIError("UNPROCESSABLE_ENTITY", {
                     message: EXISTS,
                     code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
                  });
               }
            } catch (error) {
               await settleThrottles(rules, ip, email, false);
               throw error;
            }
         }
         if (ctx.path === SEND_CODE_PATH) {
            if (body?.type !== "email-verification")
               throw new APIError("BAD_REQUEST", {
                  message: "Invalid OTP type",
               });
            if (email && email !== OVERLONG_EMAIL)
               await expireStaleCode(ctx, email);
         }
         if (ctx.path === VERIFY_CODE_PATH) {
            await assertPasswordForCode(ctx, email, body?.password);
            if (!(await codeGuessThrottle.allow(email)))
               throw codeGuessesSpent();
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
         return {
            context: {
               context: { absoluteSessionExpired, resetUserId },
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
         await settleThrottles(rules, ip, email, succeeded(ctx));
         const resetUserId =
            ctx.path === RESET_PASSWORD_PATH
               ? (ctx.context as HookState).resetUserId
               : undefined;
         const passwordOwner =
            resetUserId ??
            (ctx.path === CHANGE_PASSWORD_PATH
               ? ctx.context.session?.user.id
               : undefined);
         if (passwordOwner && !isAPIError(ctx.context.returned)) {
            await dropOutstandingResetLinks(ctx.context, passwordOwner);
         }
         // following a reset link proves the inbox as well as a code would.
         if (resetUserId && !isAPIError(ctx.context.returned)) {
            await ctx.context.internalAdapter.updateUser(resetUserId, {
               emailVerified: true,
            });
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
            before: async (_session, ctx) => ({
               data: {
                  userAgent: undefined,
                  ipAddress: undefined,
                  // change-password swaps in a new session; it must keep the old absolute lifetime.
                  ...(ctx?.path === CHANGE_PASSWORD_PATH &&
                     ctx.context.session && {
                        createdAt: ctx.context.session.session.createdAt,
                     }),
               },
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

// setPassword is pathless (server-only), so the after hook cannot match it; its caller drops the links.
const dropResetLinks = async (userId: string): Promise<void> =>
   dropOutstandingResetLinks(await auth.$context, userId);

export { auth, dropResetLinks, onUserDeletion, setAuthLogger, signUpPolicy };
export type { DeletedUser, UserDeletionHooks } from "./user-deletion";
