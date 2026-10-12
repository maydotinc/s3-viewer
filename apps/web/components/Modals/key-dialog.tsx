import { FormDialog } from "./form-dialog";
import type { DialogHeight } from "./modal-shell";
import FormError from "./form-error";
import PathInput from "@/components/path-input";
import type { BucketTarget } from "@/lib/types";
import useBucketScope from "@/lib/hooks/queries/s3/useBucketScope";
import { usePathSuggestion } from "@/lib/hooks/usePathSuggestion";
import { writeScopeError } from "@/lib/utils/folder-access";
import { Label } from "@s3-viewer/ui/components/label";
import {
   useId,
   useState,
   type ComponentProps,
   type FormEvent,
   type ReactNode,
} from "react";

type PathFieldProps = Omit<
   ComponentProps<typeof PathInput>,
   "id" | "children" | "aria-invalid" | "aria-describedby"
> & {
   id: string;
   errorId: string;
   label: string;
   invalid: boolean;
   hint?: string;
   children?: string | null;
};

const PathField = ({
   id,
   errorId,
   label,
   invalid,
   hint,
   children,
   ...input
}: PathFieldProps) => (
   <>
      <div className="flex min-h-4 items-center justify-between gap-2">
         <Label htmlFor={id}>{label}</Label>
         <span className="text-xs text-viewerlighttext" aria-hidden="true">
            {input.suggestion ? "→ to autocomplete" : ""}
         </span>
      </div>
      <PathInput
         id={id}
         aria-invalid={invalid ? true : undefined}
         aria-describedby={errorId}
         {...input}
      />
      <FormError id={errorId} hint={hint}>
         {children}
      </FormError>
   </>
);

type KeyDialogProps = BucketTarget & {
   onClose: () => void;
   title: ReactNode;
   description: ReactNode;
   label: string;
   submitLabel: ReactNode;
   initialValue: string;
   validate: (value: string) => string | null;
   isPending?: boolean;
   submitDisabled?: boolean;
   inputDisabled?: boolean;
   requestError?: string | null;
   hint?: string;
   onEdit?: () => void;
   onSubmit: (value: string) => void;
   height?: DialogHeight;
   children?: ReactNode;
};

const KeyDialog = ({
   onClose,
   userId,
   serverId,
   bucketName,
   title,
   description,
   label,
   submitLabel,
   initialValue,
   validate,
   isPending = false,
   submitDisabled = false,
   inputDisabled = false,
   requestError = null,
   hint,
   onEdit,
   onSubmit,
   height,
   children,
}: KeyDialogProps) => {
   const inputId = useId();
   const errorId = useId();
   const [value, setValue] = useState(initialValue);
   const [touched, setTouched] = useState(false);

   const key = value.trim();
   const scope = useBucketScope(userId, serverId, bucketName);
   const validation = validate(key) ?? writeScopeError(scope, key);
   const suggestion = usePathSuggestion(bucketName, key, {
      scope: { userId, serverId },
   });
   const error = requestError ?? (touched ? validation : null);

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (isPending || submitDisabled || validation) return;
      onSubmit(key);
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={isPending}
         title={title}
         description={description}
         onSubmit={submit}
         submitLabel={submitLabel}
         submitDisabled={submitDisabled || validation !== null}
         height={height}
      >
         <PathField
            id={inputId}
            errorId={errorId}
            label={label}
            invalid={Boolean(error)}
            hint={hint}
            value={value}
            suggestionBase={key}
            suggestion={suggestion}
            autoFocus
            disabled={isPending || inputDisabled}
            onChange={(event) => {
               setValue(event.target.value);
               setTouched(true);
               onEdit?.();
            }}
            onBlur={() => setTouched(true)}
            onAccept={setValue}
         >
            {error}
         </PathField>
         {children}
      </FormDialog>
   );
};

export { KeyDialog, PathField };
