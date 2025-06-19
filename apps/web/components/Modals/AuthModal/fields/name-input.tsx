import useAuthStore from "@/lib/authStore";
import { Input } from "@s3-viewer/ui/components/input";
import { cn } from "@s3-viewer/ui/lib/utils";
import { debounce } from "lodash";
import { useCallback, useEffect, useMemo } from "react";

const NameInput = () => {
   const { name, setName, invalidFields, setInvalidFields } = useAuthStore();

   const validateName = useCallback(
      (value: string) => {
         const isValid = value.trim().length > 0;
         if (isValid) {
            setInvalidFields(invalidFields.filter((field) => field !== "name"));
         } else if (!invalidFields.includes("name")) {
            setInvalidFields([...invalidFields, "name"]);
         }
      },
      [setInvalidFields, invalidFields, name, setName]
   );

   const debouncedValidateName = useMemo(() => debounce(validateName, 100), [validateName]);

   useEffect(() => {
      return () => {
         debouncedValidateName.cancel();
      };
   }, [debouncedValidateName]);

   const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setName(value);
      debouncedValidateName(value);
   };

   return (
      <div className="flex flex-col">
         <label htmlFor="name" className="text-sm font-medium text-black flex items-center gap-1">
            Name<span className="text-lg text-viewerblue">*</span>
         </label>
         <Input
            type="text"
            placeholder="James Brown"
            className={cn(
               "w-full transition-colors duration-300",
               invalidFields.includes("name") && "border-red-500"
            )}
            value={name}
            onChange={handleNameChange}
         />
      </div>
   );
};

export default NameInput;
