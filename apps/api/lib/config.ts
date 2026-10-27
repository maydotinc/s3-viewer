import { allowsInsecureEndpoints } from "./utils/endpoint";
import { env } from "./env";
import { encryptionPublicKey } from "@/lib/utils/encryption";
import { signUpPolicy } from "@s3-viewer/auth";
import type { PublicConfig } from "@s3-viewer/shared";

const publicConfig = (): PublicConfig => ({
   encryptionPublicKey: encryptionPublicKey(),
   allowInsecureEndpoints: allowsInsecureEndpoints(),
   githubLoginEnabled: Boolean(env.GITHUB_CLIENT_ID),
   emailEnabled: env.EMAIL_TRANSPORT !== "none",
   signUpMode: signUpPolicy.mode,
   allowedEmailDomains: [...signUpPolicy.allowedEmailDomains],
});

export { publicConfig };
