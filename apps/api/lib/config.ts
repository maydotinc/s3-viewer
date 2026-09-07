import { env } from "@/lib/env";
import { encryptionPublicKey } from "@/lib/utils/encryption";
import { signUpPolicy } from "@s3-viewer/auth";
import type { PublicConfig } from "@s3-viewer/types";

// everything the web app needs before a user signs in, so one prebuilt image
// serves any install: none of it is baked into the browser bundle
const publicConfig = (): PublicConfig => ({
   encryptionPublicKey: encryptionPublicKey(),
   githubLoginEnabled: Boolean(env.GITHUB_CLIENT_ID),
   emailEnabled: env.EMAIL_TRANSPORT !== "none",
   signUpMode: signUpPolicy.mode,
   // only meaningful in `domains` mode; the sign-in form lists them so a
   // refused address is told before it is submitted, not after
   allowedEmailDomains: [...signUpPolicy.allowedEmailDomains],
});

export { publicConfig };
