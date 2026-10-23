import { ApiError, errorMessage } from "@/lib/api";
import useSaveObjectContent from "@/lib/hooks/mutations/object/useSaveObjectContent";
import useObjectContent, {
   type ObjectContent,
} from "@/lib/hooks/queries/s3/useObjectContent";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import { useServerId } from "@/lib/stores/session-scope";
import { isCurrentScope } from "@/lib/stores/current-scope";
import { useUserId } from "@/lib/stores/session-store";
import { visibleText } from "@/lib/utils/format";
import { observedETagSchema } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { toast } from "@s3-viewer/ui/components/toast";
import { cn } from "@s3-viewer/ui/lib/utils";
import { RefreshCw, Save, X } from "lucide-react";
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
const RELOAD_MESSAGE =
   "Reloading throws away your unsaved changes. Reload anyway?";
const CONFLICT_MESSAGE =
   "Changed since you opened it. Reload to see the latest version.";

const LINE_WIDTHS = ["w-48", "w-72", "w-56", "w-0", "w-80", "w-64", "w-40"];

// lines past the pane's height are clipped, the way the textarea clips them
const EditorSkeleton = () => (
   <div aria-busy="true" className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex w-12 shrink-0 flex-col items-end border-r border-viewerborder bg-viewergray py-3 pr-2">
         {Array.from({ length: 40 }, (_, line) => (
            <div key={line} className="flex h-5 shrink-0 items-center">
               <Skeleton className="h-3 w-2 rounded-sm bg-viewerborder" />
            </div>
         ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3">
         {Array.from({ length: 40 }, (_, line) => (
            <div key={line} className="flex h-5 shrink-0 items-center">
               <Skeleton
                  className={cn(
                     "h-3 max-w-full",
                     LINE_WIDTHS[line % LINE_WIDTHS.length]
                  )}
               />
            </div>
         ))}
      </div>
      <span className="sr-only">Loading file</span>
   </div>
);

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
   const scopeMatches = useCallback(
      () => isCurrentScope(scope.current, currentScope.current),
      []
   );
   const content = useObjectContent(bucketName, objectKey, scopeMatches());
   const { mutate: save, isPending: saving } = useSaveObjectContent();
   const [value, setValue] = useState("");
   const [baseline, setBaseline] = useState("");
   const [reloading, setReloading] = useState(false);
   const [eTag, setETag] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
   const gutterRef = useRef<HTMLDivElement | null>(null);
   const textareaRef = useRef<HTMLTextAreaElement | null>(null);
   const panelRef = useRef<HTMLElement | null>(null);
   const lineEnding = useRef<LineEnding>("\n");
   const loaded = useRef(false);

   const seed = useCallback((loadedContent: ObjectContent) => {
      loaded.current = true;
      lineEnding.current = dominantLineEnding(loadedContent.text);
      const text = toEditorText(loadedContent.text);
      setValue(text);
      setBaseline(text);
      setETag(loadedContent.eTag);
   }, []);

   const data = content.data;
   useEffect(() => {
      if (data && !loaded.current) seed(data);
   }, [data, seed]);

   const dirty = loaded.current && value !== baseline;

   // a refetch alone can't re-seed: the load effect runs once, and unchanged text keeps the same reference
   const reload = () => {
      if (dirty && !window.confirm(RELOAD_MESSAGE)) return;
      setReloading(true);
      void content.refetch().then((result) => {
         setReloading(false);
         if (!scopeMatches()) return;
         if (result.error || !result.data) {
            setError(errorMessage(result.error));
            return;
         }
         seed(result.data);
         setError(null);
      });
   };

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
                  className="line-clamp-2 min-w-0 flex-1 text-xs text-viewerstrongred [overflow-wrap:anywhere]"
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
               role="img"
               aria-label={dirty ? "Unsaved changes" : undefined}
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
               {(error === CONFLICT_MESSAGE || reloading) && (
                  <Button
                     variant="ghost"
                     size="sm"
                     loading={reloading}
                     onClick={reload}
                  >
                     <RefreshCw aria-hidden="true" />
                     Reload
                  </Button>
               )}
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
            <EditorSkeleton />
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
