import { MARKDOWN_RENDER_BYTES } from "@/lib/utils/file-utils";
import { formatBytes, pluralize } from "@/lib/utils/format";
import { utf8ByteLength } from "@s3-viewer/shared";
import { useMemo } from "react";
import { MarkdownContent } from "./markdown";
import {
   BodyPreview,
   type BodyPreviewProps,
   type LoadedBody,
   RawText,
   RenderedBody,
   ViewPanel,
} from "./preview-panel";

// runs of letters or digits, so list markers, fences and table rules don't count
const countWords = (text: string): number =>
   text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

const MarkdownBody = ({ text }: { text: string }) => {
   const words = useMemo(() => countWords(text), [text]);
   return (
      <ViewPanel text={text} summary={pluralize(words, "word")} mono={false}>
         <div className="min-h-0 flex-1 overflow-auto">
            <article className="markdown-body px-6 py-5">
               <MarkdownContent text={text} />
            </article>
         </div>
      </ViewPanel>
   );
};

const LoadedMarkdown = (body: LoadedBody) => {
   const bytes = useMemo(() => utf8ByteLength(body.text), [body.text]);
   return bytes > MARKDOWN_RENDER_BYTES ? (
      <RawText
         text={body.text}
         summary={`Markdown over ${formatBytes(MARKDOWN_RENDER_BYTES)} — showing the raw file`}
      />
   ) : (
      <RenderedBody {...body} label="Markdown">
         <MarkdownBody text={body.text} />
      </RenderedBody>
   );
};

const MarkdownPreview = (props: BodyPreviewProps) => (
   <BodyPreview {...props} label="Markdown">
      {(body) => <LoadedMarkdown {...body} />}
   </BodyPreview>
);

export default MarkdownPreview;
