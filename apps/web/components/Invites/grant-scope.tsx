import PathInput from "@/components/path-input";
import RemovableChip from "@/components/removable-chip";
import { usePathSuggestion } from "@/lib/hooks/usePathSuggestion";
import { useUserId } from "@/lib/stores/session-store";
import { visibleText } from "@/lib/utils/format";
import {
   canLimitToFolders,
   type BucketAccessEntry,
   type FolderScope,
   type HowToSlug,
   type Role,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ExternalLink } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import {
   canChooseWholeBucket,
   withSpecificFolders,
   withWholeBucket,
   type GrantRow,
} from "./bucket-grants";
import {
   addGrantFolder,
   editorMessages,
   feedbackFor,
   hintFor,
   type Feedback,
} from "./grant-folders";

type ScopeMode = "whole" | "folders";

const SCOPE_LABEL: Record<ScopeMode, string> = {
   whole: "Whole bucket",
   folders: "Specific folders",
};

type FolderListEditorProps = {
   serverId: string;
   bucketName: string;
   folders: string[];
   draft: string;
   held: FolderScope;
   disabled?: boolean;
   error: string | null;
   showError: boolean;
   onChange: (change: { folders?: string[]; draft?: string }) => void;
};

const FolderListEditor = ({
   serverId,
   bucketName,
   folders,
   draft,
   held,
   disabled,
   error,
   showError,
   onChange,
}: FolderListEditorProps) => {
   const userId = useUserId();
   const inputId = useId();
   const messageId = useId();
   const [feedback, setFeedback] = useState<Feedback | null>(null);
   const plain = draft.replace(/^\/+/, "") === draft && draft.trim() === draft;
   const suggestion = usePathSuggestion(bucketName, plain ? draft : "", {
      scope: { userId, serverId },
      foldersOnly: true,
   });

   const add = () => {
      if (!draft.trim()) return;
      const result = addGrantFolder(folders, draft, held);
      if (!result.ok) {
         setFeedback(feedbackFor("error", result.error, folders));
         return;
      }
      onChange({ folders: result.folders, draft: "" });
      setFeedback(
         result.notice
            ? feedbackFor("notice", result.notice, result.folders)
            : null
      );
   };

   const remove = (folder: string) => {
      onChange({ folders: folders.filter((entry) => entry !== folder) });
      setFeedback(null);
   };

   const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      add();
   };

   const messages = editorMessages({
      feedback,
      folders,
      draft,
      error,
      showError,
      hint: hintFor({
         folders,
         draft,
         held,
         hasSuggestion: Boolean(suggestion),
      }),
   });
   const invalid = messages.some((message) => message.tone === "error");

   return (
      <div className="flex min-w-0 flex-col gap-1.5">
         {folders.length > 0 && (
            <ul
               aria-label={`Folders on ${bucketName}`}
               className="flex min-w-0 flex-wrap gap-1.5"
            >
               {folders.map((folder) => (
                  <RemovableChip
                     key={folder}
                     label={visibleText(folder)}
                     title={visibleText(folder)}
                     disabled={disabled}
                     onRemove={() => remove(folder)}
                  />
               ))}
            </ul>
         )}
         <div className="flex min-w-0 items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
               Add a folder on {bucketName}
            </label>
            <PathInput
               id={inputId}
               className="min-w-0 flex-1"
               inputClassName="h-8"
               value={draft}
               suggestion={suggestion}
               placeholder="landing/"
               disabled={disabled}
               aria-invalid={invalid ? true : undefined}
               aria-describedby={messageId}
               onChange={(event) => {
                  onChange({ draft: event.target.value });
                  setFeedback(null);
               }}
               onKeyDown={onKeyDown}
               onAccept={(accepted) => onChange({ draft: accepted })}
            />
            <Button
               type="button"
               variant="outline"
               size="sm"
               disabled={disabled || !draft.trim()}
               onClick={add}
            >
               Add
            </Button>
         </div>
         <div
            id={messageId}
            role={invalid ? "alert" : undefined}
            className="flex min-w-0 flex-col"
         >
            {messages.map((message) => (
               <p
                  key={message.text}
                  className={cn(
                     "min-w-0 break-words text-xs leading-5",
                     message.tone === "error"
                        ? "text-viewertextred"
                        : "text-viewerlighttext"
                  )}
               >
                  {message.text}
               </p>
            ))}
         </div>
      </div>
   );
};

