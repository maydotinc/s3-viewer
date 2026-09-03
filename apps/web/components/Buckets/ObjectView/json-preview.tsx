import { useBucketContext } from "@/components/Buckets/Context";
import useObjectBody from "@/lib/hooks/queries/s3/useObjectBody";
import { MAX_JSON_PREVIEW_BYTES } from "@/lib/utils/fileUtils";
import { toastError } from "@/lib/utils/toast";
import type { S3ObjectPreview } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { toast } from "@s3-viewer/ui/components/toast";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronRight, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { PREVIEW_PANEL, PreviewLoading, TextFrame } from "./preview-frame";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Branch = Json[] | Record<string, Json>;
type Entry = { key: string; value: Json };

/** One indent step, in px. Narrower than the 16px UI step: this is code. */
const INDENT = 14;

/** Under this many nodes the whole document opens on arrival. */
const SMALL_DOCUMENT = 500;

/** Over this, "Expand all" would build more rows than the page can afford. */
const EXPAND_ALL_LIMIT = 5000;

/** Everything shallower than this opens by default in a large document. */
const AUTO_OPEN_DEPTH = 2;

/** …unless the branch is this wide, in which case it stays a one-line summary. */
const AUTO_OPEN_MAX_ENTRIES = 100;

const isBranch = (value: Json): value is Branch =>
   typeof value === "object" && value !== null;

const entriesOf = (value: Branch): Entry[] =>
   Array.isArray(value)
      ? value.map((item, index) => ({ key: String(index), value: item }))
      : Object.entries(value).map(([key, item]) => ({ key, value: item }));

/** Stops at `limit`: the only questions asked of it are "small?" and "huge?". */
const countNodes = (value: Json, limit: number): number => {
   let seen = 0;
   const walk = (node: Json) => {
      if (!isBranch(node)) return;
      for (const entry of entriesOf(node)) {
         seen += 1;
         if (seen >= limit) return;
         walk(entry.value);
      }
   };
   walk(value);
   return seen;
};

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

/** `JSON.stringify` gives the escaped, quoted form — the one a file shows. */
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

type NodeProps = {
   /** Absent on the root; a muted index inside an array, a key inside an object. */
   label?: string;
   indexed?: boolean;
   value: Json;
   depth: number;
   last: boolean;
   /** Set by the toolbar; `null` leaves each branch to its own default. */
   expandAll: boolean | null;
   small: boolean;
};

const Node = ({
   label,
   indexed = false,
   value,
   depth,
   last,
   expandAll,
   small,
}: NodeProps) => {
   const entries = useMemo(
      () => (isBranch(value) ? entriesOf(value) : []),
      [value]
   );
   const [open, setOpen] = useState(
      () =>
         expandAll ??
         (small ||
            (depth < AUTO_OPEN_DEPTH &&
               entries.length <= AUTO_OPEN_MAX_ENTRIES))
   );

   const key =
      label === undefined ? null : (
         <>
            <span className={indexed ? "text-viewerlighttext" : "text-jsonkey"}>
               {indexed ? label : JSON.stringify(label)}
            </span>
            <Punct>: </Punct>
         </>
      );
   const comma = last ? null : <Punct>,</Punct>;

   if (!isBranch(value))
      return (
         <Row depth={depth}>
            {key}
            <Scalar value={value} />
            {comma}
         </Row>
      );

   const array = Array.isArray(value);
   const [openBracket, closeBracket] = array ? ["[", "]"] : ["{", "}"];

   if (entries.length === 0)
      return (
         <Row depth={depth}>
            {key}
            <Punct>{openBracket + closeBracket}</Punct>
            {comma}
         </Row>
      );

   const toggle = () => setOpen((previous) => !previous);

   if (!open)
      return (
         <Row depth={depth} open={false} onToggle={toggle}>
            {key}
            <Punct>{openBracket}</Punct>
            <span className="px-1 text-viewerlighttext">
               {plural(entries.length, array ? "item" : "key")}
            </span>
            <Punct>{closeBracket}</Punct>
            {comma}
         </Row>
      );

   return (
      <>
         <Row depth={depth} open onToggle={toggle}>
            {key}
            <Punct>{openBracket}</Punct>
         </Row>
         {entries.map((entry, index) => (
            <Node
               key={entry.key}
               label={entry.key}
               indexed={array}
               value={entry.value}
               depth={depth + 1}
               last={index === entries.length - 1}
               expandAll={expandAll}
               small={small}
            />
         ))}
         <Row depth={depth} open onToggle={toggle} chevron={false}>
            <Punct>{closeBracket}</Punct>
            {comma}
         </Row>
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
      <div className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[13px] leading-6">
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

const JsonTree = ({ value, text }: { value: Json; text: string }) => {
   const nodes = useMemo(() => countNodes(value, EXPAND_ALL_LIMIT), [value]);
   const small = nodes < SMALL_DOCUMENT;
   const canExpandAll = nodes < EXPAND_ALL_LIMIT;

   // Remounting the tree is what applies a new default to every branch at once,
   // so the nonce is the whole mechanism behind expand/collapse all.
   const [expandAll, setExpandAll] = useState<boolean | null>(null);
   const [nonce, setNonce] = useState(0);
   const collapsing = expandAll !== false;

   const toggleAll = () => {
      setExpandAll(!collapsing);
      setNonce((previous) => previous + 1);
   };

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
         <Node
            key={nonce}
            value={value}
            depth={0}
            last
            expandAll={expandAll}
            small={small}
         />
      </Panel>
   );
};

/** Valid file, invalid JSON: still worth showing, just without the colours. */
const RawText = ({ text }: { text: string }) => (
   <Panel
      summary="Not valid JSON — showing the raw file"
      actions={<CopyButton text={text} />}
   >
      <pre className="whitespace-pre-wrap break-words px-4 text-viewerblack">
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
