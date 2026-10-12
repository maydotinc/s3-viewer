import {
   serverCredentialsSchema,
   type ServerCredentials,
} from "@s3-viewer/types";
import Field from "@/components/form-field";
import { Input } from "@s3-viewer/ui/components/input";
import { defaultRegion, REGIONS } from "./regions";

type CredentialFields = {
   endpoint: string;
   region: string;
   accessKey: string;
   secretKey: string;
   sessionToken: string;
};

const EMPTY_CREDENTIALS: CredentialFields = {
   endpoint: "",
   region: "",
   accessKey: "",
   secretKey: "",
   sessionToken: "",
};

// the secrets only need to live until they are sealed; the access key id and endpoint stay so Back is still useful.
const withoutSecrets = <T extends CredentialFields>(f: T): T => ({
   ...f,
   secretKey: "",
   sessionToken: "",
});

const validateCredentialFields = (
   f: CredentialFields,
   allowInsecureEndpoints = false
): string | null => {
   if (!f.endpoint.trim()) return "Enter an endpoint URL";
   let url: URL;
   try {
      url = new URL(f.endpoint.trim());
   } catch {
      return "Endpoint must be a full URL, like https://s3.amazonaws.com";
   }
   if (
      url.protocol !== "https:" &&
      !(allowInsecureEndpoints && url.protocol === "http:")
   )
      return allowInsecureEndpoints
         ? "Endpoint must start with https:// or http://"
         : "Endpoint must start with https://";
   if (!f.accessKey.trim()) return "Enter an access key ID";
   if (!f.secretKey) return "Enter a secret access key";
   const parsed = serverCredentialsSchema.safeParse(toServerCredentials(f));
   return parsed.success
      ? null
      : (parsed.error.issues[0]?.message ?? "Check the credentials");
};

const toServerCredentials = (f: CredentialFields): ServerCredentials => ({
   endpoint: f.endpoint.trim(),
   region: f.region.trim() || defaultRegion(f.endpoint),
   accessKey: f.accessKey.trim(),
   secretKey: f.secretKey,
   ...(f.sessionToken.trim() && { sessionToken: f.sessionToken.trim() }),
});

type CredentialsFieldsProps = {
   fields: CredentialFields;
   onChange: (key: keyof CredentialFields, value: string) => void;
   idPrefix: string;
   autoFocus?: boolean;
   disabled?: boolean;
};

const CredentialsFields = ({
   fields,
   onChange,
   idPrefix,
   autoFocus,
   disabled,
}: CredentialsFieldsProps) => (
   <>
      <Field label="Endpoint" htmlFor={`${idPrefix}-endpoint`}>
         <Input
            disabled={disabled}
            id={`${idPrefix}-endpoint`}
            type="url"
            inputMode="url"
            placeholder="https://<account>.r2.cloudflarestorage.com"
            value={fields.endpoint}
            autoFocus={autoFocus}
            onChange={(e) => onChange("endpoint", e.target.value)}
         />
      </Field>
      <Field label="Region" htmlFor={`${idPrefix}-region`}>
         <Input
            disabled={disabled}
            id={`${idPrefix}-region`}
            list={`${idPrefix}-regions`}
            autoComplete="off"
            spellCheck={false}
            value={fields.region}
            placeholder={defaultRegion(fields.endpoint)}
            aria-describedby={`${idPrefix}-region-help`}
            onChange={(e) => onChange("region", e.target.value)}
         />
         <datalist id={`${idPrefix}-regions`}>
            {REGIONS.map((r) => (
               <option key={r} value={r} />
            ))}
         </datalist>
         <p
            id={`${idPrefix}-region-help`}
            className="text-xs text-viewerlighttext"
         >
            Enter your provider&apos;s region, or leave blank for{" "}
            {defaultRegion(fields.endpoint)}.
         </p>
      </Field>
      <Field label="Access key ID" htmlFor={`${idPrefix}-access-key`}>
         <Input
            disabled={disabled}
            id={`${idPrefix}-access-key`}
            autoComplete="off"
            spellCheck={false}
            value={fields.accessKey}
            onChange={(e) => onChange("accessKey", e.target.value)}
         />
      </Field>
      <Field label="Secret access key" htmlFor={`${idPrefix}-secret-key`}>
         <Input
            disabled={disabled}
            id={`${idPrefix}-secret-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={fields.secretKey}
            onChange={(e) => onChange("secretKey", e.target.value)}
         />
      </Field>
      <Field
         label="Session token (optional)"
         htmlFor={`${idPrefix}-session-token`}
      >
         <Input
            disabled={disabled}
            id={`${idPrefix}-session-token`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={fields.sessionToken}
            aria-describedby={`${idPrefix}-session-token-help`}
            onChange={(e) => onChange("sessionToken", e.target.value)}
         />
         <p
            id={`${idPrefix}-session-token-help`}
            className="text-xs text-viewerlighttext"
         >
            For temporary AWS or R2 credentials. Update all three values when
            they expire; they aren&apos;t renewed automatically.
         </p>
      </Field>
   </>
);

export {
   CredentialsFields,
   EMPTY_CREDENTIALS,
   toServerCredentials,
   validateCredentialFields,
   withoutSecrets,
};
export type { CredentialFields };
