import Contact from "@/components/Contact";
import Seo from "@/components/seo";
import { contactJsonLd } from "@/lib/jsonld";
import { CONTACT_EMAIL, MAY_HOST, MAY_NAME } from "@/lib/site-config";
import { PRODUCT_NAME } from "@s3-viewer/shared/constants";

const DESCRIPTION = `Reach the ${PRODUCT_NAME} team: email ${CONTACT_EMAIL}, open a GitHub issue, or visit ${MAY_HOST} to see what else ${MAY_NAME} builds.`;

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
