import Head from "next/head";
import { SITE_URL } from "@/lib/site-config";

const DEFAULT_IMAGE = `${SITE_URL}/landing/bucketview.png`;

export type SeoProps = {
   title: string;
   description: string;
   canonical?: string;
   image?: string;
   imageAlt?: string;
   type?: "website" | "article";
   modifiedTime?: string;
   jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

export default function Seo({
   title,
   description,
   canonical,
   image = DEFAULT_IMAGE,
   imageAlt = "S3 Viewer - Fast, open-source S3 object storage browser",
   type = "website",
   modifiedTime,
   jsonLd,
}: SeoProps) {
   const fullTitle = title.includes("S3 Viewer")
      ? title
      : title + " | S3 Viewer";
   const url = canonical ? `${SITE_URL}${canonical}` : SITE_URL;

   return (
      <Head>
         <title>{fullTitle}</title>
         <meta name="title" content={fullTitle} />
         <meta name="description" content={description} />

         <link rel="canonical" href={url} />

         <meta property="og:type" content={type} />
         <meta property="og:url" content={url} />
         <meta property="og:title" content={fullTitle} />
         <meta property="og:description" content={description} />
         <meta property="og:image" content={image} />
         <meta property="og:image:secure_url" content={image} />
         <meta property="og:image:alt" content={imageAlt} />
         <meta property="og:site_name" content="S3 Viewer" />
         <meta property="og:locale" content="en_US" />
         {modifiedTime && (
            <meta property="article:modified_time" content={modifiedTime} />
         )}

         <meta name="twitter:card" content="summary_large_image" />
         <meta name="twitter:url" content={url} />
         <meta name="twitter:title" content={fullTitle} />
         <meta name="twitter:description" content={description} />
         <meta name="twitter:image" content={image} />
         <meta name="twitter:image:alt" content={imageAlt} />

         {jsonLd && (
            <script
               type="application/ld+json"
               dangerouslySetInnerHTML={{
                  __html: JSON.stringify(jsonLd),
               }}
            />
         )}
      </Head>
   );
}
