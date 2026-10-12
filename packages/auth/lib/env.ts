import {
   deriveSharedEnv,
   parseSharedEnv,
   signUpPolicyOf,
} from "@s3-viewer/types/env";

// the API validates the same shape first and reports every problem at once;
// this read only shapes values that are already known to be valid.
const shared = parseSharedEnv(process.env);

const signUpPolicy = signUpPolicyOf(shared);

const authEnv = {
   secret: shared.BETTER_AUTH_SECRET,
   rateLimitStore: shared.RATE_LIMIT_STORE,
   cookieSameSite: shared.COOKIE_SAMESITE,
   ...deriveSharedEnv(shared),
} as const;

export { authEnv, signUpPolicy };
