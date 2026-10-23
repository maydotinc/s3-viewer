import Field from "@/components/form-field";
import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import { ROLE_DESCRIPTIONS, assignableRoles } from "@s3-viewer/permissions";
import type { GrantableRole, ServerInfo } from "@s3-viewer/types";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import {
   memo,
   useCallback,
   useEffect,
   useId,
   useMemo,
   useRef,
   type SetStateAction,
} from "react";
import BucketAccessPicker from "../bucket-access-picker";
import type { GrantRow } from "../bucket-grants";
import LinkButton from "../link-button";
import RoleSelect from "../role-select";
import { grantableBucketRoles } from "../roles";
import type { ServerBuckets } from "./useServerBuckets";
import {
   defaultAccess,
   listLevelProblem,
   serverAccessProblem,
   type ServerAccess,
} from "./wizard-state";
import { accessStatus, type StatusTone } from "./wizard-text";

type AccessUpdate = (current: ServerAccess) => ServerAccess;

type ServerAccessSectionProps = {
   server: ServerInfo;
   access: ServerAccess | undefined;
   buckets: ServerBuckets;
   expanded: boolean;
   // the only server gets a plain heading instead of an accordion button
   single: boolean;
   submitted: boolean;
   focusRequest: number;
   onAccessChange: (
      serverId: string,
      fallback: ServerAccess,
      update: AccessUpdate
   ) => void;
   onExpand: (serverId: string) => void;
   onRemove: (serverId: string) => void;
};

const STATUS_TONE: Readonly<Record<StatusTone, string>> = {
   muted: "text-viewerlighttext",
   set: "text-viewertext",
   error: "text-viewerstrongred",
};

const HEADER = "flex h-12 w-full items-center gap-3 px-3 text-left";

const INVALID = '[aria-invalid="true"]';
const FOCUSABLE =
   '[role="checkbox"]:not([disabled]), [role="combobox"]:not([disabled]), input:not([disabled])';

const ServerAccessSection = memo(function ServerAccessSection({
   server,
   access,
   buckets,
   expanded,
   single,
   submitted,
   focusRequest,
   onAccessChange,
   onExpand,
   onRemove,
}: ServerAccessSectionProps) {
   const bodyId = useId();
   const roleId = useId();
   const bodyRef = useRef<HTMLDivElement>(null);
   const myRole = server.userRole;
   const roles = useMemo(() => assignableRoles(myRole), [myRole]);
   const fallback = useMemo(() => defaultAccess(myRole), [myRole]);
   const { role, rows } = access ?? fallback;
   const { buckets: list, isLoading, error: loadError } = buckets;
   const loaded = !isLoading && loadError === null;
   const noBuckets = loaded && list.length === 0;
   const grantable = useMemo(
      () =>
         list.filter(
            (bucket) => grantableBucketRoles(myRole, bucket).length > 0
         ).length,
      [list, myRole]
   );
   const problem =
      submitted && loaded && !noBuckets
         ? serverAccessProblem({
              rows,
              buckets: list,
              myRole,
              serverRole: role,
           })
         : null;
   const status = accessStatus({
      role,
      checked: rows.length,
      grantable,
      noBuckets,
      problem,
   });

   const setRows = useCallback(
      (update: SetStateAction<GrantRow[]>) =>
         onAccessChange(server.id, fallback, (current) => ({
            ...current,
            rows: typeof update === "function" ? update(current.rows) : update,
         })),
      [server.id, fallback, onAccessChange]
   );
   const setRole = useCallback(
      (next: GrantableRole) =>
         onAccessChange(server.id, fallback, (current) => ({
            ...current,
            role: next,
         })),
      [server.id, fallback, onAccessChange]
   );

   useEffect(() => {
      if (!expanded || focusRequest === 0) return;
      const body = bodyRef.current;
      (
         body?.querySelector<HTMLElement>(INVALID) ??
         body?.querySelector<HTMLElement>(FOCUSABLE)
      )?.focus();
   }, [expanded, focusRequest]);

   const summary = (
      <>
         <ServerLogo provider={server.provider} />
         <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-viewerblack">
               {server.name}
            </span>
            <span className={cn("truncate text-xs", STATUS_TONE[status.tone])}>
               {status.text}
            </span>
         </span>
      </>
   );

   return (
      <div className="rounded-lg border border-viewerborder">
         {single ? (
            <div className={HEADER}>{summary}</div>
         ) : (
            <button
               type="button"
               aria-expanded={expanded}
               aria-controls={bodyId}
               onClick={() => onExpand(server.id)}
               className={cn(
                  HEADER,
                  "cursor-pointer rounded-lg outline-none hover:bg-viewergray/60",
                  FOCUS_RING,
                  "focus-visible:-outline-offset-2",
                  expanded && "rounded-b-none"
               )}
            >
               {summary}
               <ChevronDown
                  aria-hidden="true"
                  className={cn(
                     "size-4 shrink-0 text-viewerlighttext transition-transform motion-reduce:transition-none",
                     expanded && "rotate-180"
                  )}
               />
            </button>
         )}
         {expanded && (
            <div
               id={bodyId}
               ref={bodyRef}
               className="flex flex-col gap-4 border-t border-viewerborder px-3 py-4"
            >
               <Field label="Server role" htmlFor={roleId}>
                  <RoleSelect
                     id={roleId}
                     label="Server role"
                     className="w-full sm:w-64"
                     value={role}
                     roles={roles}
                     onChange={setRole}
                  />
                  <p className="min-h-10 text-xs leading-5 text-viewerlighttext">
                     {ROLE_DESCRIPTIONS[role]}
                  </p>
               </Field>
               <BucketAccessPicker
                  serverId={server.id}
                  serverName={server.name}
                  heading="Bucket access"
                  label={`Bucket access on ${server.name}`}
                  myRole={myRole}
                  buckets={list}
                  isLoading={isLoading}
                  loadError={loadError}
                  onRetry={buckets.refetch}
                  retrying={buckets.isFetching}
                  value={rows}
                  onChange={setRows}
                  serverRole={role}
                  showErrors={submitted}
                  error={listLevelProblem(problem)}
                  errorAction={
                     noBuckets &&
                     !single && (
                        <LinkButton onClick={() => onRemove(server.id)}>
                           Remove this server
                        </LinkButton>
                     )
                  }
               />
            </div>
         )}
      </div>
   );
});

export default ServerAccessSection;
export type { AccessUpdate };
