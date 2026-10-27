import { useBucketContext } from "@/components/Buckets/Context";
import useObjectBody, {
   ObjectBodyError,
} from "@/lib/hooks/queries/s3/useObjectBody";
import {
   MAX_BODY_PREVIEW_BYTES,
   RAW_TEXT_PREVIEW_CHARS,
} from "@/lib/utils/file-utils";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { formatBytes, formatCount } from "@/lib/utils/format";
import { previewBodyVersion } from "@/lib/utils/s3/preview-body";
import type { S3ObjectPreview } from "@s3-viewer/shared";
import { Button } from "@s3-viewer/ui/components/button";
import { TabButton, TabList } from "@s3-viewer/ui/components/tabs";
import { cn } from "@s3-viewer/ui/lib/utils";
import ErrorBoundary from "@s3-viewer/ui/error-boundary";
import { Copy, FileWarning } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PREVIEW_PANEL, PreviewLoading, TextFrame } from "./preview-frame";
import { PreviewMessage } from "./preview-message";

const Panel = ({
   summary,
   actions,
   mono = true,
   children,
}: {
   summary: string;
   actions?: ReactNode;
   mono?: boolean;
   children: ReactNode;
}) => (
   <div className={PREVIEW_PANEL}>
      <div className="@container flex h-11 shrink-0 items-center gap-2 border-b border-viewerborder bg-viewergray/60 px-4 pointer-coarse:h-14">
         <span className="truncate text-[13px] text-viewertext tabular-nums">
            {summary}
         </span>
         <div className="ml-auto flex shrink-0 items-center gap-1">
            {actions}
         </div>
      </div>
      <div
         className={cn(
            "flex min-h-0 flex-1 flex-col",
            mono && "font-mono text-[13px] leading-6"
         )}
      >
         {children}
      </div>
   </div>
);

// a narrow header (phones, the 1024px laptop column) keeps the text actions as icons so the tabs and copy still fit
const COMPACT_ACTION =
   "@max-[22rem]:w-8 @max-[22rem]:px-0 @max-[22rem]:pointer-coarse:w-11";
const COMPACT_LABEL = "@max-[22rem]:sr-only";

type ViewMode = "preview" | "source";

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
   { mode: "preview", label: "Preview" },
   { mode: "source", label: "Source" },
];

const ViewTabs = ({
   mode,
   onChange,
}: {
   mode: ViewMode;
   onChange: (mode: ViewMode) => void;
}) => (
   <TabList aria-label="View as">
      {VIEW_MODES.map((entry) => (
         <TabButton
            key={entry.mode}
            active={mode === entry.mode}
            onClick={() => onChange(entry.mode)}
         >
            {entry.label}
         </TabButton>
      ))}
   </TabList>
);

const CopyButton = ({ text }: { text: string }) => (
   <Button
      variant="ghost"
      size="sm"
      className={COMPACT_ACTION}
      onClick={() =>
         void copyToClipboard(text, {
            success: "Copied to clipboard.",
            failure: "Couldn't copy the file",
         })
      }
   >
      <Copy aria-hidden="true" />
      <span className={COMPACT_LABEL}>Copy</span>
   </Button>
);

const RawTextBody = ({ text }: { text: string }) => {
   const clipped = text.length > RAW_TEXT_PREVIEW_CHARS;
   return (
      <div className="min-h-0 flex-1 overflow-auto">
         <pre className="whitespace-pre-wrap break-words px-4 py-2 text-viewerblack">
            {clipped ? text.slice(0, RAW_TEXT_PREVIEW_CHARS) : text}
         </pre>
         {clipped && (
            <p className="border-t border-viewerborder px-4 py-2 text-viewerlighttext">
               Showing the first {formatCount(RAW_TEXT_PREVIEW_CHARS)}{" "}
               characters — download to view the rest.
            </p>
         )}
      </div>
   );
};

const RawText = ({ text, summary }: { text: string; summary: string }) => (
   <Panel summary={summary} actions={<CopyButton text={text} />}>
      <RawTextBody text={text} />
   </Panel>
);

const ViewPanel = ({
   text,
   summary,
   mono = true,
   actions,
   children,
}: {
   text: string;
   summary: string;
   mono?: boolean;
   actions?: ReactNode;
   children: ReactNode;
}) => {
   const [mode, setMode] = useState<ViewMode>("preview");
   const source = mode === "source";
   return (
      <Panel
         summary={summary}
         mono={mono || source}
         actions={
            <>
               <ViewTabs mode={mode} onChange={setMode} />
               {!source && actions}
               <CopyButton text={text} />
            </>
         }
      >
         {source ? <RawTextBody text={text} /> : children}
      </Panel>
   );
};

type BodyPreviewProps = {
   preview: S3ObjectPreview;
   objectKey: string;
   fileName: string;
   fallbackUrl?: string;
   fallbackGeneration?: number;
};

type LoadedBody = {
   text: string;
   // changes whenever the text may differ, so error boundaries keyed on it retry a fresh render
   version: string;
};

// a renderer that throws on this text falls back to the raw file until the text may have changed
const RenderedBody = ({
   text,
   version,
   label,
   children,
}: LoadedBody & { label: string; children: ReactNode }) => (
   <ErrorBoundary
      key={version}
      fallback={
         <RawText
            text={text}
            summary={`Couldn't render this ${label} — showing the raw file`}
         />
      }
   >
      {children}
   </ErrorBoundary>
);

// reads the object into memory for previews that need the text itself, falling back to the browser's own rendering of the url
const BodyPreview = ({
   preview,
   objectKey,
   fileName,
   fallbackUrl,
   fallbackGeneration,
   label,
   children,
}: BodyPreviewProps & {
   label: string;
   children: (body: LoadedBody) => ReactNode;
}) => {
   const { bucketName } = useBucketContext();
   const readable = preview.contentLength <= MAX_BODY_PREVIEW_BYTES;
   const { data, isPending, isError, error } = useObjectBody(
      bucketName,
      objectKey,
      preview,
      readable
   );

   const fallback =
      error instanceof ObjectBodyError && error.changed
         ? { title: "This file has changed", text: error.message }
         : !readable || (error instanceof ObjectBodyError && error.tooLarge)
           ? {
                title: "Too large to preview",
                text: `${label} previews stop at ${formatBytes(MAX_BODY_PREVIEW_BYTES)}. Download it to view.`,
             }
           : null;
   if (fallback)
      return (
         <PreviewMessage
            icon={FileWarning}
            title={fallback.title}
            text={fallback.text}
            objectKey={objectKey}
         />
      );
   if (isPending) return <PreviewLoading />;
   if (isError || data === undefined)
      return (
         <TextFrame
            key={fallbackGeneration}
            url={fallbackUrl ?? preview.url}
            fileName={fileName}
         />
      );
   return children({
      text: data,
      version: JSON.stringify([
         bucketName,
         objectKey,
         previewBodyVersion(preview),
      ]),
   });
};

export {
   BodyPreview,
   COMPACT_ACTION,
   COMPACT_LABEL,
   RawText,
   RenderedBody,
   ViewPanel,
};
export type { BodyPreviewProps, LoadedBody };