type GrantScopeProps = {
   serverId: string;
   entry: GrantRow;
   held: FolderScope;
   original?: BucketAccessEntry;
   serverRole?: Role;
   error: string | null;
   showError: boolean;
   disabled?: boolean;
   onChange: (next: GrantRow) => void;
};

const ADMINS_WHOLE = "Admins always get whole buckets";

const FOLDER_GUIDE: HowToSlug = "share-one-folder-in-s3-bucket";

// opens in a new tab so a half-finished invite survives the read
const FolderGuideLink = () => (
   <a
      href={`/how-to/${FOLDER_GUIDE}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
         "inline-flex min-w-0 items-center gap-1 rounded-sm text-xs text-viewerblue underline-offset-4 outline-none hover:underline",
         FOCUS_RING
      )}
   >
      <span className="truncate">How folder access works</span>
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
   </a>
);

const GrantScope = ({
   serverId,
   entry,
   held,
   original,
   serverRole,
   error,
   showError,
   disabled,
   onChange,
}: GrantScopeProps) => {
   const roleLimitable = canLimitToFolders(entry.role);
   const adminMember =
      serverRole !== undefined && !canLimitToFolders(serverRole);
   const limitable = roleLimitable && !adminMember;
   const mode: ScopeMode = entry.folders === null ? "whole" : "folders";
   const wholeAllowed = canChooseWholeBucket(held, original);

   return (
      <div className="flex min-w-0 flex-col gap-1.5 pb-3 pl-7">
         <div className="flex min-w-0 items-center gap-2">
            <Select
               value={mode}
               disabled={disabled || (!limitable && mode === "whole")}
               onValueChange={(next) =>
                  onChange(
                     next === "whole"
                        ? withWholeBucket(entry)
                        : withSpecificFolders(entry, held, original)
                  )
               }
            >
               <SelectTrigger
                  size="sm"
                  aria-label={`Access on ${entry.bucketName}`}
                  className="w-40 shrink-0"
               >
                  <SelectValue>{SCOPE_LABEL[mode]}</SelectValue>
               </SelectTrigger>
               <SelectContent align="start" className="w-64">
                  <SelectItem
                     value="whole"
                     disabled={!wholeAllowed}
                     description={
                        wholeAllowed
                           ? "Everything in this bucket."
                           : "You only have access to some folders here."
                     }
                  >
                     {SCOPE_LABEL.whole}
                  </SelectItem>
                  <SelectItem
                     value="folders"
                     disabled={!limitable}
                     description={
                        limitable
                           ? "Only the folders you list."
                           : `${ADMINS_WHOLE}.`
                     }
                  >
                     {SCOPE_LABEL.folders}
                  </SelectItem>
               </SelectContent>
            </Select>
            {!limitable ? (
               <span className="min-w-0 truncate text-xs text-viewerlighttext">
                  {ADMINS_WHOLE}
               </span>
            ) : (
               mode === "folders" && <FolderGuideLink />
            )}
         </div>
         {entry.folders === null ? (
            error && (
               <p
                  role="alert"
                  className="min-w-0 break-words text-xs leading-5 text-viewertextred"
               >
                  {error}
               </p>
            )
         ) : (
            <FolderListEditor
               serverId={serverId}
               bucketName={entry.bucketName}
               folders={entry.folders}
               draft={entry.draft ?? ""}
               held={held}
               disabled={disabled || !limitable}
               error={error}
               showError={showError}
               onChange={(change) => onChange({ ...entry, ...change })}
            />
         )}
      </div>
   );
};

export default GrantScope;
export { FolderListEditor };
