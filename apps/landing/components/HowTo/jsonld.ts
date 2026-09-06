import type { HowToFAQ, HowToStep } from "./how-to-page";

type BuildArgs = {
   slug: string;
   title: string;
   tldr: string;
   siteUrl: string;
   steps: HowToStep[];
   faqs: HowToFAQ[];
   keyword: string;
   datePublished?: string;
   dateModified?: string;
};

const stripJsx = (node: unknown): string => {
   if (typeof node === "string" || typeof node === "number") {
      return String(node);
   }
   if (Array.isArray(node)) {
      return node.map(stripJsx).join(" ");
   }
   if (
      node &&
      typeof node === "object" &&
      "props" in (node as Record<string, unknown>)
   ) {
      const props = (node as { props?: { children?: unknown } }).props;
      return stripJsx(props?.children);
   }
   return "";
};

export const buildHowToJsonLd = ({
   slug,
   title,
   tldr,
   siteUrl,
   steps,
   faqs,
   keyword,
   datePublished,
   dateModified,
}: BuildArgs): Record<string, unknown>[] => {
   const url = `${siteUrl}/how-to/${slug}`;

   const article = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: title,
      description: tldr,
      url,
      mainEntityOfPage: url,
      about: { "@type": "Thing", name: keyword },
      inLanguage: "en",
      author: {
         "@type": "Organization",
         name: "S3 Viewer",
         url: siteUrl,
      },
      publisher: {
         "@type": "Organization",
         name: "S3 Viewer",
         url: siteUrl,
      },
      ...(datePublished && {
         datePublished,
         dateModified: dateModified ?? datePublished,
      }),
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
            name: "How-to",
            item: `${siteUrl}/how-to`,
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
      name: title,
      description: tldr,
      step: steps.map((s, i) => ({
         "@type": "HowToStep",
         position: i + 1,
         name: s.title,
         text: stripJsx(s.body),
         url: `${url}#step-${i + 1}`,
      })),
   };

   const faqPage = {
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
   };

   return [article, breadcrumb, howTo, faqPage];
};
