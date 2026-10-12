import { Button, Heading, Section, Text } from "@react-email/components";
import { PRODUCT_NAME, plainLabel } from "@s3-viewer/types";
import { emailSignatureText } from "./footer";
import { EmailLayout } from "./layout";
import {
   button,
   buttonWrapper,
   footerText,
   h1,
   mutedText,
   text,
} from "./styles";

type ServerInviteEmailProps = {
   inviterName: string;
   inviterEmail: string;
   serverName: string;
   roleLabel: string;
   invitesUrl: string;
   expiresAtLabel: string;
};

const SUBJECT = `You've been invited to a server on ${PRODUCT_NAME}`;

// names come from whoever sent the invite, so they never reach the subject or preview.
const inviteCopy = ({
   inviterName,
   inviterEmail,
   serverName,
   roleLabel,
   expiresAtLabel,
}: ServerInviteEmailProps) => {
   const server = plainLabel(serverName, "a server");
   return {
      title: `You're invited to ${server}`,
      lead: `You've been invited to join ${server} on ${PRODUCT_NAME} with ${roleLabel} access.`,
      invitedBy: `Invited by ${plainLabel(inviterName, "a member")} (${inviterEmail})`,
      cta: "View invitation",
      expiry: `This invitation expires ${expiresAtLabel}.`,
      footer:
         "If you weren't expecting this invitation, you can safely ignore this email.",
   };
};

const serverInviteEmailSubject = (): string => SUBJECT;

const ServerInviteEmail = (props: ServerInviteEmailProps) => {
   const copy = inviteCopy(props);
   return (
      <EmailLayout preview={SUBJECT}>
         <Heading style={h1}>{copy.title}</Heading>
         <Text style={text}>{copy.lead}</Text>
         <Text style={mutedText}>{copy.invitedBy}</Text>
         <Section style={buttonWrapper}>
            <Button href={props.invitesUrl} style={button}>
               {copy.cta}
            </Button>
         </Section>
         <Text style={text}>{copy.expiry}</Text>
         <Text style={footerText}>{copy.footer}</Text>
      </EmailLayout>
   );
};

const serverInviteEmailText = (props: ServerInviteEmailProps): string => {
   const copy = inviteCopy(props);
   return [
      copy.title,
      "",
      copy.lead,
      copy.invitedBy,
      "",
      `${copy.cta}:`,
      props.invitesUrl,
      "",
      copy.expiry,
      "",
      copy.footer,
      "",
      emailSignatureText(),
   ].join("\n");
};

export { ServerInviteEmail, serverInviteEmailSubject, serverInviteEmailText };
export type { ServerInviteEmailProps };
