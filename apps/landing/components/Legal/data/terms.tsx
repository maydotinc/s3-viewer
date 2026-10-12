import { CONTACT_EMAIL } from "@/lib/site-config";
import type { LegalPageData } from "../legal-page";

const EFFECTIVE_DATE = "2025-07-25";
const LAST_UPDATED = "2026-10-04";

const sections: LegalPageData["sections"] = [
   {
      title: "Acceptance of terms",
      content: (
         <p>
            By using S3 Viewer (&ldquo;the Service&rdquo;), you agree to these
            terms. If you do not agree to them, please do not use the Service.
         </p>
      ),
   },
   {
      title: "The service",
      content: (
         <p>
            S3 Viewer is open-source software for viewing and managing objects
            in S3-compatible storage. The software is provided as-is and may be
            self-hosted. The hosted version, operated by{" "}
            <strong>May Inc.</strong>, is provided as a convenience and may
            change or be discontinued.
         </p>
      ),
   },
   {
      title: "Accounts",
      content: (
         <p>
            You are responsible for your account, for keeping secure any
            credentials you choose to connect, and for everything done through
            your account. Your use of any storage you connect remains subject to
            your agreement with that storage provider.
         </p>
      ),
   },
   {
      title: "Fees",
      content: (
         <p>
            The service is currently offered free of charge; we may introduce
            paid plans with notice.
         </p>
      ),
   },
   {
      title: "Acceptable use",
      content: (
         <p>
            Use the Service only for lawful purposes. Do not use it to infringe
            anyone&apos;s rights, to store or distribute unlawful content, to
            access storage you are not authorized to access, or to interfere
            with or overload the Service.
         </p>
      ),
   },
   {
      title: "Intellectual property",
      content: (
         <p>
            The software is made available under the MIT license, and you may
            use it on those terms. The S3 Viewer name and logo are trademarks of
            May Inc. and are not covered by that license. Please don&apos;t
            present a fork or your own instance as run by or affiliated with May
            Inc.
         </p>
      ),
   },
   {
      title: "Disclaimer of warranties",
      content: (
         <p>
            The Service is provided &ldquo;as is&rdquo; and without warranties
            of any kind, express or implied. We do not warrant that the Service
            will be uninterrupted, error-free, or suitable for a particular
            purpose. Actions taken through the Service, such as deleting or
            renaming, may not be reversible.
         </p>
      ),
   },
   {
      title: "Limitation of liability",
      content: (
         <p>
            To the maximum extent permitted by law, May Inc. is not liable for
            any indirect, incidental, special, consequential or punitive
            damages, or for any loss of data, revenue or profits, arising from
            your use of the Service.
         </p>
      ),
   },
   {
      title: "Termination",
      content: (
         <p>
            You may stop using the Service and delete your account at any time.
            We may suspend or end access to the hosted version if these terms
            are breached or where necessary to protect the Service. Your rights
            to use the open-source software under its license are unaffected.
         </p>
      ),
   },
   {
      title: "Changes to these terms",
      content: (
         <p>
            We may update these terms from time to time. If we do, we will post
            the updated version on this page and revise the date above.
            Continuing to use the Service after that means you accept the
            updated terms.
         </p>
      ),
   },
   {
      title: "Governing law",
      content: (
         <p>
            These terms are governed by the laws of the jurisdiction in which
            May Inc. is established, without regard to conflict-of-law rules.
            Nothing here removes any mandatory consumer protections available to
            you where you live.
         </p>
      ),
   },
   {
      title: "Contact",
      content: (
         <p>
            Questions about these terms can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=S3%20Viewer%20terms`}>
               {CONTACT_EMAIL}
            </a>{" "}
            with &ldquo;S3 Viewer&rdquo; in the subject line.
         </p>
      ),
   },
];

const TermsOfService: LegalPageData = {
   title: "Terms of Service",
   description:
      "The ground rules for using S3 Viewer — the license, acceptable use, and how accounts work.",
   effectiveDate: EFFECTIVE_DATE,
   lastUpdated: LAST_UPDATED,
   sections,
};

export default TermsOfService;
