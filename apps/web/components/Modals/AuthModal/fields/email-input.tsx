import { Input } from "@s3-viewer/ui/components/input";
import { cn, isValidEmail } from "@s3-viewer/ui/lib/utils";
import { debounce } from "lodash";
import { useCallback, useEffect, useMemo } from "react";
import useAuthStore from "../../../lib/authStore";

interface EmailInputProps {
   label?: string;
   placeholder?: string;
}

const EmailInput = ({ label = "Email", placeholder = "john.doe@example.com" }: EmailInputProps) => {
   const { email, setEmail, invalidFields, setInvalidFields } = useAuthStore();

   const validateEmail = useCallback(
      (value: string) => {
         const isValid = isValidEmail(value);
         if (isValid) {
            setInvalidFields(invalidFields.filter((field) => field !== "email"));
         } else if (!invalidFields.includes("email")) {
            setInvalidFields([...invalidFields, "email"]);
         }
      },
      [setInvalidFields, invalidFields]
   );

   const debouncedValidateEmail = useMemo(() => debounce(validateEmail, 500), [validateEmail]);

   useEffect(() => {
      return () => {
         debouncedValidateEmail.cancel();
      };
   }, [debouncedValidateEmail]);

   const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      debouncedValidateEmail(value);
   };

   return (
      <div className="flex flex-col gap-0">
         <label htmlFor="email" className="text-sm font-medium text-black">
            {label}
         </label>
         <Input
            id="email"
            type="email"
            placeholder={placeholder}
            autoComplete="email"
            className={cn(
               "w-full transition-colors duration-300",
               invalidFields.includes("email") && "border-red-500"
            )}
            value={email}
            onChange={handleEmailChange}
         />
      </div>
   );
};

export default EmailInput;
