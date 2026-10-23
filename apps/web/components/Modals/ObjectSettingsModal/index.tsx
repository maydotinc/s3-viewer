import Field, { FieldSkeleton } from "@/components/form-field";
import type { ModalProps } from "@/lib/contexts/modal-props";
import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import { ApiError, errorMessage } from "@/lib/api";
import useUpdateObjectSettings from "@/lib/hooks/mutations/object/useUpdateObjectSettings";
import useObjectSettings from "@/lib/hooks/queries/s3/useObjectSettings";
import { visibleText } from "@/lib/utils/format";
import type { S3ObjectSettings } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import { Label } from "@s3-viewer/ui/components/label";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
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

const MetadataHeading = ({
   disabled,
   onAdd,
}: {
   disabled: boolean;
   onAdd?: () => void;
}) => (
   <div className="flex items-center justify-between gap-2">
      <Label>Custom metadata</Label>
      <Button
         type="button"
         variant="outline"
         size="sm"
         disabled={disabled}
         onClick={onAdd}
      >
         <Plus aria-hidden="true" />
         Add
      </Button>
   </div>
);

// sized for an object without custom metadata, the usual case
const SettingsSkeleton = () => (
   <>
      {Array.from({ length: HEADER_FIELDS.length + 2 }, (_, index) => (
         <FieldSkeleton key={index} className="gap-1.5" />
      ))}
      <div className="flex flex-col gap-2">
         <MetadataHeading disabled />
         <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-52" />
         </div>
      </div>
      <span className="sr-only">Loading settings</span>
   </>
);

const ObjectSettingsModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   objectKey,
   expectedETag,
   onSaved,
}: ObjectSettingsModalProps) => {
   const settings = useObjectSettings(bucketName, objectKey, { fresh: true });
   const update = useUpdateObjectSettings();
   const typeId = useId();
   const listId = useId();
   const errorId = useId();
   const [contentType, setContentType] = useState("");
   const [headers, setHeaders] = useState<HeaderValues>(NO_HEADERS);
   const [expires, setExpires] = useState("");
   const [rows, setRows] = useState<MetadataRow[]>([]);
   const [requestError, setRequestError] = useState<string | null>(null);
   const [touched, setTouched] = useState(false);
   const nextRowId = useRef(0);
   const [openedAt] = useState(Date.now);
   const [loaded, setLoaded] = useState<S3ObjectSettings | null>(null);

   // a metadata-only rewrite keeps the ETag, so If-Match can't catch a save built on another member's older
   // settings; the form only ever starts from a read that began after it opened
   const { data, isFetching, dataUpdatedAt } = settings;
   const fresh =
      data && !isFetching && dataUpdatedAt >= openedAt ? data : undefined;
   useEffect(() => {
      if (!fresh || loaded) return;
      setLoaded(fresh);
      setContentType(fresh.contentType ?? "");
      setHeaders({
         cacheControl: fresh.cacheControl ?? "",
         contentDisposition: fresh.contentDisposition ?? "",
         contentLanguage: fresh.contentLanguage ?? "",
         contentEncoding: fresh.contentEncoding ?? "",
      });
      setExpires(toDateTimeLocal(fresh.expires));
      const seededRows = rowsFromMetadata(fresh.metadata);
      nextRowId.current = seededRows.length;
      setRows(seededRows);
   }, [fresh, loaded]);

   const headerError =
      HEADER_FIELDS.map((field) =>
         validateHeader(field.label, headers[field.name])
      ).find(Boolean) ?? null;
   const validation =
      contentType.trim() === ""
         ? "Enter a content type."
         : (headerError ?? validateExpires(expires) ?? validateMetadata(rows));
   // stored settings can already be invalid (an empty content type, say), so nothing is red before an edit.
   const error = requestError ?? (touched ? validation : null);

   const touch = () => {
      setRequestError(null);
      setTouched(true);
   };

   const setHeader = (name: HeaderField["name"], value: string) => {
      touch();
      setHeaders((previous) => ({ ...previous, [name]: value }));
   };

   const setRow = (id: number, patch: Partial<MetadataRow>) => {
      touch();
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
         description={`The response headers and custom metadata stored with ${visibleText(objectKey)}. S3 rewrites the object in place, so its version changes.`}
         onSubmit={submit}
         submitLabel="Save settings"
         submitDisabled={!loaded || validation !== null}
         bodyClassName="flex flex-col gap-4"
      >
         {!loaded ? (
            settings.error && !isFetching ? (
               <FormError>{errorMessage(settings.error)}</FormError>
            ) : (
               <SettingsSkeleton />
            )
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
                        touch();
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
                        touch();
                        setExpires(event.target.value);
                     }}
                  />
               </Field>
               <div className="flex flex-col gap-2">
                  <MetadataHeading
                     disabled={update.isPending}
                     onAdd={() =>
                        setRows((previous) => [
                           ...previous,
                           { id: nextRowId.current++, key: "", value: "" },
                        ])
                     }
                  />
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
                              touch();
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
