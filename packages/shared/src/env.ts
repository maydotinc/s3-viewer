import { SIGN_UP_MODES, type SignUpMode } from "./server-types";
import { z } from "zod";

const optionalString = z
   .string()
   .trim()
   .optional()
   .transform((value) => value || undefined);

const lowercase = optionalString.transform((value) => value?.toLowerCase());

const TRUE_FLAGS = ["true", "1", "yes", "on"];
const FALSE_FLAGS = ["false", "0", "no", "off"];
// a misspelt flag must fail loudly: silently reading it as false hides the operator's intent.
const flag = optionalString.transform((value, ctx) => {
   const text = value?.toLowerCase();
   if (text === undefined || FALSE_FLAGS.includes(text)) return false;
   if (TRUE_FLAGS.includes(text)) return true;
   ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `expected true or false, got "${value}"`,
   });
   return z.NEVER;
});

type OptionalText = z.ZodType<string | undefined, z.ZodTypeDef, unknown>;

/** an unset or blank variable takes `fallback`; anything else must pass `schema`. */
const withDefault = <T extends z.ZodTypeAny>(
   schema: T,
   fallback: z.output<T>,
   source: OptionalText = optionalString
) =>
   source
      .pipe(schema.optional())
      .transform((value): z.output<T> => value ?? fallback);

const parseDomains = (raw: string | undefined): readonly string[] => [
   ...new Set(
      (raw ?? "")
         .split(/[\s,]+/)
         .map((entry) => entry.trim().toLowerCase().replace(/^@/, ""))
         .filter(Boolean)
   ),
];

// the domain shape emailSchema accepts, so every listed entry can match an address.
const BARE_DOMAIN = /^([a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/;

const sharedEnvShape = {
   BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
   NEXT_PUBLIC_SITE_URL: z.string().url(),
   NEXT_PUBLIC_API_URL: z.string().url(),
   GITHUB_CLIENT_ID: optionalString,
   GITHUB_CLIENT_SECRET: optionalString,
   RATE_LIMIT_STORE: withDefault(
      z.enum(["memory", "postgres"]),
      "postgres",
      lowercase
   ),
   COOKIE_SAMESITE: withDefault(
      z.enum(["lax", "none"], {
         errorMap: () => ({ message: "must be `lax` or `none`" }),
      }),
      "lax",
      lowercase
   ),
   SIGNUP_MODE: lowercase.pipe(
      z
         .enum(SIGN_UP_MODES, {
            errorMap: () => ({
               message: `must be one of ${SIGN_UP_MODES.join(", ")}`,
            }),
         })
         .optional()
   ),
   ALLOWED_EMAIL_DOMAINS: optionalString.transform(parseDomains).refine(
      (domains) => domains.every((domain) => BARE_DOMAIN.test(domain)),
      (domains) => ({
         message: `each entry must be a bare domain such as \`acme.com\` (no wildcard, scheme or trailing dot); got ${domains
            .filter((domain) => !BARE_DOMAIN.test(domain))
            .map((domain) => `\`${domain}\``)
            .join(", ")}`,
      })
   ),
};

const sharedEnvSchema = z.object(sharedEnvShape);

type SharedEnv = z.infer<typeof sharedEnvSchema>;

type SignUpPolicy = {
   mode: SignUpMode;
   allowedEmailDomains: readonly string[];
};

const signUpPolicyOf = (
   env: Pick<SharedEnv, "SIGNUP_MODE" | "ALLOWED_EMAIL_DOMAINS">
): SignUpPolicy => ({
   mode:
      env.SIGNUP_MODE ??
      (env.ALLOWED_EMAIL_DOMAINS.length > 0 ? "domains" : "open"),
   allowedEmailDomains: env.ALLOWED_EMAIL_DOMAINS,
});

const refineSharedEnv = (
   value: Pick<
      SharedEnv,
      | "GITHUB_CLIENT_ID"
      | "GITHUB_CLIENT_SECRET"
      | "COOKIE_SAMESITE"
      | "NEXT_PUBLIC_API_URL"
      | "SIGNUP_MODE"
      | "ALLOWED_EMAIL_DOMAINS"
   >,
   ctx: z.RefinementCtx
): void => {
   if (
      Boolean(value.GITHUB_CLIENT_ID) !== Boolean(value.GITHUB_CLIENT_SECRET)
   ) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["GITHUB_CLIENT_SECRET"],
         message:
            "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set together",
      });
   }
   if (
      value.COOKIE_SAMESITE === "none" &&
      URL.canParse(value.NEXT_PUBLIC_API_URL) &&
      new URL(value.NEXT_PUBLIC_API_URL).protocol !== "https:"
   ) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["COOKIE_SAMESITE"],
         message:
            "`none` needs an https:// NEXT_PUBLIC_API_URL: browsers drop SameSite=None cookies that are not Secure",
      });
   }
   if (
      signUpPolicyOf(value).mode === "domains" &&
      value.ALLOWED_EMAIL_DOMAINS.length === 0
   ) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["ALLOWED_EMAIL_DOMAINS"],
         message:
            "required when SIGNUP_MODE is `domains`: a comma-separated list such as `acme.com, acme.dev`",
      });
   }
};

const describeEnvIssues = (error: z.ZodError): string =>
   error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

type EnvSource = Record<string, string | undefined>;

const parseEnv = <S extends z.ZodTypeAny>(
   schema: S,
   source: EnvSource
): z.output<S> => {
   const parsed = schema.safeParse(source);
   if (!parsed.success) {
      throw new Error(
         `Invalid environment: ${describeEnvIssues(parsed.error)}`
      );
   }
   return parsed.data;
};

const parseSharedEnv = (source: EnvSource): SharedEnv =>
   parseEnv(sharedEnvSchema.superRefine(refineSharedEnv), source);

const deriveSharedEnv = (
   env: Pick<
      SharedEnv,
      | "NEXT_PUBLIC_SITE_URL"
      | "NEXT_PUBLIC_API_URL"
      | "GITHUB_CLIENT_ID"
      | "GITHUB_CLIENT_SECRET"
   >
) => {
   const api = new URL(env.NEXT_PUBLIC_API_URL);
   return {
      siteOrigin: new URL(env.NEXT_PUBLIC_SITE_URL).origin,
      apiOrigin: api.origin,
      apiIsHttps: api.protocol === "https:",
      github:
         env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
            ? {
                 clientId: env.GITHUB_CLIENT_ID,
                 clientSecret: env.GITHUB_CLIENT_SECRET,
              }
            : null,
   };
};

export {
   deriveSharedEnv,
   flag,
   lowercase,
   optionalString,
   parseEnv,
   parseSharedEnv,
   refineSharedEnv,
   sharedEnvShape,
   signUpPolicyOf,
   withDefault,
};
