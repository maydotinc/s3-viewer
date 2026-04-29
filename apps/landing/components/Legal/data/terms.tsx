import Link from "next/link";
import type { LegalContentItemProps } from "../content";

const EFFECTIVE_DATE = "July 25th, 2025";
const LAST_UPDATED = "April 28th, 2026";

const sections: LegalContentItemProps[] = [
   {
      title: "Acceptance of Terms",
      content: (
         <p>
            By accessing and using S3 Viewer (&ldquo;the Service&rdquo;), you
            agree to be bound by these Terms of Service. S3 Viewer is a fast,
            open-source S3-compatible object storage viewer operated by{" "}
            <strong>May Inc.</strong> If you do not agree to these terms,
            please do not use the Service.
         </p>
      ),
   },
   {
      title: "Description of Service",
      content: (
         <p>
            S3 Viewer provides a unified, file-browser-style interface to view
            and manage objects across S3-compatible storage providers
            including AWS S3, Cloudflare R2, MinIO, Backblaze B2, and any
            S3-API compatible service. The Service supports one-click server
            connect with auto-detection and secure credential management.
            Server credentials are encrypted. The code is open-source and may
            be self-hosted under the MIT license.
         </p>
      ),
   },
   {
      title: "Use of Service",
      content: (
         <p>
            You agree to use S3 Viewer only for lawful purposes and in a
            manner that does not infringe on the rights of others or restrict
            their use of the Service. You are responsible for your use of the
            Service and for ensuring that your use complies with the terms of
            your storage providers and applicable law.
         </p>
      ),
   },
   {
      title: "User Conduct",
      content: (
         <p>
            You agree not to use the Service to access, store, or distribute
            illegal content, to violate any third party&apos;s rights, or to
            abuse or overload the Service. You must keep your credentials
            secure and use the Service only for your own authorized storage
            accounts.
         </p>
      ),
   },
   {
      title: "Credentials and Security",
      content: (
         <p>
            We encrypt server credentials using strong encryption. You are
            responsible for safeguarding your own access credentials and for
            all activity that occurs under your account. We are not liable
            for unauthorized access resulting from your failure to protect
            your credentials.
         </p>
      ),
   },
   {
      title: "Intellectual Property",
      content: (
         <p>
            S3 Viewer is open-source. Your use of the Service does not grant
            you ownership of our software or branding. You may use the
            open-source code in accordance with its license when self-hosting.
            The S3 Viewer name and logos remain the intellectual property of
            May Inc.
         </p>
      ),
   },
   {
      title: "Termination",
      content: (
         <p>
            We may suspend or terminate your access to the Service at any
            time for violation of these terms or for any other reason. You
            may stop using the Service at any time. Upon termination, your
            right to use the hosted Service ceases immediately, but your
            ability to self-host the open-source code under its license is
            unaffected.
         </p>
      ),
   },
   {
      title: "Disclaimer of Warranties",
      content: (
         <p>
            The Service is provided &ldquo;as is&rdquo; and without
            warranties of any kind, either express or implied. We do not
            guarantee the accuracy, reliability, or availability of the
            Service or the security of third-party storage providers. Use of
            S3 Viewer is at your own risk.
         </p>
      ),
   },
   {
      title: "Limitation of Liability",
      content: (
         <p>
            To the maximum extent permitted by law, S3 Viewer and its team
            shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, or for any loss of data,
            revenue, or profits arising from your use of the Service or any
            third-party storage services.
         </p>
      ),
   },
   {
      title: "Changes to Terms",
      content: (
         <p>
            We may update these Terms of Service from time to time. We will
            notify users of material changes by posting the updated terms on
            this page and updating the effective date. Your continued use of
            the Service after changes constitutes acceptance of the revised
            terms.
         </p>
      ),
   },
   {
      title: "Governing Law",
      content: (
         <p>
            These terms shall be governed by and construed in accordance
            with applicable law, without regard to conflict of law
            principles. Any disputes arising from these terms or the Service
            shall be resolved in the appropriate courts.
         </p>
      ),
   },
   {
      title: "Contact Information",
      content: (
         <p>
            For questions about these Terms of Service or S3 Viewer, please
            open an issue or discussion on our{" "}
            <Link href="https://github.com/maydotinc/s3-viewer">
               GitHub repository
            </Link>{" "}
            or contact us through the channels provided there.
         </p>
      ),
   },
];

const TermsOfService = {
   title: "Terms of Service",
   eyebrow: "Terms of Service",
   description:
      "The ground rules for using S3 Viewer — license, acceptable use, and how we handle accounts and credentials.",
   effectiveDate: EFFECTIVE_DATE,
   lastUpdated: LAST_UPDATED,
   sections,
};

export default TermsOfService;
