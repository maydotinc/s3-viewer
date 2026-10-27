import { Heading, Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "@s3-viewer/shared";
import { emailSignatureText } from "./footer";
import { EmailLayout } from "./layout";
import { code, footerText, h1, text } from "./styles";

type VerificationCodeEmailProps = {
   code: string;
   expiresInMinutes: number;
};

const TITLE = "Your verification code";
const LEAD = `Enter this code in ${PRODUCT_NAME} to verify your email address.`;
const FOOTER =
   "If you didn't create an account, you can safely ignore this email.";

const verificationCodeEmailSubject = (code: string): string =>
   `${code} is your ${PRODUCT_NAME} verification code`;

const expiry = (minutes: number): string =>
   `This code expires in ${minutes} minutes.`;

const VerificationCodeEmail = ({
   code: value,
   expiresInMinutes,
}: VerificationCodeEmailProps) => (
   <EmailLayout preview={`${value} is your verification code`}>
      <Heading style={h1}>{TITLE}</Heading>
      <Text style={text}>{LEAD}</Text>
      <Section>
         <Text style={code}>{value}</Text>
      </Section>
      <Text style={text}>{expiry(expiresInMinutes)}</Text>
      <Text style={footerText}>{FOOTER}</Text>
   </EmailLayout>
);

const verificationCodeEmailText = ({
   code: value,
   expiresInMinutes,
}: VerificationCodeEmailProps): string =>
   [
      TITLE,
      "",
      LEAD,
      "",
      value,
      "",
      expiry(expiresInMinutes),
      "",
      FOOTER,
      "",
      emailSignatureText(),
   ].join("\n");

export {
   VerificationCodeEmail,
   verificationCodeEmailSubject,
   verificationCodeEmailText,
};
export type { VerificationCodeEmailProps };
