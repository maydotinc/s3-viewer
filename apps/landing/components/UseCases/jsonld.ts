import type { UseCaseFAQ, UseCaseStep } from "./use-case-page";

type BuildArgs = {
   slug: string;
   title: string;
   description: string;
   siteUrl: string;
   steps: UseCaseStep[];
   faqs?: UseCaseFAQ[];
   keyword: string;
};

export const buildUseCaseJsonLd = ({
   slug,
   title,
   description,
   siteUrl,
   steps,
   faqs,
   keyword,
}: BuildArgs): Record<string, unknown>[] => {
   const url = `${siteUrl}/use-cases/${slug}`;

   const webPage = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      url,
      description,
      isPartOf: {
         "@type": "WebSite",
         name: "S3 Viewer",
         url: siteUrl,
      },
      about: {
         "@type": "Thing",
         name: keyword,
      },
   };

   const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
         {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteUrl,
         },
         {
            "@type": "ListItem",
            position: 2,
            name: "Use Cases",
            item: `${siteUrl}/use-cases`,
         },
         {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: url,
         },
      ],
   };

   const howTo = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `Connect S3 Viewer for ${keyword}`,
      description,
      step: steps.map((s, i) => ({
         "@type": "HowToStep",
         position: i + 1,
         name: s.title,
         text: s.body,
         url: `${url}#step-${i + 1}`,
      })),
   };

   const out: Record<string, unknown>[] = [webPage, breadcrumb, howTo];

   if (faqs && faqs.length > 0) {
      out.push({
         "@context": "https://schema.org",
         "@type": "FAQPage",
         mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
               "@type": "Answer",
               text: f.answer,
            },
         })),
      });
   }

   return out;
};
