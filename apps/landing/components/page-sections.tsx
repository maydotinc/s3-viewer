import BasicBlock, { Eyebrow, SectionTitle } from "@/components/basic-block";
import CtaButtons, { type CtaButtonsProps } from "@/components/cta-buttons";
import FaqList from "@/components/faq-list";
import { stepId } from "@/lib/jsonld";
import type { Faq } from "@/lib/types";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ReactNode } from "react";

export const PROSE_LITE =
   "[&_strong]:text-viewerblack [&_strong]:font-semibold [&_code]:bg-viewergray [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-viewerblack";

export const HeroGrid = ({
   children,
   aside,
   className,
   mainClassName,
}: {
   children: ReactNode;
   aside: ReactNode;
   className?: string;
   mainClassName?: string;
}) => (
   <div
      className={cn(
         "grid grid-cols-1 lg:grid-cols-12 gap-12 items-center",
         className
      )}
   >
      <div
         className={cn(
            "lg:col-span-7 min-w-0 flex flex-col gap-6",
            mainClassName
         )}
      >
         {children}
      </div>
      <div className="lg:col-span-5 w-full">{aside}</div>
   </div>
);

export const SplitSection = ({
   eyebrow,
   title,
   intro,
   className,
   children,
}: {
   eyebrow: string;
   title: ReactNode;
   intro?: ReactNode;
   className?: string;
   children: ReactNode;
}) => (
   <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-10", className)}>
      <div className="lg:col-span-4 flex flex-col gap-3">
         <Eyebrow>{eyebrow}</Eyebrow>
         <SectionTitle>{title}</SectionTitle>
         {intro && (
            <p className="text-sm text-viewertext max-w-[380px]">{intro}</p>
         )}
      </div>
      <div className="lg:col-span-8 min-w-0">{children}</div>
   </div>
);

type Step = { title: string; body: ReactNode; code?: string };

export const StepList = ({ steps }: { steps: Step[] }) => (
   <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
         <li
            key={step.title}
            id={stepId(i)}
            className="flex flex-col gap-3 rounded-xl border border-viewerborder bg-viewerwhite p-5 sm:p-6"
         >
            <div className="flex items-start gap-5">
               <span className="flex-none grid place-items-center size-9 rounded-full border border-viewerborder bg-viewergray text-sm font-semibold text-viewerblue">
                  {String(i + 1).padStart(2, "0")}
               </span>
               <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-viewerblack tracking-tight">
                     {step.title}
                  </h3>
                  <div
                     className={cn(
                        "text-sm text-viewertext leading-relaxed",
                        PROSE_LITE
                     )}
                  >
                     {step.body}
                  </div>
               </div>
            </div>
            {step.code && (
               <pre
                  tabIndex={0}
                  role="region"
                  aria-label={`Code for step ${i + 1}`}
                  className={cn(
                     "min-w-0 max-w-full sm:ml-14 overflow-x-auto rounded-md border border-viewerborder bg-viewergray px-4 py-3 text-xs leading-relaxed font-mono text-viewerblack outline-none",
                     FOCUS_RING
                  )}
               >
                  <code>{step.code}</code>
               </pre>
            )}
         </li>
      ))}
   </ol>
);

export const FaqSection = ({
   faqs,
   intro,
   sectionClassName,
}: {
   faqs: Faq[];
   intro?: ReactNode;
   sectionClassName?: string;
}) => (
   <BasicBlock
      sectionClassName={cn("border-t border-viewerborder", sectionClassName)}
   >
      <SplitSection eyebrow="FAQ" title="Common questions." intro={intro}>
         <FaqList faqs={faqs} />
      </SplitSection>
   </BasicBlock>
);

export const CtaBand = ({
   eyebrow,
   title,
   text,
   sectionClassName,
   ...cta
}: CtaButtonsProps & {
   eyebrow: string;
   title: ReactNode;
   text: ReactNode;
   sectionClassName?: string;
}) => (
   <BasicBlock
      sectionClassName={cn("border-t border-viewerborder", sectionClassName)}
   >
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
         <div className="flex flex-col gap-4">
            <Eyebrow>{eyebrow}</Eyebrow>
            <SectionTitle>{title}</SectionTitle>
            <p className="text-viewertext max-w-[540px]">{text}</p>
         </div>
         <CtaButtons {...cta} className="lg:justify-end" />
      </div>
   </BasicBlock>
);
