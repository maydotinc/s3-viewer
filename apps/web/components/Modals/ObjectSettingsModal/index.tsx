import CenteredSpinner from "@/components/centered-spinner";
import Field from "@/components/form-field";
import type { ModalProps } from "@/lib/contexts/modal-props";
import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import { ApiError, errorMessage } from "@/lib/api";
import useUpdateObjectSettings from "@/lib/hooks/mutations/object/useUpdateObjectSettings";
import useObjectSettings from "@/lib/hooks/queries/s3/useObjectSettings";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { toast } from "@s3-viewer/ui/components/toast";
import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
   COMMON_CONTENT_TYPES,
   expiresToSave,
   metadataFromRows,
   rowsFromMetadata,
   toDateTimeLocal,
   validateExpires,
   validateHeader,
   validateMetadata,
   type MetadataRow,
} from "./fields";

type ObjectSettingsModalProps = ModalProps<"objectSettings">;

type HeaderField = {
   name:
      | "cacheControl"
      | "contentDisposition"
      | "contentLanguage"
      | "contentEncoding";
   label: string;
   placeholder: string;
};

const HEADER_FIELDS: HeaderField[] = [
   {
      name: "cacheControl",
      label: "Cache-Control",
      placeholder: "public, max-age=31536000, immutable",
   },
   {
      name: "contentDisposition",
      label: "Content-Disposition",
      placeholder: 'attachment; filename="report.pdf"',
   },
   { name: "contentLanguage", label: "Content-Language", placeholder: "en-GB" },
   { name: "contentEncoding", label: "Content-Encoding", placeholder: "gzip" },
];

type HeaderValues = Record<HeaderField["name"], string>;

const NO_HEADERS: HeaderValues = {
   cacheControl: "",
   contentDisposition: "",
   contentLanguage: "",
   contentEncoding: "",
};

const ObjectSettingsModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   objectKey,
   expectedETag,
   onSaved,
}: ObjectSettingsModalProps) => {
   const settings = useObjectSettings(bucketName, objectKey);
   const update = useUpdateObjectSettings();
   const typeId = useId();
   const listId = useId();
   const errorId = useId();
   const [contentType, setContentType] = useState("");
   const [headers, setHeaders] = useState<HeaderValues>(NO_HEADERS);
   const [expires, setExpires] = useState("");
   const [rows, setRows] = useState<MetadataRow[]>([]);
   const [requestError, setRequestError] = useState<string | null>(null);
   const nextRowId = useRef(0);
   const seeded = useRef(false);

   const loaded = settings.data;
   useEffect(() => {
      if (!loaded || seeded.current) return;
      seeded.current = true;
      setContentType(loaded.contentType ?? "");
      setHeaders({
         cacheControl: loaded.cacheControl ?? "",
         contentDisposition: loaded.contentDisposition ?? "",
         contentLanguage: loaded.contentLanguage ?? "",
         contentEncoding: loaded.contentEncoding ?? "",
      });
      setExpires(toDateTimeLocal(loaded.expires));
      const seededRows = rowsFromMetadata(loaded.metadata);
      nextRowId.current = seededRows.length;
      setRows(seededRows);
   }, [loaded]);

   const headerError =
      HEADER_FIELDS.map((field) =>
         validateHeader(field.label, headers[field.name])
      ).find(Boolean) ?? null;
   const validation =
      contentType.trim() === ""
         ? "Enter a content type."
         : (headerError ?? validateExpires(expires) ?? validateMetadata(rows));
   const error = requestError ?? validation;

   const setHeader = (name: HeaderField["name"], value: string) => {
      setRequestError(null);
      setHeaders((previous) => ({ ...previous, [name]: value }));
   };

   const setRow = (id: number, patch: Partial<MetadataRow>) => {
      setRequestError(null);
      setRows((previous) =>
         previous.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );
   };

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (update.isPending || !loaded || validation) return;
      setRequestError(null);
      update.mutate(
         {
            userId,
            serverId,
            bucketName,
            objectKey,
            expectedETag,
            contentType: contentType.trim(),
            ...headers,
            expires: expiresToSave(expires, loaded.expires),
            metadata: metadataFromRows(rows),
         },
         {
            onSuccess: () => {
               toast.success("Settings saved.");
               onSaved?.();
               onClose();
            },
            onError: (failure) =>
               setRequestError(
                  failure instanceof ApiError && failure.status === 409
                     ? "The object changed. Reload the page and edit its settings again."
                     : errorMessage(failure)
               ),
         }
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={update.isPending}
         title="Edit settings"
         description={`The response headers and custom metadata stored with ${objectKey}. S3 rewrites the object in place, so its version changes.`}
         onSubmit={submit}
         submitLabel="Save settings"
         submitDisabled={!loaded || validation !== null}
         height="lg"
         bodyClassName="flex flex-col gap-4"
      >
         {settings.isPending ? (
            <CenteredSpinner label="Loading settings" />
         ) : settings.error || !loaded ? (
            <FormError>
               {settings.error
                  ? errorMessage(settings.error)
                  : "Couldn't load the current settings."}
            </FormError>
         ) : (
            <>
               <Field label="Content type" htmlFor={typeId}>
                  <Input
                     id={typeId}
                     value={contentType}
                     list={listId}
                     autoFocus
                     autoComplete="off"
                     spellCheck={false}
                     placeholder="application/octet-stream"
                     disabled={update.isPending}
                     aria-describedby={errorId}
                     onChange={(event) => {
                        setRequestError(null);
                        setContentType(event.target.value);
                     }}
                  />
                  <datalist id={listId}>
                     {COMMON_CONTENT_TYPES.map((type) => (
                        <option key={type} value={type} />
                     ))}
                  </datalist>
               </Field>
               {HEADER_FIELDS.map((field) => (
                  <Field
                     key={field.name}
                     label={field.label}
                     htmlFor={`${typeId}-${field.name}`}
                  >
                     <Input
                        id={`${typeId}-${field.name}`}
                        value={headers[field.name]}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={field.placeholder}
                        disabled={update.isPending}
                        onChange={(event) =>
                           setHeader(field.name, event.target.value)
                        }
                     />
                  </Field>
               ))}
               <Field label="Expires" htmlFor={`${typeId}-expires`}>
                  <Input
                     id={`${typeId}-expires`}
                     type="datetime-local"
                     value={expires}
                     disabled={update.isPending}
                     onChange={(event) => {
                        setRequestError(null);
                        setExpires(event.target.value);
                     }}
                  />
               </Field>
               <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                     <Label>Custom metadata</Label>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={update.isPending}
                        onClick={() =>
                           setRows((previous) => [
                              ...previous,
                              { id: nextRowId.current++, key: "", value: "" },
                           ])
                        }
                     >
                        <Plus aria-hidden="true" />
                        Add
                     </Button>
                  </div>
                  {rows.length === 0 && (
                     <p className="text-xs text-viewertext">
                        No custom metadata on this object.
                     </p>
                  )}
                  {rows.map((row) => (
                     <div key={row.id} className="flex items-center gap-2">
                        <Input
                           value={row.key}
                           autoComplete="off"
                           spellCheck={false}
                           placeholder="name"
                           aria-label="Metadata name"
                           disabled={update.isPending}
                           className="min-w-0 flex-1"
                           onChange={(event) =>
                              setRow(row.id, { key: event.target.value })
                           }
                        />
                        <Input
                           value={row.value}
                           autoComplete="off"
                           spellCheck={false}
                           placeholder="value"
                           className="min-w-0 flex-1"
                           aria-label="Metadata value"
                           disabled={update.isPending}
                           onChange={(event) =>
                              setRow(row.id, { value: event.target.value })
                           }
                        />
                        <Button
                           type="button"
                           variant="ghost"
                           size="icon-sm"
                           aria-label={`Remove ${row.key || "metadata entry"}`}
                           disabled={update.isPending}
                           onClick={() => {
                              setRequestError(null);
                              setRows((previous) =>
                                 previous.filter((item) => item.id !== row.id)
                              );
                           }}
                        >
                           <X aria-hidden="true" />
                        </Button>
                     </div>
                  ))}
               </div>
               <FormError id={errorId}>{error}</FormError>
            </>
         )}
      </FormDialog>
   );
};

export default ObjectSettingsModal;
