import { prisma } from "@s3-viewer/db";
import { sendAuthCodeEmail, sendAuthEmail } from "@s3-viewer/email";
import {
   AUTH_BASE_PATH,
   AUTH_CODE_LENGTH,
   AUTH_CODE_TTL_MINUTES,
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
import { emailOTP, magicLink } from "better-auth/plugins";
import { authFlowContext, type AuthFlowStore } from "./auth-flow-context";
import { authEnv } from "./env";
import { validateProfile } from "./profile";
import { createThrottle, type Throttle } from "./throttle";
import { onUserDeletion, userDeletionHooks } from "./user-deletion";
import { localPart, normalizeEmail } from "./utils";

const DAY_SECONDS = DAY_MS / SECOND_MS;
const HOUR_SECONDS = HOUR_MS / SECOND_MS;
const AUTH_CODE_TTL_SECONDS = AUTH_CODE_TTL_MINUTES * 60;
const SESSION_COOKIE_CACHE_SECONDS = 60;

type AuthCredentials = { otp: string; magicLinkUrl: string };
type HookBody = { email?: unknown; type?: unknown } | undefined;

// everything the email-otp and magic-link plugins serve; hidden as one block
// when sign-in by email is off, so a disabled method has no reachable route
const EMAIL_LOGIN_PATHS =
   /^\/(email-otp\/|magic-link\/|sign-in\/(email-otp|magic-link)$|forget-password\/)/;
const PASSWORD_LOGIN_PATHS =
   /^\/(sign-(in|up)\/email|change-password|email-otp\/(request-password-reset|reset-password))$/;

// sign-in mail leaves only through `sendAuthFlowEmail` (one email carrying
// both the code and the link, behind /auth-flow/start's limits); the plugins'
// own single-channel senders would send half of it outside those limits
const isSingleChannelSend = (path: string, body: HookBody): boolean =>
   path === "/sign-in/magic-link" ||
   path === "/forget-password/email-otp" ||
   (path === "/email-otp/send-verification-otp" && body?.type === "sign-in");

const isHidden = (path: string, body: HookBody): boolean =>
   (!authEnv.emailLogin && EMAIL_LOGIN_PATHS.test(path)) ||
   (!authEnv.passwordLogin && PASSWORD_LOGIN_PATHS.test(path)) ||
   isSingleChannelSend(path, body);

// per-address ceilings that the per-ip express limiter cannot give: a
// password guess and an outbound code are each bounded per email too
const mailThrottle = createThrottle(5, 10 * MINUTE_MS);
const THROTTLES: Readonly<Record<string, Throttle>> = {
   "/sign-in/email": createThrottle(10, 10 * MINUTE_MS),
   "/email-otp/send-verification-otp": mailThrottle,
   "/email-otp/request-password-reset": mailThrottle,
};

const bodyEmail = (body: HookBody): string =>
   typeof body?.email === "string" ? normalizeEmail(body.email) : "";

// email changes are not offered, so any type that is not a reset is a
// verification code
const sendCodeEmail = (email: string, otp: string, type: string) =>
   sendAuthCodeEmail({
      to: email,
      intent: type === "forget-password" ? "reset" : "verify",
      otp,
      expiresInMinutes: AUTH_CODE_TTL_MINUTES,
   });

// oauth tokens are never read back anywhere in the product, so they are dropped
// rather than stored unencrypted next to envelope-encrypted s3 credentials
const withoutTokens = <T extends Record<string, unknown>>(account: T): T => ({
   ...account,
   accessToken: null,
   refreshToken: null,
   idToken: null,
});

const sendAuthFlowEmail = async (
   email: string,
   headers: Headers,
   seed: Partial<AuthCredentials> = {}
): Promise<void> => {
   const store: AuthFlowStore = { email, ...seed };
   await authFlowContext.run(store, async () => {
      if (!store.otp) {
         await auth.api.sendVerificationOTP({
            body: { email, type: "sign-in" },
            headers,
         });
      }
      if (!store.magicLinkUrl) {
         await auth.api.signInMagicLink({
            body: {
               email,
               name: localPart(email),
               callbackURL: `${authEnv.siteOrigin}${SITE_PATHS.dashboard}`,
            },
            headers,
         });
      }
   });
   if (!store.otp || !store.magicLinkUrl) {
      throw new Error("Auth flow did not produce a code and a link");
   }
   await sendAuthEmail({
      to: email,
      otp: store.otp,
      magicLinkUrl: store.magicLinkUrl,
      expiresInMinutes: AUTH_CODE_TTL_MINUTES,
   });
};

const auth = betterAuth({
   baseURL: authEnv.apiOrigin,
   basePath: AUTH_BASE_PATH,
   secret: authEnv.secret,
   database: prismaAdapter(prisma, { provider: "postgresql" }),
   trustedOrigins: [authEnv.siteOrigin],
   // a failed oauth or magic-link callback must land on the login page, not on
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
      enabled: authEnv.passwordLogin,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
   },
   hooks: {
      // internal calls made by `sendAuthFlowEmail` run inside the flow context
      // and are already limited by the route that started them
      before: createAuthMiddleware(async (ctx) => {
         if (authFlowContext.getStore()) return;
         const body = ctx.body as HookBody;
         if (isHidden(ctx.path, body)) {
            throw new APIError("NOT_FOUND", { message: "Not found" });
         }
         const throttle = THROTTLES[ctx.path];
         const email = bodyEmail(body);
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
            // nothing fills `image`, and better auth's own otp/oauth endpoints
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
   plugins: [
      emailOTP({
         otpLength: AUTH_CODE_LENGTH,
         expiresIn: AUTH_CODE_TTL_SECONDS,
         allowedAttempts: 5,
         // a password sign-up gets a verification code straight away, so the
         // account can use invites without a second trip through sign-in
         sendVerificationOnSignUp: true,
         async sendVerificationOTP(
            { email, otp, type },
            request
         ): Promise<void> {
            const flow = authFlowContext.getStore();
            if (flow) {
               flow.otp = otp;
               return;
            }
            if (!authEnv.emailLogin) return;
            if (type === "sign-in") {
               await sendAuthFlowEmail(
                  email,
                  request?.headers ?? new Headers(),
                  { otp }
               );
               return;
            }
            await sendCodeEmail(email, otp, type);
         },
      }),
      magicLink({
         expiresIn: AUTH_CODE_TTL_SECONDS,
         async sendMagicLink({ email, url }, request): Promise<void> {
            const flow = authFlowContext.getStore();
            if (flow) {
               flow.magicLinkUrl = url;
               return;
            }
            await sendAuthFlowEmail(email, request?.headers ?? new Headers(), {
               magicLinkUrl: url,
            });
         },
      }),
   ],
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

export { auth, onUserDeletion, sendAuthFlowEmail };
export type { DeletedUser, UserDeletionHooks } from "./user-deletion";
