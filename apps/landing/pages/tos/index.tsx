import BasicBlock from "@/components/basic-block";
import Layout from "@/components/Layout";
import LegalLayout from "@/components/Legal/legal-layout";
import Seo from "@/components/Seo";

const tosContent = [
   {
      title: "Acceptance of Terms",
      content:
         'By accessing and using S3 Viewer ("the Service"), you agree to be bound by these Terms of Service ("TOS"). S3 Viewer is a fast, open-source S3-compatible object storage viewer. If you do not agree to these terms, please do not use our services.',
   },
   {
      title: "Description of Service",
      content:
         "S3 Viewer provides a unified, file-browser-style interface to view and manage objects across S3-compatible storage providers (e.g., AWS S3, Cloudflare R2, MinIO). The Service supports one-click server connect with auto-detection and secure credential management. Server credentials are encrypted. The code is open-source and may be self-hosted. Our services are subject to the terms and conditions outlined in this TOS.",
   },
   {
      title: "Use of Service",
      content:
         "You agree to use S3 Viewer only for lawful purposes and in a manner that does not infringe on the rights of others or restrict their use of the service. You are responsible for your use of the Service and for ensuring that your use complies with the terms of your storage providers and applicable law.",
   },
   {
      title: "User Conduct",
      content:
         "You agree not to use the Service to access, store, or distribute illegal content, to violate any third party's rights, or to abuse or overload the Service. You must keep your credentials secure and use the Service only for your own authorized storage accounts.",
   },
   {
      title: "Credentials and Security",
      content:
         "We encrypt server credentials using strong encryption. You are responsible for safeguarding your own access credentials and for all activity that occurs under your account. We are not liable for unauthorized access resulting from your failure to protect your credentials.",
   },
   {
      title: "Intellectual Property",
      content:
         "S3 Viewer is open-source. Your use of the Service does not grant you ownership of our software or branding. You may use the open-source code in accordance with its license when self-hosting.",
   },
   {
      title: "Termination",
      content:
         "We may suspend or terminate your access to the Service at any time for violation of these terms or for any other reason. You may stop using the Service at any time. Upon termination, your right to use the Service ceases immediately.",
   },
   {
      title: "Disclaimer of Warranties",
      content:
         'The Service is provided "as is" and without warranties of any kind, either express or implied. We do not guarantee the accuracy, reliability, or availability of the Service or the security of third-party storage providers. Use of S3 Viewer is at your own risk.',
   },
   {
      title: "Limitation of Liability",
      content:
         "To the maximum extent permitted by law, S3 Viewer and its team shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, revenue, or profits arising from your use of the Service or any third-party storage services.",
   },
   {
      title: "Changes to Terms",
      content:
         "We may update these Terms of Service from time to time. We will notify users of material changes by posting the updated terms on this page and updating the effective date. Your continued use of the Service after changes constitutes acceptance of the revised terms.",
   },
   {
      title: "Governing Law",
      content:
         "These terms shall be governed by and construed in accordance with applicable law, without regard to conflict of law principles. Any disputes arising from these terms or the Service shall be resolved in the appropriate courts.",
   },
   {
      title: "Contact Information",
      content:
         "For questions about these Terms of Service or S3 Viewer, please open an issue or discussion on our GitHub repository or contact us through the channels provided there.",
   },
];

const TosPage = () => {
   return (
      <BasicBlock className="gap-30 max-md:gap-15 max-xl:gap-20">
         <Seo
            title="Terms of Service"
            description="Terms of Service for S3 Viewer. Read our terms before using our S3 object storage viewing and management services."
            canonical="/tos"
            type="article"
         />
         <LegalLayout
            title="Terms of Service"
            description="Please read these terms carefully before using S3 Viewer services"
            content={tosContent}
         />
      </BasicBlock>
   );
};

TosPage.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default TosPage;
