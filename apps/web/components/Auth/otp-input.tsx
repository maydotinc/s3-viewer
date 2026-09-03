import { AUTH_CODE_LENGTH } from "@s3-viewer/types";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   useEffect,
   useRef,
   type ChangeEvent,
   type ClipboardEvent,
   type KeyboardEvent,
} from "react";

type OtpInputProps = {
   value: string;
   onChange: (value: string) => void;
   onComplete: (code: string) => void;
   disabled?: boolean;
   invalid?: boolean;
};

const digitsOnly = (raw: string) => raw.replace(/\D/g, "");

const OtpInput = ({
   value,
   onChange,
   onComplete,
   disabled,
   invalid,
}: OtpInputProps) => {
   const inputs = useRef<(HTMLInputElement | null)[]>([]);

   const focus = (index: number) => {
      inputs.current[
         Math.max(0, Math.min(index, AUTH_CODE_LENGTH - 1))
      ]?.focus();
   };

   const isEmpty = value === "";
   useEffect(() => {
      if (isEmpty) inputs.current[0]?.focus();
   }, [isEmpty]);

   const update = (next: string) => {
      const trimmed = next.slice(0, AUTH_CODE_LENGTH);
      onChange(trimmed);
      focus(trimmed.length);
      if (trimmed.length === AUTH_CODE_LENGTH) onComplete(trimmed);
   };

   const handleChange =
      (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
         const typed = digitsOnly(event.target.value);
         if (typed === "") {
            update(value.slice(0, index));
            return;
         }
         update(value.slice(0, index) + typed);
      };

   const handleKeyDown =
      (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
         if (event.key === "Backspace" && !value[index] && index > 0) {
            event.preventDefault();
            onChange(value.slice(0, index - 1));
            focus(index - 1);
         } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            focus(index - 1);
         } else if (event.key === "ArrowRight") {
            event.preventDefault();
            focus(index + 1);
         }
      };

   const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const pasted = digitsOnly(event.clipboardData.getData("text"));
      if (pasted) update(pasted);
   };

   return (
      <div
         role="group"
         aria-label="Verification code"
         className="flex justify-between gap-2"
         onPaste={handlePaste}
      >
         {Array.from({ length: AUTH_CODE_LENGTH }, (_, index) => (
            <input
               key={index}
               ref={(element) => {
                  inputs.current[index] = element;
               }}
               type="text"
               inputMode="numeric"
               pattern="[0-9]*"
               autoComplete={index === 0 ? "one-time-code" : "off"}
               aria-label={`Digit ${index + 1} of ${AUTH_CODE_LENGTH}`}
               aria-invalid={invalid || undefined}
               disabled={disabled}
               value={value[index] ?? ""}
               onChange={handleChange(index)}
               onKeyDown={handleKeyDown(index)}
               onFocus={(event) => event.target.select()}
               className={cn(
                  "h-12 w-full min-w-0 rounded-lg border border-viewerborder bg-viewerwhite text-center font-mono text-xl font-semibold text-viewerblack outline-none transition-[color,box-shadow,border-color]",
                  "focus-visible:border-viewerblue focus-visible:ring-[3px] focus-visible:ring-viewerblue/30",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  invalid &&
                     "border-viewertextred ring-[3px] ring-viewertextred/20"
               )}
            />
         ))}
      </div>
   );
};

export default OtpInput;
