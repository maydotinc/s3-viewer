import { CONTACT_EMAIL } from "@/lib/site-config";
import type { LegalPageData } from "../legal-page";

const EFFECTIVE_DATE = "2025-07-25";
const LAST_UPDATED = "2026-09-19";

const sections: LegalPageData["sections"] = [
   {
      title: "Who we are",
      content: (
         <p>
            S3 Viewer is an open-source viewer for S3-compatible object storage.
            The hosted service is operated by <strong>May Inc.</strong>, which
            is responsible for the personal information described in this
            policy. Questions about this policy can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=S3%20Viewer%20privacy`}>
               {CONTACT_EMAIL}
            </a>{" "}
            with &ldquo;S3 Viewer&rdquo; in the subject line.
         </p>
      ),
   },
   {
      title: "Information we collect",
      content: (
         <>
            <p>
               We collect only what is needed to provide the service. In
               general, that falls into these categories:
            </p>
            <ul>
               <li>
                  Account information you provide, such as your email address.
               </li>
               <li>
                  Information needed to operate the service, such as the
                  settings and access you configure for yourself and anyone you
                  invite.
               </li>
               <li>Credentials you choose to connect, which are encrypted.</li>
               <li>
                  Technical information necessary to keep the service secure and
                  available.
               </li>
            </ul>
            <p>
               Object contents may pass through our servers and be processed
               temporarily for actions you request, such as uploads, editing,
               archive downloads, and transfers between servers. We do not keep
               persistent copies of your objects outside your connected storage
               or inspect their contents independently of those operations.
            </p>
         </>
      ),
   },
   {
      title: "How we use information",
      content: (
         <p>
            We use personal information to provide, maintain and secure the
            service, to sign you in, to carry out the actions you request, and
            to send you service-related messages. We do not use your information
            for advertising, and we do not build profiles about you.
         </p>
      ),
   },
   {
      title: "Legal basis",
      content: (
         <p>
            Where required by law, we process personal information on the basis
            of performing our agreement with you, our legitimate interests in
            operating and securing the service, compliance with legal
            obligations, or your consent.
         </p>
      ),
   },
   {
      title: "How we share information",
      content: (
         <p>
            We share information only with service providers that help us
            operate the service, when required by law, or with your consent. We
            do not sell personal information.
         </p>
      ),
   },
   {
      title: "Your storage provider",
      content: (
         <p>
            The storage you connect remains yours and stays with your storage
            provider. What that provider collects, logs and retains is governed
            by its own terms and privacy policy, not by this one.
         </p>
      ),
   },
   {
      title: "Retention",
      content: (
         <p>
            We retain personal information only as long as necessary to provide
            the service and as required by applicable law.
         </p>
      ),
   },
   {
      title: "Cookies",
      content: (
         <p>
            We use strictly necessary cookies to keep you signed in. We do not
            use advertising or tracking cookies.
         </p>
      ),
   },
   {
      title: "Your rights",
      content: (
         <p>
            Depending on where you live, you may have rights under applicable
            law to access, correct, delete, or port your personal information,
            to object to or restrict certain processing, and to withdraw
            consent. To exercise them, contact{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=S3%20Viewer%20privacy`}>
               {CONTACT_EMAIL}
            </a>{" "}
            with &ldquo;S3 Viewer&rdquo; in the subject line. You can delete
            your account at any time from the app.
         </p>
      ),
   },
   {
      title: "Self-hosting",
      content: (
         <p>
            S3 Viewer is open source, and self-hosted instances are operated by
            whoever runs them, not by May Inc.
         </p>
      ),
   },
   {
      title: "Children",
      content: (
         <p>
            The service is not directed to children under 16, and we do not
            knowingly collect their personal information.
         </p>
      ),
   },
   {
      title: "Changes to this policy",
      content: (
         <p>
            We may update this policy from time to time. If we do, we will post
            the updated version on this page and revise the date above.
         </p>
      ),
   },
   {
      title: "Contact",
      content: (
         <p>
            May Inc. is responsible for the personal information described in
            this policy. You can reach us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=S3%20Viewer%20privacy`}>
               {CONTACT_EMAIL}
            </a>{" "}
            with &ldquo;S3 Viewer&rdquo; in the subject line.
         </p>
      ),
   },
];

const PrivacyPolicy: LegalPageData = {
   title: "Privacy Policy",
   description:
      "What information we collect, why we collect it, who we share it with, and the rights you have over it.",
   effectiveDate: EFFECTIVE_DATE,
   lastUpdated: LAST_UPDATED,
   sections,
};

export default PrivacyPolicy;
