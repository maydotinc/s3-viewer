import { useBucketContext } from "@/components/Buckets/Context";
import useObjectBody from "@/lib/hooks/queries/s3/useObjectBody";
import { MAX_JSON_PREVIEW_BYTES } from "@/lib/utils/fileUtils";
import { toastError } from "@/lib/utils/toast";
import type { S3ObjectPreview } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { toast } from "@s3-viewer/ui/components/toast";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight, Copy } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
   countNodes,
   EXPAND_ALL_LIMIT,
   entriesOf,
   flattenJson,
   isBranch,
   SMALL_DOCUMENT,
   type Json,
   type JsonRow,
} from "./json-rows";
import { PREVIEW_PANEL, PreviewLoading, TextFrame } from "./preview-frame";

const INDENT = 14;

const ROW_ESTIMATE = 24;

const parseJson = (text: string): { value: Json } | null => {
   try {
      return { value: JSON.parse(text) as Json };
   } catch {
      return null;
   }
};

const plural = (count: number, word: string) =>
   `${count} ${word}${count === 1 ? "" : "s"}`;

const Punct = ({ children }: { children: React.ReactNode }) => (
   <span className="text-viewertext">{children}</span>
);

const Scalar = ({ value }: { value: Json }) => (
   <span
      className={
         typeof value === "string"
            ? "text-jsonstring"
            : typeof value === "number"
              ? "text-jsonnumber tabular-nums"
              : "text-jsonliteral"
      }
   >
      {JSON.stringify(value)}
   </span>
);

const ROW =
   "flex w-full items-start gap-1.5 px-4 text-left transition-colors duration-150 hover:bg-viewergray/60";

/**
 * One line of the document. The chevron keeps its 14px slot on every row, so
 * keys line up whether or not the row can be opened, and the indent hangs off
 * that slot rather than off the text.
 */
const Row = ({
   depth,
   open,
   onToggle,
   chevron = Boolean(onToggle),
   children,
}: {
   depth: number;
   open?: boolean;
   onToggle?: () => void;
   /** A closing bracket folds the branch too, but marking it twice reads wrong. */
   chevron?: boolean;
   children: React.ReactNode;
}) => {
   const inner = (
      <>
         <span
            className="flex h-6 w-3.5 shrink-0 items-center"
            style={{ marginLeft: depth * INDENT }}
            aria-hidden="true"
         >
            {chevron && (
               <ChevronRight
                  className={cn(
                     "size-3.5 text-viewerlighttext transition-transform duration-150",
                     open && "rotate-90"
                  )}
               />
            )}
         </span>
         <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
            {children}
         </span>
      </>
   );

   if (!onToggle) return <div className={ROW}>{inner}</div>;
   return (
      <button
         type="button"
         onClick={onToggle}
         aria-expanded={open}
         className={ROW}
      >
         {inner}
      </button>
   );
};

const RowBody = ({ row }: { row: JsonRow }) => {
   const key =
      row.label === undefined ? null : (
         <>
            <span
               className={row.indexed ? "text-viewerlighttext" : "text-jsonkey"}
            >
               {row.indexed ? row.label : JSON.stringify(row.label)}
            </span>
            <Punct>: </Punct>
         </>
      );
   const comma = row.last ? null : <Punct>,</Punct>;
   const [openBracket, closeBracket] = row.array ? ["[", "]"] : ["{", "}"];

   if (row.kind === "scalar")
      return (
         <>
            {key}
            <Scalar value={row.value} />
            {comma}
         </>
      );

   if (row.kind === "empty")
      return (
         <>
            {key}
            <Punct>{openBracket + closeBracket}</Punct>
            {comma}
         </>
      );

   if (row.kind === "closed")
      return (
         <>
            {key}
            <Punct>{openBracket}</Punct>
            <span className="px-1 text-viewerlighttext">
               {plural(row.count, row.array ? "item" : "key")}
            </span>
            <Punct>{closeBracket}</Punct>
            {comma}
         </>
      );

   if (row.kind === "open")
      return (
         <>
            {key}
            <Punct>{openBracket}</Punct>
         </>
      );

   return (
      <>
         <Punct>{closeBracket}</Punct>
         {comma}
      </>
   );
};

const Panel = ({
   summary,
   actions,
   children,
}: {
   summary: string;
   actions?: React.ReactNode;
   children: React.ReactNode;
}) => (
   <div className={PREVIEW_PANEL}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-viewerborder bg-viewergray/60 px-4">
         <span className="truncate text-[13px] text-viewertext tabular-nums">
            {summary}
         </span>
         <div className="ml-auto flex shrink-0 items-center gap-1">
            {actions}
         </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col font-mono text-[13px] leading-6">
         {children}
      </div>
   </div>
);

const CopyButton = ({ text }: { text: string }) => {
   const copy = async () => {
      try {
         await navigator.clipboard.writeText(text);
         toast.success("Copied to clipboard.");
      } catch (error) {
         toastError("Couldn't copy the file")(error);
      }
   };
   return (
      <Button variant="ghost" size="sm" onClick={() => void copy()}>
         <Copy aria-hidden="true" />
         Copy
      </Button>
   );
};

