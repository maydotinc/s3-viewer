import privacyData from "@/components/Legal/data/privacy";
import { createLegalPage } from "@/components/Legal/legal-page";

export default createLegalPage({
   slug: "privacy-policy",
   seoDescription:
      "The S3 Viewer privacy policy — what information we collect, why we collect it, who we share it with, and the rights you have over it.",
   data: privacyData,
});
