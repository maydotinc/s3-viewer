import BasicBlock, { Eyebrow, PageTitle } from "@/components/basic-block";
import { ExternalLink } from "@/components/external-link";
import PageHero from "@/components/page-hero";
import {
   CtaBand,
   FaqSection,
   HeroGrid,
   PROSE_LITE,
   SplitSection,
   StepList,
} from "@/components/page-sections";
import RelatedLinks from "@/components/related-links";
import Seo from "@/components/seo";
import { getUseCaseRefs } from "@/components/UseCases/data";
import { pickBySlug } from "@/lib/every-slug";
import { formatDate } from "@/lib/format-date";
import type { LinkRef } from "@/lib/link-ref";
import { MAY_NAME } from "@/lib/site-config";
import { founder } from "@/lib/team";
import type { Faq } from "@/lib/types";
import type { HowToSlug, UseCaseSlug } from "@s3-viewer/shared";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Lightbulb } from "lucide-react";
import type { NextPage } from "next";
import type { ReactNode } from "react";
import { HOW_TOS, getRelatedHowTos } from "./data";
import { buildHowToJsonLd } from "./jsonld";
import type { HowToStep } from "./types";

export type { HowToStep } from "./types";

type HowToPageProps = {
   title: string;
   tldr: string;
   published: string;
   visual: ReactNode;
   steps: HowToStep[];
   underTheHood: ReactNode;
   faqs: Faq[];
   useCases: LinkRef[];
   related: LinkRef[];
};

// mirrors the TechArticle author and datePublished in the JSON-LD.
const Byline = ({ published }: { published: string }) => (
   <p className="flex flex-wrap items-center gap-x-2 text-sm text-viewerlighttext">
      <span>
         By{" "}
         <ExternalLink
            href={founder.profileUrl}
            rel="noopener noreferrer author"
            className="font-medium text-viewerblack hover:underline underline-offset-2"
         >
            {founder.name}
         </ExternalLink>
         , {MAY_NAME}
      </span>
      <span aria-hidden="true">·</span>
      <time dateTime={published}>{formatDate(published)}</time>
   </p>
);

const CompactHeading = ({ children }: { children: ReactNode }) => (
   <h2 className="text-xl font-semibold tracking-tight text-viewerblack">
      {children}
   </h2>
);

const HowToPage = ({
   title,
   tldr,
   published,
   visual,
   steps,
   underTheHood,
   faqs,
   useCases,
   related,
}: HowToPageProps) => {
   return (
      <main className="w-full overflow-x-clip">
         <PageHero
            trail={[{ label: "How-to", href: "/how-to" }]}
            current={title}
            currentClassName="min-w-0 truncate"
         >
            <HeroGrid
               aside={visual}
               className="gap-10 lg:gap-12"
               mainClassName="gap-5"
            >
               <PageTitle>{title}</PageTitle>
               <Byline published={published} />
               <div className="flex items-start gap-3 rounded-xl border border-viewerborder bg-viewerwhite p-4 sm:p-5">
                  <span className="hidden place-items-center size-8 rounded-md bg-viewerblue/10 text-viewerblue flex-none sm:grid">
                     <Lightbulb className="size-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex flex-col gap-1">
                     <Eyebrow>TL;DR</Eyebrow>
                     <p className="text-sm leading-normal text-viewerblack sm:text-base sm:leading-relaxed">
                        {tldr}
                     </p>
                  </div>
               </div>
            </HeroGrid>
         </PageHero>

         <BasicBlock sectionClassName="bg-viewergray">
            <SplitSection eyebrow="Steps" title="Step-by-step.">
               <StepList steps={steps} />
            </SplitSection>
         </BasicBlock>

         <BasicBlock sectionClassName="border-t border-viewerborder">
            <SplitSection
               eyebrow="Under the hood"
               title="What's actually happening."
            >
               <div
                  className={cn(
                     "rounded-xl border border-viewerborder bg-viewerwhite p-6 sm:p-8 text-sm text-viewertext leading-relaxed [&_p+p]:mt-4",
                     PROSE_LITE
                  )}
               >
                  {underTheHood}
               </div>
            </SplitSection>
         </BasicBlock>

         <FaqSection faqs={faqs} sectionClassName="bg-viewergray" />

         <CtaBand
            eyebrow="Use S3 Viewer for this"
            title="Skip the CLI. Try it in the browser."
            text="S3 Viewer turns the steps above into a single click. Open source, self-hostable, free."
            chevron
         />

         {(useCases.length > 0 || related.length > 0) && (
            <BasicBlock
               sectionClassName="border-t border-viewerborder bg-viewergray"
               className="grid grid-cols-1 lg:grid-cols-2 gap-12"
            >
               {useCases.length > 0 && (
                  <RelatedLinks
                     compact
                     eyebrow="Use case"
                     heading={
                        <CompactHeading>Why teams pick this</CompactHeading>
                     }
                     links={useCases}
                     cardTitleClassName="text-sm"
                  />
               )}
               {related.length > 0 && (
                  <RelatedLinks
                     compact
                     eyebrow="Related guides"
                     heading={<CompactHeading>More how-tos</CompactHeading>}
                     all={{ href: "/how-to", label: "All" }}
                     links={related}
                     cardTitleClassName="text-sm"
                  />
               )}
            </BasicBlock>
         )}
      </main>
   );
};

type CreateHowToPageConfig = Omit<
   HowToPageProps,
   "title" | "useCases" | "related"
> & {
   slug: HowToSlug;
   heading?: string;
   seoTitle: string;
   seoDescription: string;
   useCases: UseCaseSlug[];
   related: HowToSlug[];
   updated?: string;
};

export const createHowToPage = ({
   slug,
   heading,
   seoTitle,
   seoDescription,
   useCases,
   related,
   updated,
   ...props
}: CreateHowToPageConfig): NextPage => {
   const entry = pickBySlug(HOW_TOS, slug);
   const title = heading ?? entry.title;
   const useCaseRefs = getUseCaseRefs(useCases);
   const relatedRefs = getRelatedHowTos(related);
   const jsonLd = buildHowToJsonLd({
      slug,
      title,
      tldr: props.tldr,
      steps: props.steps,
      faqs: props.faqs,
      keyword: entry.keyword,
      datePublished: props.published,
      dateModified: updated ?? props.published,
   });

   const Page: NextPage = () => (
      <>
         <Seo
            title={seoTitle}
            description={seoDescription}
            canonical={`/how-to/${slug}`}
            type="article"
            publishedTime={props.published}
            modifiedTime={updated ?? props.published}
            jsonLd={jsonLd}
         />
         <HowToPage
            {...props}
            title={title}
            useCases={useCaseRefs}
            related={relatedRefs}
         />
      </>
   );

   return Page;
};
