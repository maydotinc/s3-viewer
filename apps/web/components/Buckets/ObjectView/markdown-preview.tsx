import { pluralize } from "@/lib/utils/format";
import { TabButton, TabList } from "@s3-viewer/ui/components/tabs";
import ErrorBoundary from "@s3-viewer/ui/error-boundary";
import { useMemo, useState } from "react";
import { MarkdownContent } from "./markdown";
import {
   BodyPreview,
   type BodyPreviewProps,
   CopyButton,
   Panel,
   RawText,
   RawTextBody,
} from "./preview-panel";

type Mode = "preview" | "source";

// runs of letters or digits, so list markers, fences and table rules don't count
const countWords = (text: string): number =>
   text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

const MarkdownBody = ({ text }: { text: string }) => {
   const [mode, setMode] = useState<Mode>("preview");
   const words = useMemo(() => countWords(text), [text]);
   return (
      <Panel
         summary={pluralize(words, "word")}
         mono={mode === "source"}
         actions={
            <>
               <TabList aria-label="Markdown view">
                  <TabButton
                     active={mode === "preview"}
                     onClick={() => setMode("preview")}
                  >
                     Preview
                  </TabButton>
                  <TabButton
                     active={mode === "source"}
                     onClick={() => setMode("source")}
                  >
                     Source
                  </TabButton>
               </TabList>
               <CopyButton text={text} />
            </>
         }
      >
         {mode === "preview" ? (
            <div className="min-h-0 flex-1 overflow-auto">
               <article className="markdown-body px-6 py-5">
                  <MarkdownContent text={text} />
               </article>
            </div>
         ) : (
            <RawTextBody text={text} />
         )}
      </Panel>
   );
};

const MarkdownPreview = (props: BodyPreviewProps) => (
   <BodyPreview {...props} label="Markdown">
      {({ text, version }) => (
         <ErrorBoundary
            key={version}
            fallback={
               <RawText
                  text={text}
                  summary="Couldn't render this Markdown — showing the raw file"
               />
            }
         >
            <MarkdownBody text={text} />
         </ErrorBoundary>
      )}
   </BodyPreview>
);

export default MarkdownPreview;
