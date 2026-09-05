import { origin } from "@/lib/origin";

const publicEnv = {
   siteOrigin: origin(process.env.NEXT_PUBLIC_SITE_URL),
   apiOrigin: origin(process.env.NEXT_PUBLIC_API_URL),
   // github needs an oauth app, so it is opt-in with exactly `true`
   githubLoginEnabled: process.env.NEXT_PUBLIC_GITHUB_LOGIN_ENABLED === "true",
} as const;

const landingOrigin = origin(process.env.LANDING_ORIGIN) || undefined;

export { landingOrigin, publicEnv };
