import { prisma } from "@s3-viewer/db";
import { sendAuthLinkEmail } from "@s3-viewer/email";
import {
   AUTH_BASE_PATH,
   AUTH_LINK_TTL_HOURS,
   CLIENT_IP_HEADER,
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
import { emitAuthEvent, onAuthEvent } from "./audit";
import { captureAuditActor, recordAuthEvent } from "./auth-events";
import { authEnv, signUpPolicy } from "./env";
import { validateProfile } from "./profile";
import { assertSignUpAllowed } from "./sign-up-policy";
import {
   clearExpiredSessionCookie,
   enforceSessionPolicy,
} from "./session-policy";
import {
   createThrottle,
   perAddress,
   perAddressAndIp,
   type Throttle,
   type ThrottleKey,
} from "./throttle";
import { onUserDeletion, userDeletionHooks } from "./user-deletion";
import { describeFailure, localPart, normalizeEmail } from "./utils";

const DAY_SECONDS = DAY_MS / SECOND_MS;
const HOUR_SECONDS = HOUR_MS / SECOND_MS;
const AUTH_LINK_TTL_SECONDS = AUTH_LINK_TTL_HOURS * HOUR_SECONDS;

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
// password guess and an outbound link are each bounded per email too. sign-in
// counts per ip and address so a single ip can't lock an address out, with a
// far looser per-address backstop that still bounds distributed guessing
type ThrottleRule = { throttle: Throttle; key: ThrottleKey };

const mailThrottle = createThrottle(5, 10 * MINUTE_MS);
const byAddress = (throttle: Throttle): ThrottleRule => ({
   throttle,
   key: perAddress,
});
const THROTTLES: Readonly<Record<string, readonly ThrottleRule[]>> = {
   "/sign-in/email": [
      { throttle: createThrottle(10, 10 * MINUTE_MS), key: perAddressAndIp },
      byAddress(createThrottle(60, 10 * MINUTE_MS)),
   ],
   "/send-verification-email": [byAddress(mailThrottle)],
   "/request-password-reset": [byAddress(mailThrottle)],
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
      console.error(`[auth] ${intent} email failed: ${describeFailure(error)}`);
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
   // requireLocalEmailVerified is the setting that stops pre-account takeover:
   // without it, signing up with someone's address before they arrive and then
   // having them sign in with github would merge the two into one account.
   // no provider is trusted: link-account.mjs:83 skips the *provider's* own
   // verified-email check for a trusted one, which would let an address github
   // itself reports as unverified link into an existing local account
   account: {
      accountLinking: {
         enabled: true,
         requireLocalEmailVerified: true,
      },
   },
   // tokens live in the verification table's identifier; hashing them means a
   // read of that table cannot be replayed as a password-reset link
   verification: { storeIdentifier: "hashed" },
   rateLimit: { enabled: false },
   emailAndPassword: {
      enabled: true,
      disableSignUp: signUpPolicy.mode === "closed",
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: AUTH_LINK_TTL_SECONDS,
      sendResetPassword: ({ user, url }) => sendLink("reset", user.email, url),
      // the endpoint itself carries no session, so this is the only place the
      // reset can be attributed to the account it changed
      onPasswordReset: async ({ user }) => {
         emitAuthEvent({
            action: "auth.password_reset",
            actorId: user.id,
         });
      },
   },
   emailVerification: {
      sendOnSignUp: true,
      expiresIn: AUTH_LINK_TTL_SECONDS,
      sendVerificationEmail: ({ user, url }) =>
         sendLink("verify", user.email, url),
   },
   hooks: {
      before: createAuthMiddleware(async (ctx) => {
         const absoluteSessionExpired = await enforceSessionPolicy(ctx);
         const rules = THROTTLES[ctx.path];
         const email = bodyEmail(ctx.body as HookBody);
         // server-side auth.api calls carry no headers: they key on the
         // address alone, like the mail throttles do
         const ip = ctx.headers?.get(CLIENT_IP_HEADER) ?? "";
         if (
            rules &&
            email &&
            !rules.every(({ throttle, key }) => throttle.allow(key(ip, email)))
         ) {
            throw new APIError("TOO_MANY_REQUESTS", {
               message: "Too many attempts. Try again in a few minutes.",
               code: "RATE_LIMITED",
            });
         }
         return {
            context: {
               context: {
                  absoluteSessionExpired,
                  auditActorId: await captureAuditActor(ctx),
               },
            },
         };
      }),
      // returning anything here would replace the endpoint's response, so both
      // calls stay side-effect only
      after: createAuthMiddleware(async (ctx) => {
         clearExpiredSessionCookie(ctx);
         recordAuthEvent(ctx);
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
            before: async (user) => {
               await assertSignUpAllowed(user.email);
               return {
                  data: {
                     ...user,
                     name: user.name || localPart(user.email),
                     email: normalizeEmail(user.email),
                     image: null,
                  },
               };
            },
            // every sign-up ends here, password or oauth, and only once the
            // row is committed
            after: async (user) => {
               emitAuthEvent({
                  action: "auth.sign_up",
                  actorId: user.id,
                  target: user.email,
               });
            },
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
              disableSignUp: signUpPolicy.mode === "closed",
              // undefined overrides avatar_url in the provider spread; the
              // create hook then writes null. nothing else is mapped: the map
              // is spread *after* the provider's own `verified` lookup
              // (github.mjs:76-84), so any emailVerified here would overwrite
              // github's answer with a constant
              mapProfileToUser: () => ({ image: undefined }),
           },
        }
      : undefined,
});

export { auth, onAuthEvent, onUserDeletion, signUpPolicy };
export type { SignUpPolicy } from "./env";
export type { DeletedUser, UserDeletionHooks } from "./user-deletion";
