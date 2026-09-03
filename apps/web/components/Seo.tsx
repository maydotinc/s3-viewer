import { publicEnv } from "@/lib/env";
import { PRODUCT_NAME } from "@s3-viewer/types";
import Head from "next/head";

const DEFAULT_IMAGE = `${publicEnv.siteOrigin}/landing/bucketview.png`;

type SeoProps = {
   title: string;
   description: string;
   canonical?: string;
   noindex?: boolean;
   image?: string;
};

const Seo = ({
   title,
   description,
   canonical = "",
   noindex = true,
   image = DEFAULT_IMAGE,
}: SeoProps) => {
   const fullTitle = title.includes(PRODUCT_NAME)
      ? title
      : `${title} | ${PRODUCT_NAME}`;
   const url = `${publicEnv.siteOrigin}${canonical}`;

   return (
      <Head>
         <title>{fullTitle}</title>
         <meta name="description" content={description} />
         {noindex && <meta name="robots" content="noindex, nofollow" />}
         <link rel="canonical" href={url} />
         <meta property="og:type" content="website" />
         <meta property="og:url" content={url} />
         <meta property="og:title" content={fullTitle} />
         <meta property="og:description" content={description} />
         <meta property="og:image" content={image} />
         <meta property="og:site_name" content={PRODUCT_NAME} />
         <meta property="og:locale" content="en_US" />
         <meta name="twitter:card" content="summary_large_image" />
         <meta name="twitter:title" content={fullTitle} />
         <meta name="twitter:description" content={description} />
         <meta name="twitter:image" content={image} />
      </Head>
   );
};

export default Seo;
