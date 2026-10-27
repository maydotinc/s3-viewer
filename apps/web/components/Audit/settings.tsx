import Field, { FieldSkeleton } from "@/components/form-field";
import QueryStatus from "@/components/query-status";
import StaleSignIn, { isSessionStale } from "@/components/stale-sign-in";
import { FORM_GRID } from "@/components/Settings/card";
import useUpdateAuditSettings from "@/lib/hooks/mutations/server/useUpdateAuditSettings";
import useAuditSettings from "@/lib/hooks/queries/server/useAuditSettings";
import {
   Role,
   type AuditLevel,
   type AuditManageRole,
   type AuditSettings,
   type AuditSettingsInput,
} from "@s3-viewer/shared";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { Label } from "@s3-viewer/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { useEffect, useId, useState, type FormEvent } from "react";
import {
   LEVEL_OPTIONS,
   RETENTION_OPTIONS,
   retentionLabel,
   type Option,
} from "./labels";

const CARD = "flex min-h-0 w-full flex-1 flex-col gap-4 p-4 sm:p-6";
const OWNER_ONLY = "Only the server owner can change this.";
const OWNER_TURNS_OFF = "Only the server owner can turn the log off.";

const VIEW_ROLES: readonly Option[] = [
   { value: Role.OWNER, label: "Owner only" },
   { value: Role.ADMIN, label: "Admins and up" },
   { value: Role.EDITOR, label: "Editors and up" },
   { value: Role.VIEWER, label: "Everyone" },
];

const MANAGE_ROLES: readonly Option[] = [
   { value: Role.OWNER, label: "Owner only" },
   { value: Role.ADMIN, label: "Admins and up" },
];

const isDirty = (draft: AuditSettings, saved: AuditSettings) =>
   (Object.keys(saved) as (keyof AuditSettings)[]).some(
      (key) => draft[key] !== saved[key]
   );

const settingsPayload = (
   serverId: string,
   draft: AuditSettings,
   isOwner: boolean
): AuditSettingsInput =>
   isOwner ? { ...draft, serverId } : { serverId, enabled: draft.enabled };

const canToggleLog = (saved: AuditSettings, isOwner: boolean): boolean =>
   isOwner || !saved.enabled;

type OwnerFieldProps = {
   id: string;
   label: string;
   value: string;
   options: readonly Option[];
   locked: boolean;
   onChange: (value: string) => void;
};

const OwnerField = ({
   id,
   label,
   value,
   options,
   locked,
   onChange,
}: OwnerFieldProps) => {
   const trigger = (
      <SelectTrigger id={id} disabled={locked}>
         <SelectValue />
      </SelectTrigger>
   );
   return (
      <Field label={label} htmlFor={id} className="gap-2">
         <Select value={value} disabled={locked} onValueChange={onChange}>
            {locked ? (
               <SimpleTooltip label={OWNER_ONLY}>{trigger}</SimpleTooltip>
            ) : (
               trigger
            )}
            <SelectContent>
               {options.map((option) => (
                  <SelectItem
                     key={option.value}
                     value={option.value}
                     description={option.description}
                  >
                     {option.label}
                  </SelectItem>
               ))}
            </SelectContent>
         </Select>
      </Field>
   );
};

type FormProps = {
   serverId: string;
   saved: AuditSettings;
   isOwner: boolean;
};

