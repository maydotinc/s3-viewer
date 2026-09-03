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
   container,
   footerText,
   h1,
   main,
   text,
} from "./styles";

type ServerInviteEmailProps = {
   inviterName: string;
   serverName: string;
   roleLabel: string;
   invitesUrl: string;
   expiresAtLabel: string;
};

const ServerInviteEmail = ({
   inviterName,
   serverName,
   roleLabel,
   invitesUrl,
   expiresAtLabel,
}: ServerInviteEmailProps) => (
   <Html>
      <Head />
      <Preview>
         {inviterName} invited you to {serverName} on S3 Viewer
      </Preview>
      <Body style={main}>
         <Container style={container}>
            <Heading style={h1}>You&apos;re invited to {serverName}</Heading>
            <Text style={text}>
               {inviterName} invited you to join {serverName} on {PRODUCT_NAME}{" "}
               with {roleLabel} access.
            </Text>
            <Section style={buttonWrapper}>
               <Button href={invitesUrl} style={button}>
                  View invitation
               </Button>
            </Section>
            <Text style={text}>This invitation expires {expiresAtLabel}.</Text>
            <Text style={footerText}>
               If you weren&apos;t expecting this invitation, you can safely
               ignore this email.
            </Text>
         </Container>
      </Body>
   </Html>
);

ServerInviteEmail.PreviewProps = {
   inviterName: "Ada Lovelace",
   serverName: "Prod Storage",
   roleLabel: "Editor",
   invitesUrl: "https://example.com/invites",
   expiresAtLabel: "on May 8, 2026",
} as ServerInviteEmailProps;

const serverInviteEmailText = ({
   inviterName,
   serverName,
   roleLabel,
   invitesUrl,
   expiresAtLabel,
}: ServerInviteEmailProps): string =>
   [
      `You're invited to ${serverName}`,
      "",
      `${inviterName} invited you to join ${serverName} on ${PRODUCT_NAME} with ${roleLabel} access.`,
      "",
      "View the invitation:",
      invitesUrl,
      "",
      `This invitation expires ${expiresAtLabel}.`,
      "",
      "If you weren't expecting this invitation, you can safely ignore this email.",
   ].join("\n");

export { ServerInviteEmail, serverInviteEmailText };
export type { ServerInviteEmailProps };
export default ServerInviteEmail;
