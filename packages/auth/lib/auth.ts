import { prisma } from "@s3-viewer/db";
import { sendAuthEmail } from "@s3-viewer/email";
import {
   AUTH_BASE_PATH,
   AUTH_CODE_LENGTH,
   AUTH_CODE_TTL_MINUTES,
   DAY_MS,
   HOUR_MS,
   SECOND_MS,
   SESSION_FRESH_HOURS,
   SESSION_TTL_DAYS,
   SITE_PATHS,
} from "@s3-viewer/types";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { emailOTP, magicLink } from "better-auth/plugins";
import { authFlowContext, type AuthFlowStore } from "./auth-flow-context";
import { authEnv } from "./env";
import { validateProfile } from "./profile";
import { onUserDeletion, userDeletionHooks } from "./user-deletion";
import { localPart, normalizeEmail } from "./utils";

const DAY_SECONDS = DAY_MS / SECOND_MS;
const HOUR_SECONDS = HOUR_MS / SECOND_MS;
const AUTH_CODE_TTL_SECONDS = AUTH_CODE_TTL_MINUTES * 60;
const SESSION_COOKIE_CACHE_SECONDS = 60;

type AuthCredentials = { otp: string; magicLinkUrl: string };

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
         async sendVerificationOTP({ email, otp }, request): Promise<void> {
            const flow = authFlowContext.getStore();
            if (flow) {
               flow.otp = otp;
               return;
            }
            await sendAuthFlowEmail(email, request?.headers ?? new Headers(), {
               otp,
            });
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
