const required = (name: string, value: string | undefined): string => {
   if (!value) throw new Error(`${name} is not set`);
   return value;
};

const publicEnv = {
   siteOrigin: new URL(
      required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL)
   ).origin,
   apiOrigin: new URL(
      required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)
   ).origin,
   githubLoginEnabled: process.env.NEXT_PUBLIC_GITHUB_LOGIN_ENABLED === "true",
} as const;

const landingOrigin = process.env.LANDING_ORIGIN
   ? new URL(process.env.LANDING_ORIGIN).origin
   : undefined;

export { landingOrigin, publicEnv };
