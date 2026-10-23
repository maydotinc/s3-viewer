import Seo from "@/components/seo";
import { formatDate } from "@/lib/format-date";
import { legalJsonLd } from "@/lib/jsonld";
import type { NextPage } from "next";
import type { LegalContentItemProps } from "./content";
import LegalLayout from "./legal-layout";

export type LegalPageData = {
   title: string;
   description: string;
   effectiveDate: string;
   lastUpdated: string;
   sections: LegalContentItemProps[];
};

type CreateLegalPageConfig = {
   slug: "privacy-policy" | "terms-of-service";
   seoDescription: string;
   data: LegalPageData;
};

export const createLegalPage = ({
   slug,
   seoDescription,
   data,
}: CreateLegalPageConfig): NextPage => {
   const jsonLd = legalJsonLd(data.title, slug);

   const Page: NextPage = () => (
      <>
         <Seo
            title={data.title}
            description={seoDescription}
            canonical={`/legal/${slug}`}
            type="article"
            modifiedTime={new Date(data.lastUpdated).toISOString()}
            jsonLd={jsonLd}
         />
         <LegalLayout
            title={data.title}
            description={data.description}
            effectiveDate={formatDate(data.effectiveDate, "long")}
            lastUpdated={formatDate(data.lastUpdated, "long")}
            content={data.sections}
         />
      </>
   );

   return Page;
};
