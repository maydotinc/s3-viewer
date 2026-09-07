import FieldMessage from "@/components/Auth/field-message";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";

type EmailFieldProps = {
   value: string;
   error: string | null;
   hint?: string;
   disabled: boolean;
   onChange: (value: string) => void;
};

const EmailField = ({
   value,
   error,
   hint,
   disabled,
   onChange,
}: EmailFieldProps) => (
   <div className="flex flex-col gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input
         id="email"
         name="email"
         type="email"
         inputMode="email"
         autoComplete="email"
         autoFocus
         required
         placeholder="you@example.com"
         value={value}
         disabled={disabled}
         aria-invalid={error ? true : undefined}
         aria-describedby="email-message"
         onChange={(event) => onChange(event.target.value)}
      />
      <FieldMessage id="email-message" error={error} hint={hint} reserve />
   </div>
);

export default EmailField;
