import { prisma } from "@s3-viewer/db";
import { liveInvite } from "@s3-viewer/db/invitations";
import {
   emailSchema,
   formatEmailDomains,
   normalizeEmail,
} from "@s3-viewer/shared";
import { APIError } from "better-auth/api";
import { signUpPolicy } from "./env";
import { AuthErrorCode, SIGN_UPS_BY_INVITE, SIGN_UPS_CLOSED } from "./errors";

const domainRefusal = (domains: readonly string[]): string =>
   `Sign-ups are limited to ${formatEmailDomains(domains)} addresses, or to the link in an invitation email.`;

const emailDomain = (email: string): string => email.split("@").at(-1) ?? "";

const INVITE_TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

const hasLiveInvite = async (
   email: string,
   inviteToken: string | undefined
): Promise<boolean> => {
   if (inviteToken !== undefined && !INVITE_TOKEN.test(inviteToken))
      return false;
   return (
      (await prisma.pendingInvitation.count({
         where: { email, ...liveInvite(), token: inviteToken },
      })) > 0
   );
};

type Refusal = { code: string; message: string };
type SignUpSource = {
   emailVerified: boolean;
   inviteToken: string | undefined;
   passwordSignUp: boolean;
};

const refuseSignUp = async (
   email: string,
   { emailVerified, inviteToken }: SignUpSource
): Promise<Refusal | null> => {
   const { mode, allowedEmailDomains } = signUpPolicy;
   if (mode === "open") return null;
   if (mode === "closed") {
      return { code: AuthErrorCode.SIGNUP_DISABLED, message: SIGN_UPS_CLOSED };
   }
   if (mode === "domains" && allowedEmailDomains.includes(emailDomain(email))) {
      return null;
   }
   const required = emailVerified ? undefined : (inviteToken ?? "");
   if (await hasLiveInvite(email, required)) return null;
   return {
      code: AuthErrorCode.SIGNUP_INVITE_REQUIRED,
      message:
         mode === "domains"
            ? domainRefusal(allowedEmailDomains)
            : SIGN_UPS_BY_INVITE,
   };
};

// provider links survive the real owner's password reset, so only password sign-ups may be unverified.
const UNVERIFIED_PROVIDER_EMAIL: Refusal = {
   code: AuthErrorCode.PROVIDER_EMAIL_UNVERIFIED,
   message: "Verify this email address with GitHub, then sign in again.",
};

const assertSignUpAllowed = async (
   email: string,
   source: SignUpSource
): Promise<void> => {
   const address = normalizeEmail(email);
   const refusal =
      (await refuseSignUp(address, source)) ??
      (source.emailVerified || source.passwordSignUp
         ? null
         : UNVERIFIED_PROVIDER_EMAIL);
   if (!refusal) return;
   throw new APIError("FORBIDDEN", refusal);
};

// refusals must come from this hook: with verification required, Better Auth turns a
// refusal raised while creating the user into a fake success.
const assertPasswordSignUpAllowed = async (
   email: unknown,
   inviteToken: string | undefined
): Promise<void> => {
   if (signUpPolicy.mode === "open") return;
   const address = emailSchema.safeParse(email);
   if (!address.success) return;
   await assertSignUpAllowed(address.data, {
      emailVerified: false,
      inviteToken,
      passwordSignUp: true,
   });
};

export { assertPasswordSignUpAllowed, assertSignUpAllowed };
