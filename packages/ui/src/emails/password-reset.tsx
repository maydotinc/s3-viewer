import { Button, Heading, Link, Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "@s3-viewer/shared";
import { emailSignatureText } from "./footer";
import { EmailLayout } from "./layout";
import {
   button,
   buttonWrapper,
   footerText,
   h1,
   link,
   mutedText,
   text,
} from "./styles";

type PasswordResetEmailProps = {
   url: string;
   expiresInHours: number;
};

const TITLE = "Reset your password";
const LEAD = "Use the button below to choose a new password.";
const CTA = "Reset password";
const FOOTER =
   "If you didn't ask to reset your password, you can safely ignore this email. Your password won't change.";

const passwordResetEmailSubject = (): string =>
   `Reset your ${PRODUCT_NAME} password`;

const expiry = (hours: number): string =>
   `This link expires in ${hours} ${hours === 1 ? "hour" : "hours"}.`;

const PasswordResetEmail = ({
   url,
   expiresInHours,
}: PasswordResetEmailProps) => (
   <EmailLayout preview={TITLE}>
      <Heading style={h1}>{TITLE}</Heading>
      <Text style={text}>{LEAD}</Text>
      <Section style={buttonWrapper}>
         <Button href={url} style={button}>
            {CTA}
         </Button>
      </Section>
      <Text style={mutedText}>
         Or open this link:{" "}
         <Link href={url} style={link}>
            {url}
         </Link>
      </Text>
      <Text style={text}>{expiry(expiresInHours)}</Text>
      <Text style={footerText}>{FOOTER}</Text>
   </EmailLayout>
);

const passwordResetEmailText = ({
   url,
   expiresInHours,
}: PasswordResetEmailProps): string =>
   [
      TITLE,
      "",
      LEAD,
      "",
      `${CTA}: ${url}`,
      "",
      expiry(expiresInHours),
      "",
      FOOTER,
      "",
      emailSignatureText(),
   ].join("\n");

export {
   PasswordResetEmail,
   passwordResetEmailSubject,
   passwordResetEmailText,
};
export type { PasswordResetEmailProps };
