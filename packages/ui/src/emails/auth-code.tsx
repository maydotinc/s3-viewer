import {
   Body,
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
   codeBlock,
   codeText,
   container,
   footerText,
   h1,
   main,
   text,
} from "./styles";

type AuthCodeIntent = "verify" | "reset";

type AuthCodeEmailProps = {
   intent: AuthCodeIntent;
   otp: string;
   expiresInMinutes: number;
};

const COPY: Record<
   AuthCodeIntent,
   { subject: string; title: string; lead: string; footer: string }
> = {
   verify: {
      subject: `Verify your email for ${PRODUCT_NAME}`,
      title: "Verify your email",
      lead: `Enter this code in ${PRODUCT_NAME} to confirm this address is yours.`,
      footer:
         "If you didn't create an account, you can safely ignore this email.",
   },
   reset: {
      subject: `Reset your ${PRODUCT_NAME} password`,
      title: "Reset your password",
      lead: "Enter this code to choose a new password.",
      footer:
         "If you didn't ask to reset your password, you can safely ignore this email. Your password won't change.",
   },
};

const authCodeEmailSubject = (intent: AuthCodeIntent): string =>
   COPY[intent].subject;

const AuthCodeEmail = ({
   intent,
   otp,
   expiresInMinutes,
}: AuthCodeEmailProps) => {
   const copy = COPY[intent];
   return (
      <Html>
         <Head />
         <Preview>{`${copy.title}: ${otp}`}</Preview>
         <Body style={main}>
            <Container style={container}>
               <Heading style={h1}>{copy.title}</Heading>
               <Text style={text}>{copy.lead}</Text>
               <Section style={codeBlock}>
                  <Text style={codeText}>{otp}</Text>
               </Section>
               <Text style={text}>
                  This code expires in {expiresInMinutes} minutes.
               </Text>
               <Text style={footerText}>{copy.footer}</Text>
            </Container>
         </Body>
      </Html>
   );
};

AuthCodeEmail.PreviewProps = {
   intent: "verify",
   otp: "482913",
   expiresInMinutes: 10,
} as AuthCodeEmailProps;

const authCodeEmailText = ({
   intent,
   otp,
   expiresInMinutes,
}: AuthCodeEmailProps): string => {
   const copy = COPY[intent];
   return [
      copy.title,
      "",
      copy.lead,
      "",
      `Your code: ${otp}`,
      "",
      `This code expires in ${expiresInMinutes} minutes.`,
      "",
      copy.footer,
   ].join("\n");
};

export { AuthCodeEmail, authCodeEmailSubject, authCodeEmailText };
export type { AuthCodeEmailProps, AuthCodeIntent };
export default AuthCodeEmail;
