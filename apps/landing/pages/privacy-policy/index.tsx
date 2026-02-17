import BasicBlock from "@/components/basic-block";
import Layout from "@/components/Layout";
import LegalLayout from "@/components/Legal/legal-layout";
import Seo from "@/components/Seo";

const privacyContent = [
   {
      title: "Information We Collect",
      content:
         "We collect information you provide directly to us, such as when you create an account, configure S3 connections, or contact us for support. This may include your name, email address, and S3 credentials for connecting to your storage services.",
   },
   {
      title: "How We Use Your Information",
      content:
         "We use the information we collect to provide, maintain, and improve S3-Viewer services, including connecting to your S3-compatible storage, displaying your buckets and objects, and facilitating file operations.",
   },
   {
      title: "Data Storage and Security",
      content:
         "Your S3 credentials and connection information are encrypted and stored securely. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.",
   },
   {
      title: "Information Sharing",
      content:
         "We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy. We may share information with trusted service providers who assist us in operating our service.",
   },
   {
      title: "S3 Data Access",
      content:
         "S3-Viewer only accesses your S3 data as necessary to provide the viewing and management functionality. We do not store copies of your S3 objects on our servers. All operations are performed directly between your browser and your configured S3 endpoints.",
   },
   {
      title: "Cookies and Tracking",
      content:
         "We use cookies and similar tracking technologies to enhance your experience, remember your preferences, and analyze usage patterns. You can control cookie settings through your browser preferences.",
   },
   {
      title: "Third-Party Services",
      content:
         "Our service may integrate with third-party S3-compatible storage providers. Your use of such services is governed by their respective privacy policies. We are not responsible for the privacy practices of these third-party services.",
   },
   {
      title: "Data Retention",
      content:
         "We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this policy, unless a longer retention period is required or permitted by law.",
   },
   {
      title: "Your Rights",
      content:
         "You have the right to access, update, or delete your personal information. You may also request that we restrict or stop processing your information. Contact us to exercise these rights.",
   },
   {
      title: "International Data Transfers",
      content:
         "Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information in accordance with applicable data protection laws.",
   },
   {
      title: "Children's Privacy",
      content:
         "Our services are not directed to children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us.",
   },
   {
      title: "Changes to This Policy",
      content:
         "We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the effective date. Your continued use of our services after such changes constitutes acceptance of the new policy.",
   },
   {
      title: "Contact Us",
      content:
         "If you have any questions about this Privacy Policy or our privacy practices, please contact us at privacy@s3-viewer.com or through our support channels.",
   },
];

const PrivacyPage = () => {
   return (
      <BasicBlock className="gap-30 max-md:gap-15 max-xl:gap-20">
         <Seo
            title="Privacy Policy"
            description="Learn how S3 Viewer collects, uses, and protects your information. Your S3 credentials are encrypted and we never store copies of your objects."
            canonical="/privacy-policy"
            type="article"
         />
         <LegalLayout
            title="Privacy Policy"
            description="Learn how we collect, use, and protect your information when using S3 Viewer"
            content={privacyContent}
         />
      </BasicBlock>
   );
};

PrivacyPage.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default PrivacyPage;
