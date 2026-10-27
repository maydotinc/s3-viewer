import { Body, Container, Head, Html, Preview } from "@react-email/components";
import type { ReactNode } from "react";
import { EmailSignature } from "./footer";
import { container, main } from "./styles";

type EmailLayoutProps = {
   preview: string;
   children: ReactNode;
};

const EmailLayout = ({ preview, children }: EmailLayoutProps) => (
   <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
         <Container style={container}>
            {children}
            <EmailSignature />
         </Container>
      </Body>
   </Html>
);

export { EmailLayout };
