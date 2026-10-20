import { cn } from "@s3-viewer/ui/lib/utils";

const FormError = ({
   id,
   hint,
   size = "xs",
   children,
}: {
   id?: string;
   hint?: string;
   size?: "xs" | "sm";
   children?: string | null;
}) => {
   // inputs point aria-describedby at the id up front, so it has to resolve even while there is nothing to say
   if (!children && !hint) return id ? <p id={id} hidden /> : null;
   return (
      <p
         id={id}
         role={children ? "alert" : undefined}
         className={cn(
            "shrink-0 break-words",
            size === "sm" ? "text-sm/5" : "text-xs/5",
            children ? "text-viewertextred" : "text-viewertext"
         )}
      >
         {children ?? hint}
      </p>
   );
};

export default FormError;
