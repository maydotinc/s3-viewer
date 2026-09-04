import {
   Body,
   Container,
   Head,
   Heading,
   Html,
   Link,
   Preview,
   Text,
} from "@react-email/components";
import { GITHUB_ISSUES_URL, PRODUCT_NAME } from "@s3-viewer/types";
import * as React from "react";
import {
   container,
   footerText,
   h1,
   list,
   listItem,
   main,
   text,
} from "./styles";

type AccountDeletedEmailProps = {
   name: string;
   supportEmail?: string;
};

const DELETED = [
   "your account, including your name and email address",
   "every session and linked sign-in method",
   "every server you owned and the credentials stored for it",
   "your access to servers other people shared with you",
   "invitations you sent and invitations waiting for you",
];

const KEPT =
   'Audit entries for actions you took are kept so that other members\' history stays complete, with your email address replaced by "[deleted user]".';

const UNTOUCHED = `${PRODUCT_NAME} only ever held the connection details, so the buckets and files in your storage were not touched.`;

const contactLine = (supportEmail?: string): string =>
   supportEmail
      ? `If you have a question about this, email ${supportEmail}.`
      : `If you have a question about this, open an issue at ${GITHUB_ISSUES_URL}.`;

const AccountDeletedEmail = ({
   name,
   supportEmail,
}: AccountDeletedEmailProps) => (
   <Html>
      <Head />
      <Preview>Your {PRODUCT_NAME} account has been deleted</Preview>
      <Body style={main}>
         <Container style={container}>
            <Heading style={h1}>Your account has been deleted</Heading>
            <Text style={text}>
               Hi {name}, your {PRODUCT_NAME} account and the data we held for
               it are gone. This email confirms what was removed.
            </Text>
            <ul style={list}>
               {DELETED.map((item) => (
                  <li key={item} style={listItem}>
                     {item}
                  </li>
               ))}
            </ul>
            <Text style={text}>{KEPT}</Text>
            <Text style={text}>{UNTOUCHED}</Text>
            <Text style={footerText}>
               If you have a question about this,{" "}
               {supportEmail ? (
                  <>
                     email{" "}
                     <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>
                     .
                  </>
               ) : (
                  <>
                     open an issue at{" "}
                     <Link href={GITHUB_ISSUES_URL}>{GITHUB_ISSUES_URL}</Link>.
                  </>
               )}
            </Text>
         </Container>
      </Body>
   </Html>
);

AccountDeletedEmail.PreviewProps = {
   name: "Ada",
   supportEmail: "support@example.com",
} as AccountDeletedEmailProps;

const accountDeletedEmailText = ({
   name,
   supportEmail,
}: AccountDeletedEmailProps): string =>
   [
      "Your account has been deleted",
      "",
      `Hi ${name}, your ${PRODUCT_NAME} account and the data we held for it are gone. This email confirms what was removed:`,
      "",
      ...DELETED.map((item) => `- ${item}`),
      "",
      KEPT,
      "",
      UNTOUCHED,
      "",
      contactLine(supportEmail),
   ].join("\n");

export { AccountDeletedEmail, accountDeletedEmailText };
export type { AccountDeletedEmailProps };
export default AccountDeletedEmail;
