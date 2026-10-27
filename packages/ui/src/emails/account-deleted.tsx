import { Heading, Link, Text } from "@react-email/components";
import { GITHUB_ISSUES_URL, PRODUCT_NAME, plainLabel } from "@s3-viewer/shared";
import { emailSignatureText } from "./footer";
import { EmailLayout } from "./layout";
import { footerText, h1, list, listItem, text } from "./styles";

type AccountDeletedEmailProps = {
   name: string;
   supportEmail?: string;
};

const COPY = {
   subject: `Your ${PRODUCT_NAME} account has been deleted`,
   title: "Your account has been deleted",
   intro: (name: string) =>
      `Hi ${plainLabel(name, "there")}, your ${PRODUCT_NAME} account and the records we held for it are gone. This email confirms what was removed from ${PRODUCT_NAME}:`,
   deleted: [
      "your account, including your name and email address",
      "every session and linked sign-in method",
      "the saved connection and stored credentials for every server you owned",
      "your access to servers other people shared with you",
      "invitations you sent and invitations waiting for you",
   ],
   kept: "Audit entries for actions you took on servers other people own are kept exactly as recorded, so their history stays complete. Entries on servers you owned were deleted along with those servers.",
   untouched: `Nothing in your S3 storage was touched. ${PRODUCT_NAME} only ever held the address and keys used to reach it, so every bucket, file and S3 server is exactly as it was.`,
   contactLead: "If you have a question about this,",
};

const accountDeletedEmailSubject = (): string => COPY.subject;

const AccountDeletedEmail = ({
   name,
   supportEmail,
}: AccountDeletedEmailProps) => (
   <EmailLayout preview={COPY.subject}>
      <Heading style={h1}>{COPY.title}</Heading>
      <Text style={text}>{COPY.intro(name)}</Text>
      <ul style={list}>
         {COPY.deleted.map((item) => (
            <li key={item} style={listItem}>
               {item}
            </li>
         ))}
      </ul>
      <Text style={text}>{COPY.kept}</Text>
      <Text style={text}>{COPY.untouched}</Text>
      <Text style={footerText}>
         {COPY.contactLead}{" "}
         {supportEmail ? (
            <>
               email <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>
               .
            </>
         ) : (
            <>
               open an issue at{" "}
               <Link href={GITHUB_ISSUES_URL}>{GITHUB_ISSUES_URL}</Link>.
            </>
         )}
      </Text>
   </EmailLayout>
);

const accountDeletedEmailText = ({
   name,
   supportEmail,
}: AccountDeletedEmailProps): string =>
   [
      COPY.title,
      "",
      COPY.intro(name),
      "",
      ...COPY.deleted.map((item) => `- ${item}`),
      "",
      COPY.kept,
      "",
      COPY.untouched,
      "",
      supportEmail
         ? `${COPY.contactLead} email ${supportEmail}.`
         : `${COPY.contactLead} open an issue at ${GITHUB_ISSUES_URL}.`,
      "",
      emailSignatureText(),
   ].join("\n");

export {
   AccountDeletedEmail,
   accountDeletedEmailSubject,
   accountDeletedEmailText,
};
export type { AccountDeletedEmailProps };
