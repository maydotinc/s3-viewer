import useAuthStore from "@/lib/authStore";
import { Input } from "@s3-viewer/ui/components/input";
import { cn, isValidEmail } from "@s3-viewer/ui/lib/utils";
import { debounce } from "lodash";
import { useCallback, useEffect, useMemo } from "react";

const EmailInput = () => {
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
      <div className="flex flex-col">
         <label htmlFor="email" className="text-sm font-medium text-black flex items-center gap-1">
            Email Address<span className="text-lg text-viewerblue">*</span>
         </label>
         <Input
            id="email"
            type="email"
            placeholder={"hello@gmail.com"}
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
