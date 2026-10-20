import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { useId, useState, type ChangeEvent } from "react";
import FormError from "./form-error";
import useRequestError from "./use-request-error";

const useNameField = (
   validate: (name: string) => string | null,
   { hideEmptyError = false, initial = "" } = {}
) => {
   const [name, setName] = useState(initial);
   const [touched, setTouched] = useState(false);
   const request = useRequestError();
   const trimmed = name.trim();
   const validation = validate(trimmed);
   return {
      trimmed,
      valid: validation === null,
      error:
         request.error ??
         (touched && (!hideEmptyError || trimmed) ? validation : null),
      attempt: request.attempt,
      inputProps: {
         value: name,
         onChange: (event: ChangeEvent<HTMLInputElement>) => {
            setName(event.target.value);
            setTouched(true);
            request.clear();
         },
         onBlur: () => setTouched(true),
      },
   };
};

const NameField = ({
   field,
   label,
   placeholder,
   maxLength,
}: {
   field: ReturnType<typeof useNameField>;
   label: string;
   placeholder?: string;
   maxLength?: number;
}) => {
   const inputId = useId();
   const errorId = useId();
   return (
      <>
         <Label htmlFor={inputId}>{label}</Label>
         <Input
            id={inputId}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-invalid={field.error ? true : undefined}
            aria-describedby={errorId}
            {...field.inputProps}
         />
         <FormError id={errorId}>{field.error}</FormError>
      </>
   );
};

export { NameField, useNameField };
