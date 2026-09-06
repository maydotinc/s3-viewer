import { SITE_PATHS } from "@s3-viewer/types";

const isSafeNextPath = (value: unknown): value is string =>
   typeof value === "string" &&
   value.startsWith("/") &&
   !value.startsWith("//") &&
   !value.startsWith("/\\") &&
   !/[\s\p{Cc}]/u.test(value);

const afterLoginPath = (next: string | string[] | undefined): string =>
   isSafeNextPath(next) ? next : SITE_PATHS.dashboard;

// `reason` keys a notice on the login page (see AuthScreen's NOTICES)
const loginPathFor = (asPath: string, reason?: string): string => {
   const url = new URL(asPath, "http://placeholder");
   const next = `${url.pathname}${url.search}`;
   const params = new URLSearchParams();
   if (next !== "/") params.set("next", next);
   if (reason) params.set("reason", reason);
   const query = params.toString();
   return query ? `${SITE_PATHS.login}?${query}` : SITE_PATHS.login;
};

export { afterLoginPath, isSafeNextPath, loginPathFor };
