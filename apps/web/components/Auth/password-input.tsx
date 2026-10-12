import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

const PasswordInput = ({
   className,
   disabled,
   ...props
}: Omit<ComponentProps<typeof Input>, "type">) => {
   const [shown, setShown] = useState(false);
   const label = shown ? "Hide password" : "Show password";
   return (
      <div className="relative">
         <Input
            type={shown ? "text" : "password"}
            disabled={disabled}
            className={cn("pr-10", className)}
            {...props}
         />
         <span className="absolute right-1 top-0.5 inline-flex">
            <SimpleTooltip label={label}>
               <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={label}
                  aria-pressed={shown}
                  disabled={disabled}
                  onClick={() => setShown((value) => !value)}
                  className="text-viewerlighttext"
               >
                  {shown ? <EyeOff /> : <Eye />}
               </Button>
            </SimpleTooltip>
         </span>
      </div>
   );
};

export default PasswordInput;
