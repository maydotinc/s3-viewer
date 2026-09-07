import { prisma } from "@s3-viewer/db";
import { APIError } from "better-auth/api";
import { emitAuthEvent } from "./audit";
import { signUpPolicy } from "./env";
import { SIGN_UPS_BY_INVITE, SIGN_UPS_CLOSED } from "./errors";
import { normalizeEmail } from "./utils";

// "@a.com and @b.com" reads better than a bare list and matches what the
// sign-in form shows under the email field
const domainList = (domains: readonly string[]): string => {
   const at = domains.map((domain) => `@${domain}`);
   if (at.length <= 1) return at.join("");
   return `${at.slice(0, -1).join(", ")} and ${at.at(-1)}`;
};

const domainRefusal = (domains: readonly string[]): string =>
   `Sign-ups are limited to ${domainList(domains)} addresses, or to invited addresses.`;

const emailDomain = (email: string): string => email.split("@").at(-1) ?? "";

// the same predicate apps/api/lib/services/invites.ts matches on, restated
// here because packages/auth cannot import the api app: an invitation that
// has not expired yet is a standing invitation to create this account
const hasLiveInvite = async (email: string): Promise<boolean> =>
   (await prisma.pendingInvitation.count({
      where: { email, expiresAt: { gt: new Date() } },
   })) > 0;

type Refusal = { code: string; message: string };

const INVITE_REQUIRED = "SIGNUP_INVITE_REQUIRED";

const refuseSignUp = async (email: string): Promise<Refusal | null> => {
   const { mode, allowedEmailDomains } = signUpPolicy;
   if (mode === "open") return null;
   if (mode === "closed") {
      return { code: "SIGNUP_DISABLED", message: SIGN_UPS_CLOSED };
   }
   if (mode === "domains" && allowedEmailDomains.includes(emailDomain(email))) {
      return null;
   }
   if (await hasLiveInvite(email)) return null;
   return {
      code: INVITE_REQUIRED,
      message:
         mode === "domains"
            ? domainRefusal(allowedEmailDomains)
            : SIGN_UPS_BY_INVITE,
   };
};

// belt and braces behind emailAndPassword.disableSignUp and the provider's
// own disableSignUp (both of which only close `closed` mode): every path that
// creates a user row goes through here, including any future provider
const assertSignUpAllowed = async (email: string): Promise<void> => {
   const address = normalizeEmail(email);
   const refusal = await refuseSignUp(address);
   if (!refusal) return;
   emitAuthEvent({ action: "auth.sign_up_refused", target: address });
   throw new APIError("FORBIDDEN", refusal);
};

export { assertSignUpAllowed, domainRefusal };
