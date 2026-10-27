import Head from "next/head";
import type { JsonLdNode } from "@/lib/jsonld";
import { MAY_NAME, OG_IMAGE_URL, SITE_URL } from "@/lib/site-config";
import { siteTitle } from "@/lib/site-title";
import { PRODUCT_NAME } from "@s3-viewer/shared/constants";

type SeoProps = {
   title: string;
   description: string;
   canonical: string;
   imageAlt?: string;
   type?: "website" | "article";
   publishedTime?: string;
   modifiedTime?: string;
   jsonLd?: JsonLdNode;
};

export default function Seo({
   title,
   description,
   canonical,
   imageAlt = `${PRODUCT_NAME} - Fast, open-source S3 object storage browser`,
   type = "website",
   publishedTime,
   modifiedTime,
   jsonLd,
}: SeoProps) {
   const fullTitle = siteTitle(title);
   const url = `${SITE_URL}${canonical}`;

   return (
      <Head>
         <title>{fullTitle}</title>
         <meta name="description" content={description} />
         <meta name="author" content={MAY_NAME} />

         <link rel="canonical" href={url} />

         <meta property="og:type" content={type} />
         <meta property="og:url" content={url} />
         <meta property="og:title" content={fullTitle} />
         <meta property="og:description" content={description} />
         <meta property="og:image" content={OG_IMAGE_URL} />
         <meta property="og:image:alt" content={imageAlt} />
         <meta property="og:site_name" content={PRODUCT_NAME} />
         <meta property="og:locale" content="en_US" />
         {publishedTime && (
            <meta property="article:published_time" content={publishedTime} />
         )}
         {modifiedTime && (
            <meta property="article:modified_time" content={modifiedTime} />
         )}

         <meta name="twitter:card" content="summary_large_image" />
         <meta name="twitter:title" content={fullTitle} />
         <meta name="twitter:description" content={description} />
         <meta name="twitter:image" content={OG_IMAGE_URL} />
         <meta name="twitter:image:alt" content={imageAlt} />

         {jsonLd && (
            <script
               type="application/ld+json"
               dangerouslySetInnerHTML={{
                  __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
               }}
            />
         )}
      </Head>
   );
}
