import ErrorBoundary from "@s3-viewer/ui/error-boundary";
import { JSON_STRING_PREVIEW_CHARS } from "@/lib/utils/file-utils";
import { pluralize } from "@/lib/utils/format";
import { Button } from "@s3-viewer/ui/components/button";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
   countEntries,
   countNodes,
   EXPAND_ALL_LIMIT,
   flattenJson,
   isBranch,
   SMALL_DOCUMENT,
   type Json,
   type JsonRow,
} from "./json-rows";
import {
   BodyPreview,
   type BodyPreviewProps,
   CopyButton,
   Panel,
   RawText,
   RawTextBody,
   type ViewMode,
   ViewTabs,
} from "./preview-panel";

const INDENT = 14;

const ROW_ESTIMATE = 24;

type ParsedJson = { value: Json; nodes: number };

const parseJson = (text: string): ParsedJson | null => {
   try {
      const value = JSON.parse(text) as Json;
      return { value, nodes: countNodes(value, EXPAND_ALL_LIMIT) };
   } catch {
      return null;
   }
};

const Punct = ({ children }: { children: React.ReactNode }) => (
   <span className="text-viewertext">{children}</span>
);

const JsonString = ({ value }: { value: string }) => {
   const clipped = value.length > JSON_STRING_PREVIEW_CHARS;
   const end =
      clipped &&
      (value.codePointAt(JSON_STRING_PREVIEW_CHARS - 1) ?? 0) > 0xffff
         ? JSON_STRING_PREVIEW_CHARS - 1
         : JSON_STRING_PREVIEW_CHARS;
   return (
      <>
         {JSON.stringify(clipped ? value.slice(0, end) : value)}
         {clipped && <span className="text-viewerlighttext"> … truncated</span>}
      </>
   );
};

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
      {typeof value === "string" ? (
         <JsonString value={value} />
      ) : (
         JSON.stringify(value)
      )}
   </span>
);

const ROW =
   "flex w-full items-start gap-1.5 px-4 text-left transition-colors duration-150 hover:bg-viewergray/60";

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
               {row.indexed ? row.label : <JsonString value={row.label} />}
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
               {pluralize(row.count, row.array ? "item" : "key")}
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

   if (row.kind === "truncated")
      return (
         <span className="text-viewerlighttext">
            {pluralize(row.count, row.array ? "more item" : "more key")} not
            shown — download to view
         </span>
      );

   return (
      <>
         <Punct>{closeBracket}</Punct>
         {comma}
      </>
   );
};

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
         <span className="grid">
            <span className="col-start-1 row-start-1">
               {collapsing ? "Collapse all" : "Expand all"}
            </span>
            <span className="invisible col-start-1 row-start-1">
               {collapsing ? "Expand all" : "Collapse all"}
            </span>
         </span>
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
         return row
            ? row.kind === "close"
               ? `${row.path}:close`
               : row.path
            : index;
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
               const foldable =
                  row.kind === "open" ||
                  row.kind === "close" ||
                  row.kind === "closed";
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

const JsonTree = ({ value, nodes, text }: ParsedJson & { text: string }) => {
   const small = nodes < SMALL_DOCUMENT;
   const canExpandAll = nodes < EXPAND_ALL_LIMIT;

   const [mode, setMode] = useState<ViewMode>("preview");
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

   const summary = isBranch(value)
      ? pluralize(countEntries(value), Array.isArray(value) ? "item" : "key")
      : "One value";

   return (
      <Panel
         summary={summary}
         actions={
            <>
               <ViewTabs mode={mode} onChange={setMode} />
               {mode === "preview" && (
                  <ExpandAllButton
                     collapsing={collapsing}
                     blocked={!collapsing && !canExpandAll}
                     onClick={toggleAll}
                  />
               )}
               <CopyButton text={text} />
            </>
         }
      >
         {mode === "preview" ? (
            <VirtualRows rows={rows} onToggle={onToggle} />
         ) : (
            <RawTextBody text={text} />
         )}
      </Panel>
   );
};

const JsonBody = ({ text, version }: { text: string; version: string }) => {
   const parsed = useMemo(() => parseJson(text), [text]);
   if (!parsed)
      return (
         <RawText text={text} summary="Not valid JSON — showing the raw file" />
      );
   return (
      <ErrorBoundary
         key={version}
         fallback={
            <RawText
               text={text}
               summary="Couldn't render this JSON — showing the raw file"
            />
         }
      >
         <JsonTree value={parsed.value} nodes={parsed.nodes} text={text} />
      </ErrorBoundary>
   );
};

const JsonPreview = (props: BodyPreviewProps) => (
   <BodyPreview {...props} label="JSON">
      {(body) => <JsonBody {...body} />}
   </BodyPreview>
);

export default JsonPreview;