/**
 * Collapsing is always cheap; expanding a huge document is not, so past
 * `EXPAND_ALL_LIMIT` the button is disabled and says why.
 */
const ExpandAllButton = ({
   collapsing,
   blocked,
   onClick,
}: {
   collapsing: boolean;
   blocked: boolean;
   onClick: () => void;
}) => {
   const button = (
      <Button variant="ghost" size="sm" disabled={blocked} onClick={onClick}>
         {collapsing ? "Collapse all" : "Expand all"}
      </Button>
   );
   if (!blocked) return button;
   return (
      <SimpleTooltip label="Too many rows to expand at once">
         {button}
      </SimpleTooltip>
   );
};

const VirtualRows = ({
   rows,
   onToggle,
}: {
   rows: JsonRow[];
   onToggle: (path: string, open: boolean) => void;
}) => {
   const containerRef = useRef<HTMLDivElement>(null);
   const virtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => containerRef.current,
      estimateSize: () => ROW_ESTIMATE,
      overscan: 12,
      getItemKey: (index) => {
         const row = rows[index];
         return row ? `${row.path}:${row.kind}` : index;
      },
   });

   return (
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto py-2">
         <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
         >
            {virtualizer.getVirtualItems().map((item) => {
               const row = rows[item.index];
               if (!row) return null;
               const foldable = row.kind !== "scalar" && row.kind !== "empty";
               const open = row.kind === "open" || row.kind === "close";
               return (
                  <div
                     key={item.key}
                     ref={virtualizer.measureElement}
                     data-index={item.index}
                     className="absolute left-0 top-0 w-full"
                     style={{ transform: `translateY(${item.start}px)` }}
                  >
                     <Row
                        depth={row.depth}
                        {...(foldable
                           ? {
                                open,
                                onToggle: () => onToggle(row.path, !open),
                                chevron: row.kind !== "close",
                             }
                           : {})}
                     >
                        <RowBody row={row} />
                     </Row>
                  </div>
               );
            })}
         </div>
      </div>
   );
};

const JsonTree = ({ value, text }: { value: Json; text: string }) => {
   const nodes = useMemo(() => countNodes(value, EXPAND_ALL_LIMIT), [value]);
   const small = nodes < SMALL_DOCUMENT;
   const canExpandAll = nodes < EXPAND_ALL_LIMIT;

   const [expandAll, setExpandAll] = useState<boolean | null>(null);
   const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(
      () => new Map()
   );
   const collapsing = expandAll !== false;

   const toggleAll = () => {
      setExpandAll(!collapsing);
      setOverrides(new Map());
   };

   const onToggle = useCallback((path: string, open: boolean) => {
      setOverrides((previous) => {
         const next = new Map(previous);
         next.set(path, open);
         return next;
      });
   }, []);

   const rows = useMemo(
      () => flattenJson({ value, overrides, expandAll, small }),
      [value, overrides, expandAll, small]
   );

   const pretty = useMemo(
      () => JSON.stringify(value, null, 2) ?? text,
      [value, text]
   );
   const summary = isBranch(value)
      ? plural(entriesOf(value).length, Array.isArray(value) ? "item" : "key")
      : "One value";

   return (
      <Panel
         summary={summary}
         actions={
            <>
               <ExpandAllButton
                  collapsing={collapsing}
                  blocked={!collapsing && !canExpandAll}
                  onClick={toggleAll}
               />
               <CopyButton text={pretty} />
            </>
         }
      >
         <VirtualRows rows={rows} onToggle={onToggle} />
      </Panel>
   );
};

const RawText = ({ text }: { text: string }) => (
   <Panel
      summary="Not valid JSON — showing the raw file"
      actions={<CopyButton text={text} />}
   >
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-2 text-viewerblack">
         {text}
      </pre>
   </Panel>
);

type JsonPreviewProps = {
   preview: S3ObjectPreview;
   objectKey: string;
   fileName: string;
};

/**
 * A folding, syntax-coloured view of a JSON object. It needs the bytes, not
 * just a URL, so it reads them with a cross-origin `fetch`; a bucket without
 * CORS (or a file too large to hold in a tree) falls back to the plain text
 * frame, which only ever needs the presigned URL.
 */
const JsonPreview = ({ preview, objectKey, fileName }: JsonPreviewProps) => {
   const { bucketName } = useBucketContext();
   const readable = preview.contentLength <= MAX_JSON_PREVIEW_BYTES;
   const { data, isPending, isError } = useObjectBody(
      bucketName,
      objectKey,
      preview.url,
      readable
   );
   const parsed = useMemo(() => (data ? parseJson(data) : null), [data]);

   if (!readable) return <TextFrame url={preview.url} fileName={fileName} />;
   if (isPending) return <PreviewLoading />;
   if (isError || data === undefined)
      return <TextFrame url={preview.url} fileName={fileName} />;
   if (!parsed) return <RawText text={data} />;

   return <JsonTree value={parsed.value} text={data} />;
};

export default JsonPreview;
