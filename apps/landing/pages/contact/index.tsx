import Contact from "@/components/Contact";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import {
   CONTACT_EMAIL,
   GITHUB_URL,
   MAY_URL,
   SITE_URL,
} from "@/lib/site-config";

const DESCRIPTION = `Contact the S3 Viewer team at May Inc. Email ${CONTACT_EMAIL}, open a GitHub issue, or visit may.inc.`;

const ContactPage = () => {
   const jsonLd = [
      {
         "@context": "https://schema.org",
         "@type": "ContactPage",
         name: "Contact S3 Viewer",
         url: `${SITE_URL}/contact`,
         description: DESCRIPTION,
      },
      {
         "@context": "https://schema.org",
         "@type": "Organization",
         name: "May Inc.",
         url: MAY_URL,
         logo: "https://cdn-may.com/assets/may-square-512x512.png",
         sameAs: [GITHUB_URL, "https://github.com/maydotinc"],
         contactPoint: [
            {
               "@type": "ContactPoint",
               contactType: "customer support",
               email: CONTACT_EMAIL,
               url: `${SITE_URL}/contact`,
               availableLanguage: "English",
            },
         ],
      },
      {
         "@context": "https://schema.org",
         "@type": "BreadcrumbList",
         itemListElement: [
            {
               "@type": "ListItem",
               position: 1,
               name: "Home",
               item: SITE_URL,
            },
            {
               "@type": "ListItem",
               position: 2,
               name: "Contact",
               item: `${SITE_URL}/contact`,
            },
         ],
      },
   ];

   return (
      <>
         <Seo
            title="Contact"
            description={DESCRIPTION}
            canonical="/contact"
            jsonLd={jsonLd}
         />
         <Contact />
      </>
   );
};

ContactPage.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default ContactPage;
