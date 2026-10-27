import { HOUR_MS } from "@s3-viewer/shared";
import { APIError } from "better-auth/api";
import { AuthErrorCode, TOO_MANY_CODE_GUESSES } from "./errors";
import type { HookContext } from "./hook-throttles";

const CODE_MAX_AGE_MS = HOUR_MS;

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

// the hook's context and auth.$context differ only in their options type parameter.
type ResetLinkStore = {
   adapter: Pick<HookContext["context"]["adapter"], "deleteMany">;
};

// reset rows store the user id as their value; identifiers are hashed.
const dropOutstandingResetLinks = async (
   { adapter }: ResetLinkStore,
   userId: string
): Promise<void> => {
   await adapter.deleteMany({
      model: "verification",
      where: [{ field: "value", value: userId }],
   });
};

// a resend reuses the live code and restarts its expiry, so anyone could otherwise keep one code valid for weeks.
const expireStaleCode = async (
   ctx: HookContext,
   email: string
): Promise<void> => {
   const identifier = `email-verification-otp-${email}`;
   const existing =
      await ctx.context.internalAdapter.findVerificationValue(identifier);
   if (!existing) return;
   const issuedAt = new Date(existing.createdAt ?? NaN).getTime();
   if (!(Date.now() - issuedAt < CODE_MAX_AGE_MS))
      await ctx.context.internalAdapter.deleteVerificationByIdentifier(
         identifier
      );
};

export {
   assertPasswordForCode,
   codeGuessesSpent,
   dropOutstandingResetLinks,
   expireStaleCode,
   resetTokenOwner,
};
