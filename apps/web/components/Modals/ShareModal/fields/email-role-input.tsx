import { Role } from "@s3-viewer/types";
import { Input } from "@s3-viewer/ui/components/input";
import { cn, isValidEmail } from "@s3-viewer/ui/lib/utils";
import { debounce } from "lodash";
import { useCallback, useEffect, useMemo } from "react";
import { useShareContext } from "../context/ShareContext";
import RoleSelector from "./role-input";

const ROLES: { value: Role; label: string; description: string }[] = [
   {
      value: Role.VIEWER,
      label: "Read",
      description: "Can view files and folders",
   },
   {
      value: Role.EDITOR,
      label: "Write",
      description: "Can view, create, edit, and delete files",
   },
   {
      value: Role.ADMIN,
      label: "Admin",
      description: "Can manage users and settings",
   },
];

const EmailRoleInput = () => {
   const {
      emails,
      setEmails,
      selectedRole,
      setSelectedRole,
      invalidEmails,
      setInvalidEmails,
   } = useShareContext();

   const validateEmails = useCallback(
      (emailString: string) => {
         if (!emailString.trim()) {
            setInvalidEmails([]);
            return;
         }

         const emailList = emailString
            .split(",")
            .map((email) => email.trim())
            .filter((email) => email.length > 0);

         const invalidEmailList = emailList.filter(
            (email) => !isValidEmail(email)
         );
         setInvalidEmails(invalidEmailList);
      },
      [setInvalidEmails]
   );

   const debouncedValidateEmails = useMemo(
      () => debounce(validateEmails, 500),
      [validateEmails]
   );

   useEffect(() => {
      return () => {
         debouncedValidateEmails.cancel();
      };
   }, [debouncedValidateEmails]);

   const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmails(value);
      debouncedValidateEmails(value);
   };

   return (
      <div className="flex flex-col gap-2">
         <label
            htmlFor="email"
            className="text-sm font-medium text-black flex items-center gap-1"
         >
            Email Address
         </label>
         <div className="relative">
            <Input
               id="email"
               type="email"
               placeholder="Emails, comma separated"
               autoComplete="email"
               className={cn(
                  "w-full transition-colors duration-300 text-black pr-24",
                  invalidEmails.length > 0 && "border-red-500"
               )}
               value={emails}
               onChange={handleEmailChange}
            />
            <div className="absolute right-0 top-0 h-full border-l border-viewerborder">
               <RoleSelector
                  value={selectedRole}
                  onValueChange={setSelectedRole}
                  className="h-full border-none shadow-none bg-transparent hover:bg-gray-50 px-3 w-fit"
                  roles={ROLES}
                  mode="invite"
               />
            </div>
         </div>
         {invalidEmails.length > 0 && (
            <span className="text-sm text-red-500 mt-1">Invalid emails</span>
         )}
      </div>
   );
};

export default EmailRoleInput;
