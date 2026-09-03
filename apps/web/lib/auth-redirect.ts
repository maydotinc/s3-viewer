import { SITE_PATHS } from "@s3-viewer/types";

const MAGIC_LINK_ERRORS = new Set([
   "INVALID_TOKEN",
   "EXPIRED_TOKEN",
   "failed_to_create_user",
   "failed_to_create_session",
]);

const isSafeNextPath = (value: unknown): value is string =>
   typeof value === "string" &&
   value.startsWith("/") &&
   !value.startsWith("//") &&
   !value.startsWith("/\\") &&
   !/[\s\p{Cc}]/u.test(value);

const afterLoginPath = (next: string | string[] | undefined): string =>
   isSafeNextPath(next) ? next : SITE_PATHS.dashboard;

const loginPathFor = (asPath: string): string => {
   const url = new URL(asPath, "http://placeholder");
   const error = url.searchParams.get("error");
   const linkFailed = error !== null && MAGIC_LINK_ERRORS.has(error);
   if (linkFailed) url.searchParams.delete("error");

   const params = new URLSearchParams();
   const next = `${url.pathname}${url.search}`;
   if (next !== "/") params.set("next", next);
   if (linkFailed) params.set("reason", "link");

   const query = params.toString();
   return query ? `${SITE_PATHS.login}?${query}` : SITE_PATHS.login;
};

export { afterLoginPath, isSafeNextPath, loginPathFor };
