import Field from "@/components/form-field";
import FormError from "@/components/Modals/form-error";
import { Input } from "@s3-viewer/ui/components/input";

type EmailFieldProps = {
   value: string;
   error: string | null;
   hint?: string;
   disabled: boolean;
   autoFocus?: boolean;
   onChange: (value: string) => void;
   onEnter?: () => void;
};

const EmailField = ({
   value,
   error,
   hint,
   disabled,
   autoFocus = true,
   onChange,
   onEnter,
}: EmailFieldProps) => (
   <Field label="Email" htmlFor="email">
      <Input
         id="email"
         name="email"
         type="email"
         inputMode="email"
         autoComplete="email"
         autoFocus={autoFocus}
         required
         placeholder="you@example.com"
         value={value}
         disabled={disabled}
         aria-invalid={error ? true : undefined}
         aria-describedby="email-message"
         onChange={(event) => onChange(event.target.value)}
         onKeyDown={(event) => {
            if (!onEnter || event.key !== "Enter") return;
            event.preventDefault();
            onEnter();
         }}
      />
      <FormError id="email-message" size="sm" reserve={false} hint={hint}>
         {error}
      </FormError>
   </Field>
);

export default EmailField;
