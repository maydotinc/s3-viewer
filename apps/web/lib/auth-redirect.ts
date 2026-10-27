import { INVITE_QUERY_PARAM, SITE_PATHS } from "@s3-viewer/shared";

const isSafeNextPath = (value: unknown): value is string =>
   typeof value === "string" &&
   value.startsWith("/") &&
   !value.startsWith("//") &&
   !value.startsWith("/\\") &&
   !/[\s\p{Cc}]/u.test(value);

// a signed-in visitor is sent on from these; a reset link stays usable from any session
const AUTH_SCREENS = new Set<string>([
   SITE_PATHS.login,
   SITE_PATHS.signup,
   SITE_PATHS.forgotPassword,
]);

const NOT_AFTER_LOGIN = new Set<string>([
   ...AUTH_SCREENS,
   SITE_PATHS.resetPassword,
]);

const PUBLIC_PATHS = new Set<string>([...NOT_AFTER_LOGIN, "/404", "/_error"]);

// a `next` pointing back at an auth screen would loop the signed-in redirect.
const afterLoginPath = (next: string | string[] | undefined): string => {
   if (!isSafeNextPath(next)) return SITE_PATHS.dashboard;
   const { pathname } = new URL(next, "http://placeholder");
   return NOT_AFTER_LOGIN.has(pathname) ? SITE_PATHS.dashboard : next;
};

const inviteIdFrom = (
   next: string | string[] | undefined
): string | undefined => {
   if (!isSafeNextPath(next)) return undefined;
   const url = new URL(next, "http://placeholder");
   if (url.pathname !== SITE_PATHS.settingsInvites) return undefined;
   return url.searchParams.get(INVITE_QUERY_PARAM) || undefined;
};

const loginPathFor = (asPath: string, reason?: string): string => {
   const url = new URL(asPath, "http://placeholder");
   const next = `${url.pathname}${url.search}`;
   const params = new URLSearchParams();
   if (next !== "/") params.set("next", next);
   if (reason) params.set("reason", reason);
   const query = params.toString();
   return query ? `${SITE_PATHS.login}?${query}` : SITE_PATHS.login;
};

export {
   afterLoginPath,
   AUTH_SCREENS,
   inviteIdFrom,
   isSafeNextPath,
   loginPathFor,
   PUBLIC_PATHS,
};
