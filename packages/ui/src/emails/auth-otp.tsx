import {
   Body,
   Button,
   Container,
   Head,
   Heading,
   Html,
   Preview,
   Section,
   Text,
} from "@react-email/components";
import { PRODUCT_NAME } from "@s3-viewer/types";
import * as React from "react";
import {
   button,
   buttonWrapper,
   codeBlock,
   codeText,
   container,
   footerText,
   h1,
   main,
   mutedText,
   text,
} from "./styles";

type AuthOtpEmailProps = {
   otp: string;
   magicLinkUrl: string;
   expiresInMinutes: number;
};

const AuthOtpEmail = ({
   otp,
   magicLinkUrl,
   expiresInMinutes,
}: AuthOtpEmailProps) => (
   <Html>
      <Head />
      <Preview>Your S3 Viewer sign-in link and code</Preview>
      <Body style={main}>
         <Container style={container}>
            <Heading style={h1}>Sign in to {PRODUCT_NAME}</Heading>
            <Text style={text}>
               Use the button below to sign in. It works on the device you
               requested it from.
            </Text>
            <Section style={buttonWrapper}>
               <Button href={magicLinkUrl} style={button}>
                  Sign in
               </Button>
            </Section>
            <Text style={mutedText}>Or enter this code:</Text>
            <Section style={codeBlock}>
               <Text style={codeText}>{otp}</Text>
            </Section>
            <Text style={text}>
               This link and code expire in {expiresInMinutes} minutes.
            </Text>
            <Text style={footerText}>
               If you weren&apos;t trying to sign in, you can safely ignore this
               email.
            </Text>
         </Container>
      </Body>
   </Html>
);

AuthOtpEmail.PreviewProps = {
   otp: "482913",
   magicLinkUrl: "https://example.com/login?token=preview",
   expiresInMinutes: 10,
} as AuthOtpEmailProps;

const authOtpEmailText = ({
   otp,
   magicLinkUrl,
   expiresInMinutes,
}: AuthOtpEmailProps): string =>
   [
      `Sign in to ${PRODUCT_NAME}`,
      "",
      "Use this link to sign in:",
      magicLinkUrl,
      "",
      `Or enter this code: ${otp}`,
      "",
      `This link and code expire in ${expiresInMinutes} minutes.`,
      "",
      "If you weren't trying to sign in, you can safely ignore this email.",
   ].join("\n");

export { AuthOtpEmail, authOtpEmailText };
export type { AuthOtpEmailProps };
export default AuthOtpEmail;
