import useAuthStore from "@/lib/stores/authStore";
import { Input } from "@s3-viewer/ui/components/input";
import { cn, isValidEmail } from "@s3-viewer/ui/lib/utils";
import emailSpellChecker from "@zootools/email-spell-checker";
import { debounce } from "lodash";
import { useCallback, useEffect, useMemo, useState } from "react";

const EmailInput = () => {
   const { email, setEmail, invalidFields, setInvalidFields, setError } =
      useAuthStore();

   const [emailSuggestion, setEmailSuggestion] = useState<{
      address: string;
      domain: string;
      full: string;
   } | null>(null);

   const validateEmail = useCallback(
      (value: string) => {
         const isValid = isValidEmail(value);
         if (isValid) {
            setInvalidFields(
               invalidFields.filter((field) => field !== "email")
            );

            const suggestion = emailSpellChecker.run({
               email: value,
            });

            setEmailSuggestion(suggestion || null);
         } else {
            if (!invalidFields.includes("email")) {
               setInvalidFields([...invalidFields, "email"]);
            }
            setEmailSuggestion(null);
         }
      },
      [setInvalidFields, invalidFields]
   );

   const debouncedValidateEmail = useMemo(
      () => debounce(validateEmail, 500),
      [validateEmail]
   );

   useEffect(() => {
      return () => {
         debouncedValidateEmail.cancel();
      };
   }, [debouncedValidateEmail]);

   const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      setError(null);
      setEmailSuggestion(null);
      debouncedValidateEmail(value);
   };

   const handleSuggestionClick = () => {
      if (emailSuggestion) {
         setEmail(emailSuggestion.full);
         setEmailSuggestion(null);
         validateEmail(emailSuggestion.full);
      }
   };

   return (
      <div className="flex flex-col">
         <label
            htmlFor="email"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Email Address<span className="text-lg text-viewerblue">*</span>
         </label>
         <div className="relative">
            <Input
               id="email"
               type="email"
               placeholder={"mileycyrus@may.inc"}
               autoComplete="email"
               className={cn(
                  "w-full transition-colors duration-300 text-black",
                  invalidFields.includes("email") && "border-red-500"
               )}
               value={email}
               onChange={handleEmailChange}
            />
            {emailSuggestion && (
               <div className="mt-2 p-3 bg-viewergray border flex items-center border-viewerborder rounded-md">
                  <div className="flex gap-1">
                     <span className="text-sm">Did you mean: </span>
                     <span
                        className="text-sm max-w-[270px] truncate text-viewerblue hover:underline cursor-pointer"
                        dir="rtl"
                        onClick={handleSuggestionClick}
                     >
                        {emailSuggestion.full}
                     </span>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};

export default EmailInput;
