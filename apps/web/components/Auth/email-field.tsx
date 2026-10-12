import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import { Input } from "@s3-viewer/ui/components/input";

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
   <Field label="Email" htmlFor="email">
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
      <FormError id="email-message" size="sm" reserve={false} hint={hint}>
         {error}
      </FormError>
   </Field>
);

export default EmailField;
