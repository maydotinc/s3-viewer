import { aboutThing, guideGraph, howToNode, webPageNode } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/site-config";
import { siteTitle } from "@/lib/site-title";
import type { Faq } from "@/lib/types";
import type { UseCaseSlug } from "@s3-viewer/shared";
import type { UseCaseStep } from "./types";

type BuildArgs = {
   slug: UseCaseSlug;
   title: string;
   eyebrow: string;
   description: string;
   steps: UseCaseStep[];
   faqs: Faq[];
   keyword: string;
};

export const buildUseCaseJsonLd = ({
   slug,
   title,
   eyebrow,
   description,
   steps,
   faqs,
   keyword,
}: BuildArgs) => {
   const path = `/use-cases/${slug}`;
   const url = `${SITE_URL}${path}`;
   const name = siteTitle(title);

   return guideGraph({
      main: {
         ...webPageNode({ name, path, description }),
         headline: name,
         about: aboutThing(keyword),
      },
      section: { name: "Use cases", path: "/use-cases" },
      name: eyebrow,
      url,
      howTo: howToNode({
         name: `Connect S3 Viewer for ${keyword}`,
         description,
         url,
         steps: steps.map((s) => ({ name: s.title, text: s.body })),
      }),
      faqs,
   });
};
