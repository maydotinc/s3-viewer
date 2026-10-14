import CenteredSpinner from "@/components/centered-spinner";
import { ApiError, errorMessage } from "@/lib/api";
import useSaveObjectContent from "@/lib/hooks/mutations/object/useSaveObjectContent";
import useObjectContent from "@/lib/hooks/queries/s3/useObjectContent";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import { useServerId } from "@/lib/stores/session-scope";
import useSessionStore, { useUserId } from "@/lib/stores/session-store";
import { visibleText } from "@/lib/utils/format";
import { observedETagSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { toast } from "@s3-viewer/ui/components/toast";
import { Save, X } from "lucide-react";
import {
   useCallback,
   useEffect,
   useMemo,
   useRef,
   useState,
   type UIEvent,
} from "react";
import {
   applyLineEnding,
   dominantLineEnding,
   editorLineCount,
   isSaveShortcut,
   toEditorText,
   type LineEnding,
} from "./editor-input";
import { PREVIEW_PANEL } from "./preview-frame";

type ObjectEditorProps = {
   bucketName: string;
   objectKey: string;
   fileName: string;
   contentType: string;
   onClose: () => void;
};

const UNSAVED_MESSAGE =
   "This file has unsaved changes. Leave without saving them?";
const CONFLICT_MESSAGE =
   "Changed since you opened it. Reload to see the latest version.";

const ObjectEditor = ({
   bucketName,
   objectKey,
   fileName,
   contentType,
   onClose,
}: ObjectEditorProps) => {
   const name = visibleText(fileName);
   const userId = useUserId();
   const serverId = useServerId();
   const scope = useRef({ userId, serverId, bucketName, objectKey });
   const currentScope = useRef(scope.current);
   currentScope.current = { userId, serverId, bucketName, objectKey };
   const scopeMatches = useCallback(() => {
      const session = useSessionStore.getState();
      const original = scope.current;
      const current = currentScope.current;
      return (
         session.userId === original.userId &&
         session.serverId === original.serverId &&
         current.userId === original.userId &&
         current.serverId === original.serverId &&
         current.bucketName === original.bucketName &&
         current.objectKey === original.objectKey
      );
   }, []);
   const content = useObjectContent(bucketName, objectKey, scopeMatches());
   const { mutate: save, isPending: saving } = useSaveObjectContent();
   const [value, setValue] = useState("");
   const [baseline, setBaseline] = useState("");
   const [eTag, setETag] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const gutterRef = useRef<HTMLDivElement | null>(null);
   const textareaRef = useRef<HTMLTextAreaElement | null>(null);
   const panelRef = useRef<HTMLElement | null>(null);
   const lineEnding = useRef<LineEnding>("\n");
   const loaded = useRef(false);

   const data = content.data;
   useEffect(() => {
      if (!data || loaded.current) return;
      loaded.current = true;
      lineEnding.current = dominantLineEnding(data.text);
      const text = toEditorText(data.text);
      setValue(text);
      setBaseline(text);
      setETag(data.eTag);
   }, [data]);

   const dirty = loaded.current && value !== baseline;

   const commit = useCallback(() => {
      if (saving || !loaded.current || value === baseline) return;
      if (!scopeMatches()) {
         setError(
            "The editing target changed. Reopen the file before saving it."
         );
         return;
      }
      const reviewed = observedETagSchema.safeParse(eTag);
      if (!reviewed.success) {
         setError("Reload the file before saving it.");
         return;
      }
      const text = value;
      setError(null);
      save(
         {
            ...scope.current,
            contentType: contentType || "text/plain",
            expectedETag: reviewed.data,
            text: applyLineEnding(text, lineEnding.current),
         },
         {
            onSuccess: (uploaded) => {
               setBaseline(text);
               setETag(uploaded.eTag);
               toast.success("Saved.");
            },
            onError: (failure) =>
               setError(
                  failure instanceof ApiError && failure.status === 409
                     ? CONFLICT_MESSAGE
                     : errorMessage(failure)
               ),
         }
      );
   }, [save, saving, eTag, value, baseline, scopeMatches, contentType]);

   const latestCommit = useRef(commit);
   latestCommit.current = commit;
   useEffect(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const onKeyDown = (event: KeyboardEvent) => {
         if (!isSaveShortcut(event)) return;
         event.preventDefault();
         latestCommit.current();
      };
      panel.addEventListener("keydown", onKeyDown);
      return () => panel.removeEventListener("keydown", onKeyDown);
   }, []);

   useUnsavedChangesGuard(dirty, UNSAVED_MESSAGE, scopeMatches);

   const lineCount = useMemo(() => editorLineCount(value), [value]);
   const gutter = useMemo(
      () =>
         lineCount === null
            ? null
            : Array.from({ length: lineCount }, (_, index) => index + 1).join(
                 "\n"
              ),
      [lineCount]
   );

   useEffect(() => {
      if (gutterRef.current && textareaRef.current)
         gutterRef.current.scrollTop = textareaRef.current.scrollTop;
   }, [gutter]);

   const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
      if (gutterRef.current)
         gutterRef.current.scrollTop = event.currentTarget.scrollTop;
   };

   const close = () => {
      if (dirty && !window.confirm(UNSAVED_MESSAGE)) return;
      onClose();
   };

   return (
      <section
         ref={panelRef}
         className={PREVIEW_PANEL}
         aria-label={`Editing ${name}`}
      >
         <div className="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b border-viewerborder px-3">
            {error ? (
               <p
                  role="alert"
                  title={error}
                  className="line-clamp-2 min-w-0 flex-1 text-xs text-viewertextred [overflow-wrap:anywhere]"
               >
                  {error}
               </p>
            ) : (
               <p className="min-w-0 flex-1 truncate text-sm font-medium text-viewerblack">
                  {name}
               </p>
            )}
            <span
               className={`size-2 shrink-0 rounded-full bg-viewerblue ${dirty ? "" : "invisible"}`}
               title="Unsaved changes"
               aria-label={dirty ? "Unsaved changes" : undefined}
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
               <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={close}
               >
                  <X aria-hidden="true" />
                  Cancel
               </Button>
               <Button
                  size="sm"
                  loading={saving}
                  disabled={!dirty || content.isPending}
                  onClick={commit}
               >
                  <Save aria-hidden="true" />
                  Save
               </Button>
            </div>
         </div>
         {content.isPending ? (
            <CenteredSpinner size="lg" label="Loading file" />
         ) : content.error ? (
            <div className="flex flex-1 items-center justify-center p-6">
               <p className="text-sm text-viewertext">
                  {errorMessage(content.error)}
               </p>
            </div>
         ) : (
            <div className="flex min-h-0 flex-1">
               {gutter !== null && (
                  <div
                     ref={gutterRef}
                     aria-hidden="true"
                     className="w-12 shrink-0 overflow-hidden border-r border-viewerborder bg-viewergray py-3 pr-2 text-right font-mono text-xs leading-5 whitespace-pre text-viewerlighttext"
                  >
                     {gutter}
                  </div>
               )}
               <textarea
                  ref={textareaRef}
                  value={value}
                  wrap="off"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={`Contents of ${name}`}
                  readOnly={saving}
                  className="min-h-0 min-w-0 flex-1 resize-none bg-viewerwhite px-3 py-3 font-mono text-base leading-5 text-viewerblack outline-none sm:text-xs"
                  onScroll={syncScroll}
                  onChange={(event) => setValue(event.target.value)}
               />
            </div>
         )}
      </section>
   );
};

export default ObjectEditor;
