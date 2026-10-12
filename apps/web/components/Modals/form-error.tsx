import { cn } from "@s3-viewer/ui/lib/utils";

const FormError = ({
   id,
   hint,
   size = "xs",
   reserve = true,
   children,
}: {
   id?: string;
   hint?: string;
   size?: "xs" | "sm";
   // reserved space keeps dialogs from jumping; auth forms prefer tight spacing
   reserve?: boolean;
   children?: string | null;
}) => {
   if (!reserve && !children && !hint) return null;
   return (
      <p
         id={id}
         role={children ? "alert" : undefined}
         className={cn(
            "shrink-0 break-words leading-5",
            reserve && "h-10 overflow-y-auto [scrollbar-gutter:stable]",
            size === "sm" ? "text-sm" : "text-xs",
            children ? "text-viewertextred" : "text-viewertext"
         )}
      >
         {children ?? hint}
      </p>
   );
};

export default FormError;
