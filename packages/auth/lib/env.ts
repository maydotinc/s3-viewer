import dotenv from "dotenv";

dotenv.config();

const required = (name: string): string => {
   const value = process.env[name];
   if (!value) throw new Error(`${name} is not set`);
   return value;
};

// unset ⇒ on; only the literal `false` turns a method off
const enabled = (name: string): boolean =>
   (process.env[name] ?? "").trim().toLowerCase() !== "false";

const api = new URL(required("NEXT_PUBLIC_API_URL"));
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

const authEnv = {
   secret: required("BETTER_AUTH_SECRET"),
   apiOrigin: api.origin,
   apiIsHttps: api.protocol === "https:",
   siteOrigin: new URL(required("NEXT_PUBLIC_SITE_URL")).origin,
   emailLogin: enabled("EMAIL_LOGIN_ENABLED"),
   passwordLogin: enabled("PASSWORD_LOGIN_ENABLED"),
   github:
      githubClientId && githubClientSecret
         ? { clientId: githubClientId, clientSecret: githubClientSecret }
         : null,
} as const;

export { authEnv };
