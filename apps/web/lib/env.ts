import { origin } from "@/lib/origin";

// sign-in methods default on; only the literal `false` hides one. GitHub is
// the exception: it needs an OAuth app, so it is opt-in with `true`
const enabled = (value: string | undefined): boolean =>
   (value ?? "").trim().toLowerCase() !== "false";

const publicEnv = {
   siteOrigin: origin(process.env.NEXT_PUBLIC_SITE_URL),
   apiOrigin: origin(process.env.NEXT_PUBLIC_API_URL),
   emailLoginEnabled: enabled(process.env.NEXT_PUBLIC_EMAIL_LOGIN_ENABLED),
   passwordLoginEnabled: enabled(
      process.env.NEXT_PUBLIC_PASSWORD_LOGIN_ENABLED
   ),
   githubLoginEnabled: process.env.NEXT_PUBLIC_GITHUB_LOGIN_ENABLED === "true",
} as const;

const landingOrigin = origin(process.env.LANDING_ORIGIN) || undefined;

export { landingOrigin, publicEnv };
