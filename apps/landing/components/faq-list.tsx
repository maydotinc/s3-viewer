import type { Faq } from "@/lib/types";
import { ChevronRight } from "lucide-react";

const FaqList = ({ faqs }: { faqs: Faq[] }) => (
   <div className="divide-y divide-viewerborder rounded-xl border border-viewerborder bg-viewerwhite">
      {faqs.map((faq) => (
         <details key={faq.question} className="group p-5 sm:p-6">
            <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
               <h3 className="text-base font-semibold text-viewerblack tracking-tight pr-2">
                  {faq.question}
               </h3>
               <ChevronRight
                  className="size-4 flex-none text-viewertext transition-transform group-open:rotate-90 motion-reduce:transition-none"
                  aria-hidden
               />
            </summary>
            <div className="mt-3 text-sm text-viewertext leading-relaxed pr-4">
               {faq.answer}
            </div>
         </details>
      ))}
   </div>
);

export default FaqList;
