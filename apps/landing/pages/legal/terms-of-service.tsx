import termsData from "@/components/Legal/data/terms";
import { createLegalPage } from "@/components/Legal/legal-page";

export default createLegalPage({
   slug: "terms-of-service",
   seoDescription:
      "Terms of Service for S3 Viewer — the license, acceptable use, and how accounts work. Read before using our open-source S3 object storage viewer.",
   data: termsData,
});
