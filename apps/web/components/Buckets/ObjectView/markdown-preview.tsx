import { pluralize } from "@/lib/utils/format";
import { useMemo } from "react";
import { MarkdownContent } from "./markdown";
import {
   BodyPreview,
   type BodyPreviewProps,
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

const MarkdownPreview = (props: BodyPreviewProps) => (
   <BodyPreview {...props} label="Markdown">
      {(body) => (
         <RenderedBody {...body} label="Markdown">
            <MarkdownBody text={body.text} />
         </RenderedBody>
      )}
   </BodyPreview>
);

export default MarkdownPreview;
