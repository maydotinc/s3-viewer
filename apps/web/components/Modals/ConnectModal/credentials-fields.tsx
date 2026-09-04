import type { ServerCredentials } from "@s3-viewer/types";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { REGIONS, type Region } from "./regions";

type CredentialFields = {
   endpoint: string;
   region: Region;
   accessKey: string;
   secretKey: string;
};

const EMPTY_CREDENTIALS: CredentialFields = {
   endpoint: "",
   region: "us-east-1",
   accessKey: "",
   secretKey: "",
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
   region: f.region,
   accessKey: f.accessKey.trim(),
   secretKey: f.secretKey,
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
         <Select
            value={fields.region}
            onValueChange={(v) => onChange("region", v)}
         >
            <SelectTrigger id={`${idPrefix}-region`} className="w-full">
               <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60 overflow-y-auto">
               {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                     {r === "auto" ? "auto (Cloudflare R2)" : r}
                  </SelectItem>
               ))}
            </SelectContent>
         </Select>
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
   </>
);

export {
   CredentialsFields,
   EMPTY_CREDENTIALS,
   toServerCredentials,
   validateCredentialFields,
};
export type { CredentialFields };
