import type { SignUpMode } from "@s3-viewer/types";

// "@a.com and @b.com" — the same phrasing the api uses in its refusal, so the
// hint under the field and the error that follows it read as one sentence
const domainList = (domains: readonly string[]): string => {
   const at = domains.map((domain) => `@${domain}`);
   if (at.length <= 1) return at.join("");
   return `${at.slice(0, -1).join(", ")} and ${at.at(-1)}`;
};

// the browser cannot see whether an address holds an invitation, and both
// `domains` and `invite` admit invited addresses, so the hint names that
// second route and the server stays the only thing that refuses
const signUpHint = (
   mode: SignUpMode,
   domains: readonly string[]
): string | undefined => {
   if (mode === "invite") return "New accounts are by invitation only.";
   if (mode !== "domains" || domains.length === 0) return undefined;
   return `New accounts are limited to ${domainList(domains)} addresses, or to invited addresses.`;
};

export { signUpHint };
