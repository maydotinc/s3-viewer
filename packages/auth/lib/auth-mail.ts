import {
   sendPasswordResetEmail,
   sendVerificationCodeEmail,
} from "@s3-viewer/email";
import {
   AUTH_LINK_TTL_HOURS,
   HOUR_MS,
   MINUTE_MS,
   VERIFICATION_CODE_TTL_MINUTES,
   canonicalMailbox,
   describeError,
} from "@s3-viewer/shared";
import { makeThrottle } from "./hook-throttles";
import { authLog } from "./log";
import type { Throttle } from "./throttle";

// per-address limits only suppress delivery and never refuse the request, so no stranger can turn them into a 429.
const MAIL_PER_ADDRESS: readonly Throttle[] = [
   makeThrottle("mail-address-burst", 1, MINUTE_MS),
   makeThrottle("mail-address", 10, HOUR_MS),
];

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
         authLog().warn("Auth email suppressed: address mailed recently", {
            kind,
         });
         return;
      }
      await send();
   } catch (error) {
      authLog().error("Auth email failed", {
         kind,
         error: describeError(error),
      });
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

export { sendResetLink, sendVerificationCode };
