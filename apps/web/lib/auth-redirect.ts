import { SITE_PATHS } from "@s3-viewer/types";

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
   const next = `${url.pathname}${url.search}`;
   return next === "/"
      ? SITE_PATHS.login
      : `${SITE_PATHS.login}?${new URLSearchParams({ next })}`;
};

export { afterLoginPath, isSafeNextPath, loginPathFor };