const SettingsForm = ({ serverId, saved, isOwner }: FormProps) => {
   const [draft, setDraft] = useState(saved);
   const update = useUpdateAuditSettings();
   const id = useId();
   const stale = isSessionStale(update.error);

   useEffect(() => setDraft(saved), [saved]);

   const submit = (event: FormEvent) => {
      event.preventDefault();
      update.mutate(settingsPayload(serverId, draft, isOwner));
   };

   const toggleLocked = !canToggleLog(saved, isOwner);
   const toggle = (
      <Checkbox
         id={`${id}-enabled`}
         checked={draft.enabled}
         disabled={toggleLocked}
         onCheckedChange={(checked) =>
            setDraft({ ...draft, enabled: checked === true })
         }
      />
   );

   return (
      <form onSubmit={submit} className={CARD}>
         <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-h-5 items-center gap-3">
               {toggleLocked ? (
                  <SimpleTooltip label={OWNER_TURNS_OFF}>
                     {toggle}
                  </SimpleTooltip>
               ) : (
                  toggle
               )}
               <Label htmlFor={`${id}-enabled`}>
                  Record activity on this server
               </Label>
            </div>
            <p className="text-xs text-viewertext">
               Turning the log off is itself recorded.
            </p>
         </div>
         <div className={FORM_GRID}>
            <OwnerField
               id={`${id}-view`}
               label="Who can view"
               value={draft.viewRole}
               options={VIEW_ROLES}
               locked={!isOwner}
               onChange={(viewRole) =>
                  setDraft({ ...draft, viewRole: viewRole as Role })
               }
            />
            <OwnerField
               id={`${id}-manage`}
               label="Who can change these settings"
               value={draft.manageRole}
               options={MANAGE_ROLES}
               locked={!isOwner}
               onChange={(manageRole) =>
                  setDraft({
                     ...draft,
                     manageRole: manageRole as AuditManageRole,
                  })
               }
            />
            <OwnerField
               id={`${id}-retention`}
               label="Keep records for"
               value={String(draft.retentionDays)}
               options={RETENTION_OPTIONS.map((days) => ({
                  value: String(days),
                  label: retentionLabel(days),
                  description:
                     days === 0
                        ? "Set by whoever runs this install"
                        : undefined,
               }))}
               locked={!isOwner}
               onChange={(days) =>
                  setDraft({ ...draft, retentionDays: Number(days) })
               }
            />
            <OwnerField
               id={`${id}-level`}
               label="What to record"
               value={draft.level}
               options={LEVEL_OPTIONS}
               locked={!isOwner}
               onChange={(level) =>
                  setDraft({ ...draft, level: level as AuditLevel })
               }
            />
         </div>
         {stale && (
            <StaleSignIn
               title="Sign in again to change these settings"
               action="changing audit log settings"
            />
         )}
         <div className="flex justify-end">
            <Button
               type="submit"
               loading={update.isPending}
               disabled={!isDirty(draft, saved)}
            >
               Save
            </Button>
         </div>
      </form>
   );
};

const SettingsSkeleton = () => (
   <div aria-busy="true" className={CARD}>
      <span className="sr-only">Loading audit settings</span>
      <div className="flex min-w-0 flex-col gap-2">
         <div className="flex h-5 items-center gap-3">
            <Skeleton className="size-4 shrink-0 rounded" />
            <Skeleton className="h-3.5 w-48" />
         </div>
         <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-52" />
         </div>
      </div>
      <div className={FORM_GRID}>
         {Array.from({ length: 4 }, (_, index) => (
            <FieldSkeleton key={index} />
         ))}
      </div>
      <div className="flex justify-end">
         <Skeleton className="h-9 w-16.75 rounded-lg pointer-coarse:h-11" />
      </div>
   </div>
);

type SettingsProps = { serverId: string; myRole: Role };

const Settings = ({ serverId, myRole }: SettingsProps) => {
   const settings = useAuditSettings(serverId);
   return (
      <div className="@container flex min-h-[30rem] w-full min-w-0 max-w-3xl shrink-0 flex-col overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite">
         <QueryStatus
            error={settings.error}
            loading={!settings.data}
            skeleton={<SettingsSkeleton />}
            title="Couldn't load audit settings"
            retrying={settings.isFetching}
            onRetry={() => void settings.refetch()}
         >
            {settings.data && (
               <SettingsForm
                  serverId={serverId}
                  saved={settings.data}
                  isOwner={myRole === Role.OWNER}
               />
            )}
         </QueryStatus>
      </div>
   );
};

export default Settings;
export { canToggleLog, settingsPayload };
