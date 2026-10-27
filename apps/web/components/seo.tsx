import { publicEnv } from "@/lib/env";
import { COMPANY_NAME, PRODUCT_NAME } from "@s3-viewer/shared";
import Head from "next/head";

const DEFAULT_IMAGE = `${publicEnv.siteOrigin}/social-card.png`;

type SeoProps = {
   title: string;
   description: string;
   canonical?: string;
   noindex?: boolean;
};

const Seo = ({
   title,
   description,
   canonical = "",
   noindex = true,
}: SeoProps) => {
   const fullTitle = title.includes(PRODUCT_NAME)
      ? title
      : `${title} | ${PRODUCT_NAME}`;
   const url = canonical ? `${publicEnv.siteOrigin}${canonical}` : null;

   return (
      <Head>
         <title>{fullTitle}</title>
         <meta name="description" content={description} />
         <meta name="author" content={COMPANY_NAME} />
         {noindex && <meta name="robots" content="noindex, nofollow" />}
         {url && <link rel="canonical" href={url} />}
         <meta property="og:type" content="website" />
         {url && <meta property="og:url" content={url} />}
         <meta property="og:title" content={fullTitle} />
         <meta property="og:description" content={description} />
         <meta property="og:image" content={DEFAULT_IMAGE} />
         <meta property="og:site_name" content={PRODUCT_NAME} />
         <meta property="og:locale" content="en_US" />
         <meta name="twitter:card" content="summary_large_image" />
         <meta name="twitter:title" content={fullTitle} />
         <meta name="twitter:description" content={description} />
         <meta name="twitter:image" content={DEFAULT_IMAGE} />
      </Head>
   );
};

export default Seo;
