import Link from "next/link";
import type { LegalContentItemProps } from "../content";

const EFFECTIVE_DATE = "July 25th, 2025";
const LAST_UPDATED = "April 28th, 2026";

const sections: LegalContentItemProps[] = [
   {
      title: "Information We Collect",
      content: (
         <p>
            We collect information you provide directly to us, such as when
            you create an account, configure S3 connections, or contact us
            for support. This may include your name, email address, and S3
            credentials for connecting to your storage services.
         </p>
      ),
   },
   {
      title: "How We Use Your Information",
      content: (
         <p>
            We use the information we collect to provide, maintain, and
            improve S3 Viewer services, including connecting to your
            S3-compatible storage, displaying your buckets and objects, and
            facilitating file operations.
         </p>
      ),
   },
   {
      title: "Data Storage and Security",
      content: (
         <p>
            Your S3 credentials and connection information are{" "}
            <strong>encrypted at rest</strong> and stored securely. We
            implement appropriate technical and organizational measures to
            protect your personal information against unauthorized access,
            alteration, disclosure, or destruction.
         </p>
      ),
   },
   {
      title: "Information Sharing",
      content: (
         <p>
            We do not sell, trade, or otherwise transfer your personal
            information to third parties without your consent, except as
            described in this policy. We may share information with trusted
            service providers who assist us in operating our service.
         </p>
      ),
   },
   {
      title: "S3 Data Access",
      content: (
         <p>
            S3 Viewer only accesses your S3 data as necessary to provide the
            viewing and management functionality. We do not store copies of
            your S3 objects on our servers. All operations are performed
            directly between your browser and your configured S3 endpoints.
         </p>
      ),
   },
   {
      title: "Cookies and Tracking",
      content: (
         <p>
            We use cookies and similar tracking technologies to enhance your
            experience, remember your preferences, and analyze usage
            patterns. You can control cookie settings through your browser
            preferences.
         </p>
      ),
   },
   {
      title: "Third-Party Services",
      content: (
         <p>
            Our service may integrate with third-party S3-compatible storage
            providers. Your use of such services is governed by their
            respective privacy policies. We are not responsible for the
            privacy practices of these third-party services.
         </p>
      ),
   },
   {
      title: "Data Retention",
      content: (
         <p>
            We retain your personal information for as long as necessary to
            provide our services and fulfill the purposes outlined in this
            policy, unless a longer retention period is required or
            permitted by law.
         </p>
      ),
   },
   {
      title: "Your Rights",
      content: (
         <p>
            You have the right to access, update, or delete your personal
            information. You may also request that we restrict or stop
            processing your information. Contact us to exercise these
            rights.
         </p>
      ),
   },
   {
      title: "International Data Transfers",
      content: (
         <p>
            Your information may be transferred to and processed in
            countries other than your own. We ensure appropriate safeguards
            are in place to protect your information in accordance with
            applicable data protection laws.
         </p>
      ),
   },
   {
      title: "Children's Privacy",
      content: (
         <p>
            Our services are not directed to children under 13 years of
            age. We do not knowingly collect personal information from
            children under 13. If you believe a child has provided us with
            personal information, please contact us.
         </p>
      ),
   },
   {
      title: "Changes to This Policy",
      content: (
         <p>
            We may update this Privacy Policy from time to time. We will
            notify you of any material changes by posting the new policy on
            this page and updating the effective date. Your continued use
            of our services after such changes constitutes acceptance of
            the new policy.
         </p>
      ),
   },
   {
      title: "Contact Us",
      content: (
         <p>
            If you have any questions about this Privacy Policy or our
            privacy practices, please open an issue on our{" "}
            <Link href="https://github.com/maydotinc/s3-viewer">
               GitHub repository
            </Link>{" "}
            or contact us through the support channels provided there.
         </p>
      ),
   },
];

const PrivacyPolicy = {
   title: "Privacy Policy",
   eyebrow: "Privacy Policy",
   description:
      "What we collect, how we use it, who sees it, and the rights you have over your data.",
   effectiveDate: EFFECTIVE_DATE,
   lastUpdated: LAST_UPDATED,
   sections,
};

export default PrivacyPolicy;
