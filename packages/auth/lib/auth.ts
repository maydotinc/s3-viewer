import { prisma } from "@s3-viewer/db";
import { sendAuthLinkEmail } from "@s3-viewer/email";
import {
   AUTH_BASE_PATH,
   AUTH_LINK_TTL_HOURS,
   DAY_MS,
   HOUR_MS,
   MINUTE_MS,
   PASSWORD_MAX_LENGTH,
   PASSWORD_MIN_LENGTH,
   SECOND_MS,
   SESSION_FRESH_HOURS,
   SESSION_TTL_DAYS,
   SITE_PATHS,
} from "@s3-viewer/types";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { authEnv } from "./env";
import { validateProfile } from "./profile";
import { createThrottle, type Throttle } from "./throttle";
import { onUserDeletion, userDeletionHooks } from "./user-deletion";
import { localPart, normalizeEmail } from "./utils";

const DAY_SECONDS = DAY_MS / SECOND_MS;
const HOUR_SECONDS = HOUR_MS / SECOND_MS;
const AUTH_LINK_TTL_SECONDS = AUTH_LINK_TTL_HOURS * HOUR_SECONDS;
const SESSION_COOKIE_CACHE_SECONDS = 60;

type HookBody = { email?: unknown } | undefined;

// oauth tokens are never read back anywhere in the product, so they are dropped
// rather than stored unencrypted next to envelope-encrypted s3 credentials
const withoutTokens = <T extends Record<string, unknown>>(account: T): T => ({
   ...account,
   accessToken: null,
   refreshToken: null,
   idToken: null,
});

// per-address ceilings that the per-ip express limiter cannot give: a
// password guess and an outbound link are each bounded per email too
const mailThrottle = createThrottle(5, 10 * MINUTE_MS);
const THROTTLES: Readonly<Record<string, Throttle>> = {
   "/sign-in/email": createThrottle(10, 10 * MINUTE_MS),
   "/send-verification-email": mailThrottle,
   "/request-password-reset": mailThrottle,
};

const bodyEmail = (body: HookBody): string =>
   typeof body?.email === "string" ? normalizeEmail(body.email) : "";

// a mail failure must never fail the sign-up or reset request that caused
// it: the account already exists, and the response never reveals delivery
const sendLink = async (
   intent: "verify" | "reset",
   to: string,
   url: string
): Promise<void> => {
   try {
      await sendAuthLinkEmail({
         to,
         intent,
         url,
         expiresInHours: AUTH_LINK_TTL_HOURS,
      });
   } catch (error) {
      console.error(`[auth] ${intent} email failed`, error);
   }
};

const auth = betterAuth({
   baseURL: authEnv.apiOrigin,
   basePath: AUTH_BASE_PATH,
   secret: authEnv.secret,
   database: prismaAdapter(prisma, { provider: "postgresql" }),
   trustedOrigins: [authEnv.siteOrigin],
   // a failed oauth callback must land on the login page, not on
   // better auth's default `/?error=` at the api origin (a 401 for the user)
   onAPIError: {
      errorURL: `${authEnv.siteOrigin}${SITE_PATHS.login}`,
   },
   advanced: {
      ipAddress: { disableIpTracking: true },
      defaultCookieAttributes: {
         sameSite: "lax",
         secure: authEnv.apiIsHttps,
         httpOnly: true,
      },
   },
   session: {
      expiresIn: SESSION_TTL_DAYS * DAY_SECONDS,
      updateAge: DAY_SECONDS,
      freshAge: SESSION_FRESH_HOURS * HOUR_SECONDS,
      cookieCache: { enabled: true, maxAge: SESSION_COOKIE_CACHE_SECONDS },
   },
   user: {
      deleteUser: { enabled: true, ...userDeletionHooks },
   },
   rateLimit: { enabled: false },
   emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: AUTH_LINK_TTL_SECONDS,
      sendResetPassword: ({ user, url }) => sendLink("reset", user.email, url),
   },
   emailVerification: {
      sendOnSignUp: true,
      expiresIn: AUTH_LINK_TTL_SECONDS,
      sendVerificationEmail: ({ user, url }) =>
         sendLink("verify", user.email, url),
   },
   hooks: {
      before: createAuthMiddleware(async (ctx) => {
         const throttle = THROTTLES[ctx.path];
         const email = bodyEmail(ctx.body as HookBody);
         if (throttle && email && !throttle.allow(email)) {
            throw new APIError("TOO_MANY_REQUESTS", {
               message: "Too many attempts. Try again in a few minutes.",
               code: "RATE_LIMITED",
            });
         }
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
            // nothing fills `image`, and better auth's own sign-up/oauth endpoints
            // bypass emailSchema, so this is the one place every stored email
            // is guaranteed lowercase
            before: async (user) => ({
               data: {
                  ...user,
                  name: user.name || localPart(user.email),
                  email: normalizeEmail(user.email),
                  image: null,
               },
            }),
         },
         update: {
            before: async (user) => {
               const result = validateProfile(user);
               if (!result.ok) {
                  throw new APIError("BAD_REQUEST", {
                     message: result.message,
                  });
               }
               return {
                  data: {
                     ...user,
                     ...result.data,
                     ...(user.email !== undefined && {
                        email: normalizeEmail(user.email),
                     }),
                  },
               };
            },
         },
      },
      session: {
         create: {
            // better auth merges the returned data over the row, so the
            // column-less userAgent must be unset explicitly, not omitted
            before: async () => ({ data: { userAgent: undefined } }),
         },
      },
   },
   socialProviders: authEnv.github
      ? {
           github: {
              ...authEnv.github,
              // undefined overrides avatar_url in the provider spread; the
              // create hook then writes null
              mapProfileToUser: () => ({ image: undefined }),
           },
        }
      : undefined,
});

export { auth, onUserDeletion };
export type { DeletedUser, UserDeletionHooks } from "./user-deletion";
