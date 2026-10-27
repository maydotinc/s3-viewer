import { cn } from "@s3-viewer/ui/lib/utils";
import OnThisPage from "@/components/on-this-page";
import { useMemo } from "react";
import type { ReactNode } from "react";
import BasicBlock, { Eyebrow } from "@/components/basic-block";

export type LegalContentItemProps = {
   title: string;
   content: ReactNode;
};

const slugify = (s: string) =>
   s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

const LegalContent = ({ content }: { content: LegalContentItemProps[] }) => {
   const items = useMemo(
      () => content.map((s) => ({ id: slugify(s.title), title: s.title })),
      [content]
   );

   return (
      <BasicBlock sectionClassName="bg-viewergray">
         <div className="grid lg:grid-cols-[240px_1fr] gap-10 lg:gap-16">
            <OnThisPage items={items} />

            <div className="flex flex-col max-w-[70ch] min-w-0">
               {content.map((section, i) => {
                  const slug = items[i]?.id;
                  return (
                     <section
                        key={slug}
                        id={slug}
                        className="py-8 first:pt-0 last:pb-0 border-b border-viewerborder last:border-b-0"
                     >
                        <Eyebrow>
                           Section {String(i + 1).padStart(2, "0")}
                        </Eyebrow>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-viewerblack">
                           {section.title}
                        </h2>
                        <div
                           className={cn(
                              "mt-5 text-base leading-relaxed text-viewertext",
                              "[&_p]:m-0 [&_p+p]:mt-4",
                              "[&_strong]:font-semibold [&_strong]:text-viewerblack",
                              "[&_a]:text-viewerblue [&_a]:font-medium [&_a]:underline [&_a]:decoration-viewerblue/30 [&_a]:underline-offset-[3px] [&_a:hover]:decoration-viewerblue",
                              "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5"
                           )}
                        >
                           {typeof section.content === "string" ? (
                              <p>{section.content}</p>
                           ) : (
                              section.content
                           )}
                        </div>
                     </section>
                  );
               })}
            </div>
         </div>
      </BasicBlock>
   );
};

export default LegalContent;
