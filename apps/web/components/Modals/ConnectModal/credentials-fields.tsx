import type { ServerCredentials } from "@s3-viewer/types";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
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

const validateCredentialFields = (f: CredentialFields): string | null => {
   if (!f.endpoint.trim()) return "Enter an endpoint URL";
   let url: URL;
   try {
      url = new URL(f.endpoint.trim());
   } catch {
      return "Endpoint must be a full URL, like https://s3.amazonaws.com";
   }
   if (url.protocol !== "https:") return "Endpoint must start with https://";
   if (!f.accessKey.trim()) return "Enter an access key ID";
   if (!f.secretKey) return "Enter a secret access key";
   return null;
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
};

const CredentialsFields = ({
   fields,
   onChange,
   idPrefix,
   autoFocus,
}: CredentialsFieldsProps) => (
   <>
      <div className="flex flex-col gap-1.5">
         <Label htmlFor={`${idPrefix}-endpoint`}>Endpoint</Label>
         <Input
            id={`${idPrefix}-endpoint`}
            type="url"
            inputMode="url"
            placeholder="https://<account>.r2.cloudflarestorage.com"
            value={fields.endpoint}
            autoFocus={autoFocus}
            onChange={(e) => onChange("endpoint", e.target.value)}
         />
      </div>
      <div className="flex flex-col gap-1.5">
         <Label htmlFor={`${idPrefix}-region`}>Region</Label>
         <Input
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
      </div>
      <div className="flex flex-col gap-1.5">
         <Label htmlFor={`${idPrefix}-access-key`}>Access key ID</Label>
         <Input
            id={`${idPrefix}-access-key`}
            autoComplete="off"
            spellCheck={false}
            value={fields.accessKey}
            onChange={(e) => onChange("accessKey", e.target.value)}
         />
      </div>
      <div className="flex flex-col gap-1.5">
         <Label htmlFor={`${idPrefix}-secret-key`}>Secret access key</Label>
         <Input
            id={`${idPrefix}-secret-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={fields.secretKey}
            onChange={(e) => onChange("secretKey", e.target.value)}
         />
      </div>
      <div className="flex flex-col gap-1.5">
         <Label htmlFor={`${idPrefix}-session-token`}>
            Session token (optional)
         </Label>
         <Input
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
      </div>
   </>
);

export {
   CredentialsFields,
   EMPTY_CREDENTIALS,
   toServerCredentials,
   validateCredentialFields,
};
export type { CredentialFields };
