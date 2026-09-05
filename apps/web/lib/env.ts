import { origin } from "@/lib/origin";

type RuntimeEnv = { siteUrl: string; apiUrl: string };

type PublicEnv = { siteOrigin: string; apiOrigin: string };

type NextData = { props?: { runtimeEnv?: Partial<RuntimeEnv> } };

const EMPTY: RuntimeEnv = { siteUrl: "", apiUrl: "" };

// next replaces a literal `process.env.NEXT_PUBLIC_*` with its build-time
// value, so one prebuilt image would carry whatever the builder had. reading
// through a name keeps the lookup at runtime, where the server does it.
const fromProcess = (name: string): string =>
   (typeof process === "undefined" ? undefined : process.env[name]) ?? "";

const serverRuntimeEnv = (): RuntimeEnv => ({
   siteUrl: fromProcess("NEXT_PUBLIC_SITE_URL"),
   apiUrl: fromProcess("NEXT_PUBLIC_API_URL"),
});

const nextData = (): NextData | undefined => {
   const injected = (window as { __NEXT_DATA__?: NextData }).__NEXT_DATA__;
   if (injected) return injected;
   const raw = document.getElementById("__NEXT_DATA__")?.textContent;
   return raw ? (JSON.parse(raw) as NextData) : undefined;
};

// `_app.getInitialProps` puts the pair in __NEXT_DATA__, and the browser reads
// it from there rather than from a prop: module constants such as `TERMS_URL`
// are computed when their module is imported, long before `_app` renders.
const clientRuntimeEnv = (): RuntimeEnv => {
   try {
      const { siteUrl, apiUrl } = nextData()?.props?.runtimeEnv ?? {};
      return { siteUrl: siteUrl ?? "", apiUrl: apiUrl ?? "" };
   } catch {
      return EMPTY;
   }
};

const toPublicEnv = ({ siteUrl, apiUrl }: RuntimeEnv): PublicEnv => ({
   siteOrigin: origin(siteUrl),
   apiOrigin: origin(apiUrl),
});

let resolved: PublicEnv | null = null;

const resolve = (): PublicEnv =>
   (resolved ??= toPublicEnv(
      typeof window === "undefined" ? serverRuntimeEnv() : clientRuntimeEnv()
   ));

const setRuntimeEnv = (env: RuntimeEnv | undefined): void => {
   if (env) resolved = toPublicEnv(env);
};

const publicEnv: PublicEnv = {
   get siteOrigin() {
      return resolve().siteOrigin;
   },
   get apiOrigin() {
      return resolve().apiOrigin;
   },
};

const landingOrigin = origin(fromProcess("LANDING_ORIGIN")) || undefined;

export { landingOrigin, publicEnv, serverRuntimeEnv, setRuntimeEnv };
export type { RuntimeEnv };
