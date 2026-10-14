import { prisma } from "@s3-viewer/db";
import {
   sendPasswordResetEmail,
   sendVerificationCodeEmail,
} from "@s3-viewer/email";
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
   SESSION_TTL_DAYS,
   SITE_PATHS,
   VERIFICATION_CODE_ATTEMPTS,
   VERIFICATION_CODE_LENGTH,
   VERIFICATION_CODE_TTL_MINUTES,
   canonicalMailbox,
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
import { emailOTP } from "better-auth/plugins";
import { authEnv, signUpPolicy } from "./env";
import {
   AuthErrorCode,
   EXISTS,
   TOO_MANY_ATTEMPTS,
   TOO_MANY_CODE_GUESSES,
} from "./errors";
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
const MINUTE_SECONDS = MINUTE_MS / SECOND_MS;
const AUTH_LINK_TTL_SECONDS = AUTH_LINK_TTL_HOURS * HOUR_SECONDS;
const VERIFICATION_CODE_TTL_SECONDS =
   VERIFICATION_CODE_TTL_MINUTES * MINUTE_SECONDS;

type HookBody =
   | { email?: unknown; password?: unknown; type?: unknown }
   | undefined;

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
const SEND_CODE_PATH = "/email-otp/send-verification-otp";
const VERIFY_CODE_PATH = "/email-otp/verify-email";

const SIGN_IN_RULES: readonly ThrottleRule[] = [
   {
      throttle: makeThrottle("sign-in", 10, 10 * MINUTE_MS),
      key: perAddressAndIp,
   },
   // successful sign-ins are refunded, but failures from any source count: ~100/hour
   // locks password sign-in for the address until the window resets (accepted).
   {
      throttle: makeThrottle("sign-in-address-failures", 100, HOUR_MS),
      key: perAddress,
      spend: "failure",
   },
];

// each code locks after its own attempts, but a fresh code is minted whether or not its mail
// is sent; charged only once the password matches, so a stranger cannot spend it.
const codeGuessThrottle = makeThrottle(
   "code-guesses",
   4 * VERIFICATION_CODE_ATTEMPTS,
   DAY_MS
);

const THROTTLES: Readonly<Record<string, readonly ThrottleRule[]>> = {
   [SIGN_IN_PATH]: SIGN_IN_RULES,
   // a code is only accepted with the password, so it shares the sign-in budget.
   [VERIFY_CODE_PATH]: SIGN_IN_RULES,
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
   [SEND_CODE_PATH]: MAIL_RULES,
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
   const address = canonicalMailbox(to);
   for (const throttle of MAIL_PER_ADDRESS) {
      if (!(await throttle.allow(address))) return false;
   }
   return true;
};

const deliverMail = async (
   kind: "code" | "reset",
   to: string,
   send: () => Promise<void>
): Promise<void> => {
   try {
      if (!(await mailAllowed(to))) {
         console.warn(
            `[auth] ${kind} email suppressed: address mailed recently`
         );
         return;
      }
      await send();
   } catch (error) {
      console.error(`[auth] ${kind} email failed: ${describeError(error)}`);
   }
};

// Better Auth answers unknown addresses at once; awaiting delivery would reveal accounts.
const sendResetLink = async (to: string, url: string): Promise<void> => {
   void deliverMail("reset", to, () =>
      sendPasswordResetEmail({ to, url, expiresInHours: AUTH_LINK_TTL_HOURS })
   );
};

const sendVerificationCode = async (
   to: string,
   code: string
): Promise<void> => {
   void deliverMail("code", to, () =>
      sendVerificationCodeEmail({
         to,
         code,
         expiresInMinutes: VERIFICATION_CODE_TTL_MINUTES,
      })
   );
};

type HookContext = Parameters<typeof getSessionFromCtx>[0];
type HookState = { resetUserId?: string };

const RESET_PASSWORD_PATH = "/reset-password";
const CHANGE_PASSWORD_PATH = "/change-password";

const codeGuessesSpent = (): APIError =>
   new APIError("TOO_MANY_REQUESTS", {
      message: TOO_MANY_CODE_GUESSES,
      code: AuthErrorCode.VERIFICATION_LOCKED,
   });

const wrongCredentials = (): APIError =>
   new APIError("UNAUTHORIZED", {
      message: "Invalid email or password",
      code: AuthErrorCode.INVALID_EMAIL_OR_PASSWORD,
   });

// a code proves the inbox and the password proves the sign-up, so a stranger who
// registered the address first cannot keep a session the real owner just created.
const assertPasswordForCode = async (
   ctx: HookContext,
   email: string,
   password: unknown
): Promise<void> => {
   if (typeof password !== "string" || !password || !email)
      throw wrongCredentials();
   const user = await ctx.context.internalAdapter.findUserByEmail(email);
   const credential = user
      ? await ctx.context.internalAdapter.findCredentialAccount(user.user.id)
      : null;
   if (!credential?.password) {
      // same cost as a real check, so timing does not reveal which addresses have a password
      await ctx.context.password.hash(password);
      throw wrongCredentials();
   }
   const matches = await ctx.context.password.verify({
      hash: credential.password,
      password,
   });
   if (!matches) throw wrongCredentials();
};

type Outcome = {
   path: string;
   context: { newSession?: unknown; returned?: unknown };
};

// sign-up no longer opens a session, and a correct password on an unverified
// account is a success that must not spend the owner's failure budget.
const succeeded = ({ path, context }: Outcome): boolean =>
   Boolean(context.newSession) ||
   (path === PASSWORD_SIGN_UP_PATH
      ? !isAPIError(context.returned)
      : isAPIError(context.returned) &&
        context.returned.body?.code === AuthErrorCode.EMAIL_NOT_VERIFIED);

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
      (ctx.body as { token?: unknown } | undefined)?.token || ctx.query?.token;
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
      // better auth would refuse /list-sessions after a day; the actions that need a recent
      // sign-in (password, server and account deletion) check isSessionFresh themselves.
      freshAge: 0,
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
         if (
            ctx.path === SEND_CODE_PATH &&
            body?.type !== "email-verification"
         ) {
            throw new APIError("BAD_REQUEST", { message: "Invalid OTP type" });
         }
         if (ctx.path === VERIFY_CODE_PATH) {
            try {
               await assertPasswordForCode(ctx, email, body?.password);
               if (!(await codeGuessThrottle.allow(email)))
                  throw codeGuessesSpent();
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
            await dropOutstandingResetLinks(ctx, passwordOwner);
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

export { auth, onUserDeletion, signUpPolicy };
export type { DeletedUser, UserDeletionHooks } from "./user-deletion";
