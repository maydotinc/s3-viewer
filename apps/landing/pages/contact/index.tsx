import Contact from "@/components/Contact";
import Seo from "@/components/Seo";
import { contactJsonLd } from "@/lib/jsonld";
import { CONTACT_EMAIL } from "@/lib/site-config";

const DESCRIPTION = `Contact the S3 Viewer team at May Inc. Email ${CONTACT_EMAIL}, open a GitHub issue, or visit may.inc.`;

const JSON_LD = contactJsonLd(DESCRIPTION);

const ContactPage = () => {
   return (
      <>
         <Seo
            title="Contact"
            description={DESCRIPTION}
            canonical="/contact"
            jsonLd={JSON_LD}
         />
         <Contact />
      </>
   );
};

export default ContactPage;
