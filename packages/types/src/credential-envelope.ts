export const CREDENTIAL_ENVELOPE_VERSION = 2;
export const CREDENTIAL_AES_KEY_BITS = 256;
export const CREDENTIAL_AES_KEY_BYTES = CREDENTIAL_AES_KEY_BITS / 8;
export const CREDENTIAL_GCM_IV_BYTES = 12;

export type CredentialEnvelope = {
   v: typeof CREDENTIAL_ENVELOPE_VERSION;
   k: string;
   iv: string;
   ct: string;
};
