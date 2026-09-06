import dotenv from "dotenv";

dotenv.config();

const required = (name: string): string => {
   const value = process.env[name];
   if (!value) throw new Error(`${name} is not set`);
   return value;
};

const api = new URL(required("NEXT_PUBLIC_API_URL"));
const cookieSameSite = process.env.COOKIE_SAMESITE || "lax";
if (cookieSameSite !== "lax" && cookieSameSite !== "none") {
   throw new Error("COOKIE_SAMESITE must be `lax` or `none`");
}
if (cookieSameSite === "none" && api.protocol !== "https:") {
   throw new Error(
      "COOKIE_SAMESITE=none needs an https:// NEXT_PUBLIC_API_URL: browsers drop SameSite=None cookies that are not Secure"
   );
}
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const authEnv = {
   secret: required("BETTER_AUTH_SECRET"),
   apiOrigin: api.origin,
   apiIsHttps: api.protocol === "https:",
   cookieSameSite,
   siteOrigin: new URL(required("NEXT_PUBLIC_SITE_URL")).origin,
   github:
      githubClientId && githubClientSecret
         ? { clientId: githubClientId, clientSecret: githubClientSecret }
         : null,
} as const;

export { authEnv };
