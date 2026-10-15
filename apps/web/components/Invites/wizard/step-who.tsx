import Field from "@/components/form-field";
import RemovableChip from "@/components/removable-chip";
import { MAX_INVITE_EMAILS } from "@s3-viewer/types";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import {
   INVALID_CHIP_TITLE,
   addEmails,
   commitInput,
   helperMessage,
   isValidEmail,
   popChip,
   removeChip,
   requireEmails,
   setInput,
   type EmailField,
} from "./email-chips";

type StepWhoProps = {
   value: EmailField;
   canContinue: boolean;
   onChange: (next: EmailField) => void;
   onContinue: () => void;
};

const StepWho = ({
   value,
   canContinue,
   onChange,
   onContinue,
}: StepWhoProps) => {
   const labelId = useId();
   const inputId = useId();
   const helperId = useId();
   const inputRef = useRef<HTMLInputElement>(null);
   const message = helperMessage(value);
   const invalid = message.tone === "error";

   const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
         event.preventDefault();
         if (value.input.trim()) onChange(commitInput(value));
         else if (value.chips.length === 0) onChange(requireEmails(value));
         else if (canContinue) onContinue();
         return;
      }
      if (event.key === "Backspace" && value.input === "") {
         event.preventDefault();
         onChange(popChip(value));
      }
   };

   const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      const pasted = event.clipboardData.getData("text");
      onChange(addEmails(value, `${value.input} ${pasted}`));
   };

   return (
      <Field
         label={<span id={labelId}>Email addresses</span>}
         htmlFor={inputId}
         trailing={
            <span className="w-14 text-right text-xs tabular-nums text-viewertext">
               {value.chips.length} of {MAX_INVITE_EMAILS}
            </span>
         }
      >
         <div
            role="group"
            aria-labelledby={labelId}
            aria-invalid={invalid || undefined}
            onClick={() => inputRef.current?.focus()}
            className="flex min-h-20 min-w-0 cursor-text flex-wrap items-start gap-1.5 rounded-lg border border-viewerborder bg-viewerwhite p-2 transition-colors focus-within:border-viewerblue aria-invalid:border-viewertextred"
         >
            <ul className="contents">
               {value.chips.map((chip) => {
                  const valid = isValidEmail(chip);
                  return (
                     <RemovableChip
                        key={chip}
                        label={chip}
                        invalid={!valid}
                        title={valid ? undefined : INVALID_CHIP_TITLE}
                        className="py-1"
                        onRemove={() => onChange(removeChip(value, chip))}
                     />
                  );
               })}
            </ul>
            <input
               ref={inputRef}
               id={inputId}
               type="text"
               inputMode="email"
               autoComplete="off"
               spellCheck={false}
               value={value.input}
               placeholder={
                  value.chips.length === 0 ? "name@example.com" : undefined
               }
               aria-describedby={helperId}
               aria-invalid={invalid || undefined}
               onChange={(event) =>
                  onChange(setInput(value, event.target.value))
               }
               onKeyDown={onKeyDown}
               onPaste={onPaste}
               className="h-7 min-w-40 flex-1 bg-transparent text-base outline-none placeholder:text-viewerlighttext sm:text-sm"
            />
         </div>
         <p
            id={helperId}
            role={invalid ? "alert" : undefined}
            className={cn(
               "min-h-5 break-words text-xs leading-5",
               invalid ? "text-viewertextred" : "text-viewertext"
            )}
         >
            {message.text}
         </p>
      </Field>
   );
};

export default StepWho;
