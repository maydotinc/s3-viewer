import { isAcceptSuggestionKey } from "@/lib/hooks/usePathSuggestion";
import { Input } from "@s3-viewer/ui/components/input";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ComponentProps, KeyboardEvent, ReactNode } from "react";

type PathInputProps = Omit<
   ComponentProps<"input">,
   "value" | "children" | "autoComplete" | "spellCheck"
> & {
   value: string;
   suggestionBase?: string;
   suggestion: string;
   onAccept: (completed: string) => void;
   acceptOnEnter?: boolean;
   sharedPaddingClassName?: string;
   className?: string;
   inputClassName?: string;
   children?: ReactNode;
};

const PathInput = ({
   value,
   suggestionBase = value,
   suggestion,
   onAccept,
   acceptOnEnter = false,
   sharedPaddingClassName = "px-3",
   className,
   inputClassName,
   children,
   onKeyDown,
   ...props
}: PathInputProps) => {
   const accept = (event: KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event);
      if (!suggestion || event.defaultPrevented) return;
      if (
         !isAcceptSuggestionKey(event) &&
         !(acceptOnEnter && event.key === "Enter")
      )
         return;
      event.preventDefault();
      const slash = suggestion.indexOf("/");
      onAccept(
         suggestionBase +
            (slash >= 0 ? suggestion.slice(0, slash + 1) : suggestion)
      );
   };

   return (
      <div className={cn("relative", className)}>
         <Input
            value={value}
            autoComplete="off"
            spellCheck={false}
            className={cn(sharedPaddingClassName, inputClassName)}
            onKeyDown={accept}
            {...props}
         />
         {suggestion && (
            <div
               aria-hidden="true"
               className={cn(
                  "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-base sm:text-sm",
                  sharedPaddingClassName
               )}
            >
               <span className="invisible">{suggestionBase}</span>
               <span className="text-viewerlighttext">{suggestion}</span>
            </div>
         )}
         {children}
      </div>
   );
};

export default PathInput;
