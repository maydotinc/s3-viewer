import { prisma } from "@s3-viewer/db";
import { sendAuthEmail } from "@s3-viewer/email";
import {
   AUTH_BASE_PATH,
   AUTH_CODE_LENGTH,
   AUTH_CODE_TTL_MINUTES,
   DAY_MS,
   SECOND_MS,
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
import { localPart } from "./utils";

const DAY_SECONDS = DAY_MS / SECOND_MS;
const AUTH_CODE_TTL_SECONDS = AUTH_CODE_TTL_MINUTES * 60;

type AuthCredentials = { otp: string; magicLinkUrl: string };

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
   },
   user: {
      deleteUser: { enabled: true },
   },
   rateLimit: { enabled: false },
   databaseHooks: {
      user: {
         create: {
            // `image: null` is the last word on profile pictures: the column
            // exists because Better Auth's core user model declares it, but
            // nothing in the product ever fills it in. Avatars are drawn from
            // the name in the web app.
            before: async (user) => ({
               data: {
                  ...user,
                  name: user.name || localPart(user.email),
                  image: null,
               },
            }),
         },
         update: {
            // `/update-user` accepts any name/image; this is the one place
            // the name is checked and any image is stripped.
            before: async (user) => {
               const result = validateProfile(user);
               if (!result.ok) {
                  throw new APIError("BAD_REQUEST", {
                     message: result.message,
                  });
               }
               return { data: { ...user, ...result.data } };
            },
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
              // Drop GitHub's avatar_url before it reaches the user row.
              // The option's return type only allows `string | undefined`,
              // and `undefined` is enough: it overrides `avatar_url` in the
              // provider's spread, and the create hook below writes `null`.
              mapProfileToUser: () => ({ image: undefined }),
           },
        }
      : undefined,
});

export { auth, sendAuthFlowEmail };
