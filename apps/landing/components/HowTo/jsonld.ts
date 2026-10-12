import {
   aboutThing,
   guideGraph,
   howToNode,
   organizationRef,
   personRef,
   websiteRef,
} from "@/lib/jsonld";
import { OG_IMAGE_URL, SITE_URL } from "@/lib/site-config";
import { stripJsx } from "@/lib/strip-jsx";
import { founder } from "@/lib/team";
import type { Faq } from "@/lib/types";
import type { HowToSlug } from "@s3-viewer/types";
import type { HowToStep } from "./types";

type BuildArgs = {
   slug: HowToSlug;
   title: string;
   tldr: string;
   steps: HowToStep[];
   faqs: Faq[];
   keyword: string;
   datePublished: string;
};

export const buildHowToJsonLd = ({
   slug,
   title,
   tldr,
   steps,
   faqs,
   keyword,
   datePublished,
}: BuildArgs) => {
   const url = `${SITE_URL}/how-to/${slug}`;

   return guideGraph({
      main: {
         "@type": "TechArticle",
         headline: title,
         description: tldr,
         url,
         mainEntityOfPage: url,
         image: OG_IMAGE_URL,
         about: aboutThing(keyword),
         inLanguage: "en",
         isPartOf: websiteRef,
         // guides carry a human byline; the company publishes and owns them.
         author: personRef(founder),
         publisher: organizationRef,
         copyrightHolder: organizationRef,
         datePublished,
         dateModified: datePublished,
      },
      section: { name: "How-to", path: "/how-to" },
      name: title,
      url,
      howTo: howToNode({
         name: title,
         description: tldr,
         url,
         image: OG_IMAGE_URL,
         steps: steps.map((s) => ({
            name: s.title,
            text: stripJsx(s.body).replace(/\s+/g, " ").trim(),
         })),
      }),
      faqs,
   });
};
