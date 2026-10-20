import Contact from "@/components/Contact";
import Seo from "@/components/Seo";
import { contactJsonLd } from "@/lib/jsonld";
import { CONTACT_EMAIL, MAY_HOST, MAY_NAME } from "@/lib/site-config";
import { PRODUCT_NAME } from "@s3-viewer/types/constants";

const DESCRIPTION = `Contact the ${PRODUCT_NAME} team at ${MAY_NAME}. Email ${CONTACT_EMAIL}, open a GitHub issue, or visit ${MAY_HOST}.`;

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
