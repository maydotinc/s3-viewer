import { formatEmailDomains, type SignUpMode } from "@s3-viewer/shared";

const signUpHint = (
   mode: SignUpMode,
   domains: readonly string[]
): string | undefined => {
   if (mode === "invite") return "New accounts are by invitation only.";
   if (mode !== "domains" || domains.length === 0) return undefined;
   return `New accounts are limited to ${formatEmailDomains(domains)} addresses, or to invited addresses.`;
};

export { signUpHint };
