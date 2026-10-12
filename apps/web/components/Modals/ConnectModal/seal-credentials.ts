import { ENCRYPTION_ERROR } from "@/lib/hooks/queries/useInstanceConfig";
import { encryptCredentials } from "@/lib/utils/encryption";
import type { PublicConfig } from "@s3-viewer/types";
import {
   toServerCredentials,
   validateCredentialFields,
   type CredentialFields,
} from "./credentials-fields";

type SealedCredentials = { encrypted: string } | { error: string };

// validates first so a bad field never reaches the slow encryption step.
const sealCredentialFields = async (
   fields: CredentialFields,
   config: PublicConfig | undefined,
   userId: string
): Promise<SealedCredentials> => {
   const message = validateCredentialFields(
      fields,
      config?.allowInsecureEndpoints ?? false
   );
   if (message) return { error: message };
   try {
      return {
         encrypted: await encryptCredentials(
            toServerCredentials(fields),
            config?.encryptionPublicKey ?? "",
            userId
         ),
      };
   } catch {
      return { error: ENCRYPTION_ERROR };
   }
};

export { sealCredentialFields };
