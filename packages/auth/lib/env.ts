import type { SignUpMode } from "@s3-viewer/types";
import dotenv from "dotenv";

dotenv.config();

type SignUpPolicy = {
   mode: SignUpMode;
   allowedEmailDomains: readonly string[];
};

const SIGN_UP_MODES: readonly SignUpMode[] = [
   "open",
   "domains",
   "invite",
   "closed",
];

const required = (name: string): string => {
   const value = process.env[name];
   if (!value) throw new Error(`${name} is not set`);
   return value;
};

// operators write these as `@a.com, b.com` or one per line; both forms and a
// leading @ are accepted so the value can be pasted from anywhere
const parseDomains = (raw: string | undefined): readonly string[] => [
   ...new Set(
      (raw ?? "")
         .split(/[\s,]+/)
         .map((entry) => entry.trim().toLowerCase().replace(/^@/, ""))
         .filter(Boolean)
   ),
];

const parseSignUpPolicy = (): SignUpPolicy => {
   const allowedEmailDomains = parseDomains(process.env.ALLOWED_EMAIL_DOMAINS);
   const raw = process.env.SIGNUP_MODE?.trim().toLowerCase();
   // a list on its own is unambiguous intent: an operator who set it never
   // meant sign-ups to stay open to everyone
   const mode: SignUpMode = raw
      ? ((): SignUpMode => {
           if (!SIGN_UP_MODES.includes(raw as SignUpMode)) {
              throw new Error(
                 `SIGNUP_MODE must be one of ${SIGN_UP_MODES.join(", ")}`
              );
           }
           return raw as SignUpMode;
        })()
      : allowedEmailDomains.length > 0
        ? "domains"
        : "open";
   if (mode === "domains" && allowedEmailDomains.length === 0) {
      throw new Error(
         "SIGNUP_MODE=domains needs ALLOWED_EMAIL_DOMAINS: set it to a comma-separated list such as `acme.com, acme.dev`"
      );
   }
   return { mode, allowedEmailDomains };
};

const api = new URL(required("NEXT_PUBLIC_API_URL"));
const cookieSameSite = process.env.COOKIE_SAMESITE || "lax";
if (cookieSameSite !== "lax" && cookieSameSite !== "none") {
   throw new Error("COOKIE_SAMESITE must be `lax` or `none`");
}
if (cookieSameSite === "none" && api.protocol !== "https:") {
   throw new Error(
      "COOKIE_SAMESITE=none needs an https:// NEXT_PUBLIC_API_URL: browsers drop SameSite=None cookies that are not Secure"
   );
}
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const signUpPolicy: SignUpPolicy = parseSignUpPolicy();

const authEnv = {
   secret: required("BETTER_AUTH_SECRET"),
   apiOrigin: api.origin,
   apiIsHttps: api.protocol === "https:",
   cookieSameSite,
   siteOrigin: new URL(required("NEXT_PUBLIC_SITE_URL")).origin,
   github:
      githubClientId && githubClientSecret
         ? { clientId: githubClientId, clientSecret: githubClientSecret }
         : null,
} as const;

export { authEnv, parseDomains, signUpPolicy };
export type { SignUpPolicy };
