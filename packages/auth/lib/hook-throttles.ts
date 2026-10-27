import {
   CLIENT_IP_HEADER,
   DAY_MS,
   HOUR_MS,
   MAX_EMAIL_LENGTH,
   MINUTE_MS,
   VERIFICATION_CODE_ATTEMPTS,
   normalizeEmail,
} from "@s3-viewer/shared";
import { APIError, isAPIError, type getSessionFromCtx } from "better-auth/api";
import { authEnv } from "./env";
import { AuthErrorCode, TOO_MANY_ATTEMPTS } from "./errors";
import {
   CHANGE_PASSWORD_PATH,
   DELETE_USER_PATH,
   PASSWORD_SIGN_UP_PATH,
   SEND_CODE_PATH,
   SIGN_IN_PATH,
   VERIFY_CODE_PATH,
} from "./paths";
import {
   createThrottle,
   perAddress,
   perAddressAndIp,
   perIp,
   type Throttle,
   type ThrottleKey,
} from "./throttle";

type HookBody =
   | { email?: unknown; password?: unknown; type?: unknown }
   | undefined;

type HookContext = Parameters<typeof getSessionFromCtx>[0];

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

// request-level mail limits are per source, so nobody else can spend a victim's budget into a 429.
const MAIL_RULES: readonly ThrottleRule[] = [
   { throttle: makeThrottle("mail-ip", 10, 10 * MINUTE_MS), key: perIp },
];

const SIGN_IN_RULES: readonly ThrottleRule[] = [
   {
      throttle: makeThrottle("sign-in", 10, 10 * MINUTE_MS),
      key: perAddressAndIp,
   },
   // successful sign-ins are refunded, but failures from any source count: ~100/hour
   // locks password sign-in for the address until the window resets.
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
   [CHANGE_PASSWORD_PATH]: passwordCheckThrottle,
   [DELETE_USER_PATH]: passwordCheckThrottle,
};

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

const bodyEmail = (body: HookBody): string => {
   if (typeof body?.email !== "string") return "";
   return body.email.length > MAX_EMAIL_LENGTH
      ? OVERLONG_EMAIL
      : normalizeEmail(body.email);
};

type Outcome = {
   path: string;
   context: { newSession?: unknown; returned?: unknown };
};

// sign-up opens no session, and a correct password on an unverified
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

export {
   OVERLONG_EMAIL,
   SESSION_THROTTLES,
   allowedBy,
   codeGuessThrottle,
   hookThrottles,
   lookup,
   makeThrottle,
   settleThrottles,
   succeeded,
   tooManyAttempts,
};
export type { HookBody, HookContext };
