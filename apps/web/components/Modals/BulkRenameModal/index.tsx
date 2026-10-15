import CenteredSpinner from "@/components/centered-spinner";
import Field from "@/components/form-field";
import type { ModalProps } from "@/lib/contexts/modal-props";
import { INPUT_DEBOUNCE_MS } from "@/lib/constants";
import FailureList from "@/components/Modals/failure-list";
import DeletionProtectionNotice from "@/components/Modals/deletion-protection-notice";
import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import {
   DEFAULT_RENAME_OPTIONS,
   EMPTY_RENAME_FIELDS,
   MAX_RENAME_PREVIEW_ROWS,
   toOperation,
   type BulkRenameFields,
   type BulkRenameKind,
   type BulkRenameOptions,
} from "@/lib/utils/s3/bulk-rename";
import { formatCount, visibleText } from "@/lib/utils/format";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { Input } from "@s3-viewer/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { useId, useMemo, useState } from "react";
import {
   changeSummary,
   progressNotice,
   renameNotice,
   submitLabel,
} from "./notices";
import useBulkRename from "./useBulkRename";

type BulkRenameModalProps = ModalProps<"bulkRename">;

const OPERATION_LABEL: Record<BulkRenameKind, string> = {
   replace: "Find and replace",
   prefix: "Add a prefix",
   suffix: "Add a suffix",
   extension: "Change the extension",
   lowercase: "Lowercase the name",
};

const INPUT_PROPS = { autoComplete: "off", spellCheck: false } as const;

const BulkRenameModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   source,
   onRenamed,
}: BulkRenameModalProps) => {
   const fieldId = useId();
   const [options, setOptions] = useState(DEFAULT_RENAME_OPTIONS);
   const [fields, setFields] = useState(EMPTY_RENAME_FIELDS);
   const steady = useDebouncedValue(fields, INPUT_DEBOUNCE_MS);
   const operation = useMemo(
      () => toOperation(steady, options),
      [steady, options]
   );
   const run = useBulkRename({
      userId,
      serverId,
      bucketName,
      source,
      operation,
      previewMatchesInput: steady === fields,
      onRenamed,
      onClose,
   });
   const { kind } = options;
   const disabled = run.step !== null;

   const edit = (patch: Partial<BulkRenameFields>) => {
      setFields((previous) => ({ ...previous, ...patch }));
      run.forget();
   };
   const choose = (patch: Partial<BulkRenameOptions>) => {
      setOptions((previous) => ({ ...previous, ...patch }));
      run.forget();
   };

   const total = run.sources?.length ?? 0;
   const preview = run.plan.rows.slice(0, MAX_RENAME_PREVIEW_ROWS);
   const progress = progressNotice(run.step, run.listed, run.pending.length);
   const notice = renameNotice({
      error: run.error,
      truncated: run.truncated,
      plan: run.plan,
      existing: run.existing,
      attempted: run.attempted,
      renamed: run.renamed,
      failed: run.failed.length,
      needsReview: run.needsReview.length,
   });

   return (
      <FormDialog
         onClose={onClose}
         isPending={disabled}
         onAbort={run.cancel}
         contentClassName="max-w-2xl"
         title="Bulk rename"
         description={
            run.sources === null
               ? "Reading the objects this rename would cover…"
               : `${formatCount(total)} objects in scope. Only the file name changes — every object stays in its folder.`
         }
         onSubmit={(event) => {
            event.preventDefault();
            run.submit();
         }}
         submitLabel={submitLabel(run.attempted, run.plan.rows.length)}
         submitDisabled={run.blocked}
      >
         <div className="flex flex-col gap-3">
            <Field label="Operation" htmlFor={`${fieldId}-kind`}>
               <Select
                  value={kind}
                  disabled={disabled}
                  onValueChange={(next) =>
                     choose({ kind: next as BulkRenameKind })
                  }
               >
                  <SelectTrigger id={`${fieldId}-kind`}>
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     {(Object.keys(OPERATION_LABEL) as BulkRenameKind[]).map(
                        (value) => (
                           <SelectItem key={value} value={value}>
                              {OPERATION_LABEL[value]}
                           </SelectItem>
                        )
                     )}
                  </SelectContent>
               </Select>
            </Field>
            {kind === "replace" && (
               <div className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                     <Field label="Find" htmlFor={`${fieldId}-find`}>
                        <Input
                           id={`${fieldId}-find`}
                           value={fields.find}
                           autoFocus
                           disabled={disabled}
                           onChange={(event) =>
                              edit({ find: event.target.value })
                           }
                           {...INPUT_PROPS}
                        />
                     </Field>
                     <Field label="Replace with" htmlFor={`${fieldId}-replace`}>
                        <Input
                           id={`${fieldId}-replace`}
                           value={fields.replacement}
                           disabled={disabled}
                           onChange={(event) =>
                              edit({ replacement: event.target.value })
                           }
                           {...INPUT_PROPS}
                        />
                     </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                     <label className="flex items-center gap-2 text-sm text-viewertext">
                        <Checkbox
                           checked={options.matchCase}
                           disabled={disabled}
                           onCheckedChange={(next) =>
                              choose({ matchCase: next === true })
                           }
                        />
                        Match case
                     </label>
                     <label className="flex items-center gap-2 text-sm text-viewertext">
                        <Checkbox
                           checked={options.allOccurrences}
                           disabled={disabled}
                           onCheckedChange={(next) =>
                              choose({ allOccurrences: next === true })
                           }
                        />
                        Every occurrence
                     </label>
                  </div>
               </div>
            )}
            {(kind === "prefix" || kind === "suffix") && (
               <Field
                  label={
                     kind === "prefix"
                        ? "Prefix"
                        : "Suffix (added before the extension)"
                  }
                  htmlFor={`${fieldId}-text`}
               >
                  <Input
                     id={`${fieldId}-text`}
                     value={fields.text}
                     autoFocus
                     disabled={disabled}
                     onChange={(event) => edit({ text: event.target.value })}
                     {...INPUT_PROPS}
                  />
               </Field>
            )}
            {kind === "extension" && (
               <Field
                  label="New extension (empty removes it)"
                  htmlFor={`${fieldId}-extension`}
               >
                  <Input
                     id={`${fieldId}-extension`}
                     value={fields.extension}
                     autoFocus
                     disabled={disabled}
                     onChange={(event) =>
                        edit({ extension: event.target.value })
                     }
                     {...INPUT_PROPS}
                  />
               </Field>
            )}
         </div>
         <FormError>{notice}</FormError>
         <div className="flex h-72 shrink-0 flex-col gap-1.5">
            {run.step === "listing" || run.sources === null ? (
               <CenteredSpinner
                  size="sm"
                  label="Listing objects"
                  className="flex-1 gap-2 text-sm text-viewertext"
               >
                  {progress}
               </CenteredSpinner>
            ) : (
               <>
                  <div className="flex shrink-0 items-center justify-between gap-2 text-xs text-viewertext">
                     <span>{changeSummary(run.plan, total)}</span>
                     {progress && <span>{progress}</span>}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-viewerborder">
                     {preview.length > 0 ? (
                        <Table>
                           <TableHeader>
                              <TableRow>
                                 <TableHead>Now</TableHead>
                                 <TableHead>After</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {preview.map((row) => (
                                 <TableRow key={row.key}>
                                    <TableCell className="break-all whitespace-normal text-viewertext">
                                       {visibleText(row.key)}
                                    </TableCell>
                                    <TableCell className="break-all whitespace-normal font-medium text-viewerblack">
                                       {visibleText(row.newKey)}
                                    </TableCell>
                                 </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     ) : (
                        kind !== "lowercase" && (
                           <p className="flex h-full items-center justify-center p-4 text-center text-sm text-viewerlighttext">
                              Type to preview renames
                           </p>
                        )
                     )}
                  </div>
                  {run.plan.rows.length > preview.length && (
                     <p className="shrink-0 text-xs text-viewertext">
                        Showing the first {formatCount(preview.length)} of{" "}
                        {formatCount(run.plan.rows.length)} renames.
                     </p>
                  )}
               </>
            )}
         </div>
         <DeletionProtectionNotice serverId={serverId} action="rename" />
         <FailureList failures={run.failed} />
      </FormDialog>
   );
};

export default BulkRenameModal;
