import BasicBlock, {
   Eyebrow,
   PageTitle,
   SectionTitle,
} from "@/components/basic-block";
import CtaButtons from "@/components/cta-buttons";
import { getRelatedHowTos } from "@/components/HowTo/data";
import IconCard from "@/components/icon-card";
import PageHero from "@/components/page-hero";
import {
   FaqSection,
   HeroGrid,
   SplitSection,
   StepList,
} from "@/components/page-sections";
import RelatedLinks from "@/components/related-links";
import Seo from "@/components/seo";
import { pickBySlug } from "@/lib/every-slug";
import type { LinkRef } from "@/lib/link-ref";
import type { Faq } from "@/lib/types";
import type { HowToSlug, UseCaseSlug } from "@s3-viewer/types";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Check } from "lucide-react";
import type { NextPage } from "next";
import type { ReactNode } from "react";
import { USE_CASES, getRelatedUseCases } from "./data";
import { buildUseCaseJsonLd } from "./jsonld";
import type { UseCaseFeature, UseCaseStep } from "./types";

export type { UseCaseStep } from "./types";

type UseCasePageProps = {
   eyebrow: string;
   title: string;
   description: string;
   headline: string;
   bullets: string[];
   visual: ReactNode;
   features: UseCaseFeature[];
   steps: UseCaseStep[];
   faqs: Faq[];
   relatedHowTos: LinkRef[];
   related: LinkRef[];
};

const UseCasePage = ({
   eyebrow,
   title,
   description,
   headline,
   bullets,
   visual,
   features,
   steps,
   faqs,
   relatedHowTos,
   related,
}: UseCasePageProps) => {
   return (
      <main className="w-full overflow-x-clip">
         <PageHero
            trail={[{ label: "Use cases", href: "/use-cases" }]}
            current={eyebrow}
         >
            <HeroGrid aside={visual}>
               <PageTitle>{title}</PageTitle>
               <p className="text-lg text-viewertext max-w-[600px]">
                  {description}
               </p>
               <ul className="flex flex-col gap-2 mt-2">
                  {bullets.map((b) => (
                     <li
                        key={b}
                        className="flex items-start gap-2.5 text-sm text-viewerblack"
                     >
                        <span className="mt-0.5 grid shrink-0 place-items-center size-4 rounded-full bg-viewerblue/10 text-viewerblue">
                           <Check className="size-2.5" strokeWidth={3} />
                        </span>
                        {b}
                     </li>
                  ))}
               </ul>
               <CtaButtons chevron className="mt-2" />
            </HeroGrid>
         </PageHero>

         <BasicBlock sectionClassName="bg-viewergray">
            <div className="flex flex-col gap-3 mb-10 max-w-[680px]">
               <Eyebrow>Why teams pick S3 Viewer</Eyebrow>
               <SectionTitle>{headline}</SectionTitle>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {features.map((f) => (
                  <IconCard
                     key={f.title}
                     icon={f.icon}
                     title={f.title}
                     className="gap-3 hover:border-viewerblue/30 transition-colors"
                  >
                     {f.body}
                  </IconCard>
               ))}
            </div>
         </BasicBlock>

         <BasicBlock sectionClassName="border-t border-viewerborder">
            <SplitSection
               eyebrow="How it works"
               title="Three steps to your bucket."
               intro="No agents to install, no infrastructure to manage. Paste credentials and you're browsing."
               className="gap-12"
            >
               <StepList steps={steps} />
            </SplitSection>
         </BasicBlock>

         <FaqSection
            faqs={faqs}
            sectionClassName="bg-viewergray"
            intro="Direct answers we wish we'd had when picking a viewer."
         />

         {relatedHowTos.length > 0 && (
            <BasicBlock sectionClassName="border-t border-viewerborder">
               <RelatedLinks
                  eyebrow="Related guides"
                  heading={<SectionTitle>Step-by-step how-tos.</SectionTitle>}
                  all={{ href: "/how-to", label: "All guides" }}
                  links={relatedHowTos}
                  cardTitleClassName="text-sm"
               />
            </BasicBlock>
         )}

         <BasicBlock
            sectionClassName={cn(
               "border-t border-viewerborder",
               relatedHowTos.length > 0 && "bg-viewergray"
            )}
         >
            <RelatedLinks
               eyebrow="Keep exploring"
               heading={<SectionTitle>Other use cases</SectionTitle>}
               all={{ href: "/use-cases", label: "All use cases" }}
               links={related}
            />
         </BasicBlock>
      </main>
   );
};

type CreateUseCasePageConfig = Omit<
   UseCasePageProps,
   "relatedHowTos" | "related"
> & {
   slug: UseCaseSlug;
   seoTitle: string;
   seoDescription: string;
   relatedHowTos: HowToSlug[];
};

export const createUseCasePage = ({
   slug,
   seoTitle,
   seoDescription,
   relatedHowTos,
   ...props
}: CreateUseCasePageConfig): NextPage => {
   const entry = pickBySlug(USE_CASES, slug);
   const howToRefs = getRelatedHowTos(relatedHowTos);
   const related = getRelatedUseCases(slug);
   const jsonLd = buildUseCaseJsonLd({
      slug,
      title: seoTitle,
      eyebrow: props.eyebrow,
      description: props.description,
      steps: props.steps,
      faqs: props.faqs,
      keyword: entry.keyword,
   });

   const Page: NextPage = () => (
      <>
         <Seo
            title={seoTitle}
            description={seoDescription}
            canonical={`/use-cases/${slug}`}
            jsonLd={jsonLd}
         />
         <UseCasePage {...props} relatedHowTos={howToRefs} related={related} />
      </>
   );

   return Page;
};
