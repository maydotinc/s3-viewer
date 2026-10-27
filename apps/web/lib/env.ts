import { origin } from "./origin";

type RuntimeEnv = { siteUrl: string; apiUrl: string; hasLanding: boolean };

type PublicEnv = { siteOrigin: string; apiOrigin: string; hasLanding: boolean };

type NextData = { props?: { runtimeEnv?: Partial<RuntimeEnv> } };

const EMPTY: RuntimeEnv = { siteUrl: "", apiUrl: "", hasLanding: false };

// a literal `process.env.NEXT_PUBLIC_*` is inlined at build time; a dynamic name stays runtime.
const fromProcess = (name: string): string =>
   (typeof process === "undefined" ? undefined : process.env[name]) ?? "";

const landingOrigin = origin(fromProcess("LANDING_ORIGIN")) || undefined;

const serverRuntimeEnv = (): RuntimeEnv => ({
   siteUrl: fromProcess("NEXT_PUBLIC_SITE_URL"),
   apiUrl: fromProcess("NEXT_PUBLIC_API_URL"),
   hasLanding: Boolean(landingOrigin),
});

const nextData = (): NextData | undefined => {
   const injected = (window as { __NEXT_DATA__?: NextData }).__NEXT_DATA__;
   if (injected) return injected;
   const raw = document.getElementById("__NEXT_DATA__")?.textContent;
   return raw ? (JSON.parse(raw) as NextData) : undefined;
};

// module constants are computed before `_app` renders, so read __NEXT_DATA__ directly.
const clientRuntimeEnv = (): RuntimeEnv => {
   try {
      const { siteUrl, apiUrl, hasLanding } =
         nextData()?.props?.runtimeEnv ?? {};
      return {
         siteUrl: siteUrl ?? "",
         apiUrl: apiUrl ?? "",
         hasLanding: hasLanding === true,
      };
   } catch {
      return EMPTY;
   }
};

const toPublicEnv = ({
   siteUrl,
   apiUrl,
   hasLanding,
}: RuntimeEnv): PublicEnv => ({
   siteOrigin: origin(siteUrl),
   apiOrigin: origin(apiUrl),
   hasLanding,
});

let resolved: PublicEnv | null = null;

const resolve = (): PublicEnv =>
   (resolved ??= toPublicEnv(
      typeof window === "undefined" ? serverRuntimeEnv() : clientRuntimeEnv()
   ));

const setRuntimeEnv = (env: RuntimeEnv | undefined): void => {
   if (env && (env.siteUrl || env.apiUrl)) resolved = toPublicEnv(env);
};

const publicEnv: PublicEnv = {
   get siteOrigin() {
      return resolve().siteOrigin;
   },
   get apiOrigin() {
      return resolve().apiOrigin;
   },
   get hasLanding() {
      return resolve().hasLanding;
   },
};

export { landingOrigin, publicEnv, serverRuntimeEnv, setRuntimeEnv };
export type { RuntimeEnv };
