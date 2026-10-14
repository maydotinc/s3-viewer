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
   if (!children && !hint) return null;
   return (
      <p
         id={id}
         role={children ? "alert" : undefined}
         className={cn(
            "shrink-0 break-words leading-5",
            size === "sm" ? "text-sm" : "text-xs",
            children ? "text-viewertextred" : "text-viewertext"
         )}
      >
         {children ?? hint}
      </p>
   );
};

export default FormError;
