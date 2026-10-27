import { Button, Heading, Section, Text } from "@react-email/components";
import { PRODUCT_NAME, plainLabel } from "@s3-viewer/shared";
import { emailSignatureText } from "./footer";
import { EmailLayout } from "./layout";
import {
   button,
   buttonWrapper,
   footerText,
   h1,
   list,
   listItem,
   mutedText,
   text,
} from "./styles";

type InvitedServer = { serverName: string; roleLabel: string };

type ServerInviteEmailProps = {
   inviterName: string;
   inviterEmail: string;
   servers: InvitedServer[];
   invitesUrl: string;
   expiresAtLabel: string;
};

const SUBJECT = `You've been invited to a server on ${PRODUCT_NAME}`;

// names come from whoever sent the invite, so they never reach the subject or preview.
const inviteCopy = ({
   inviterName,
   inviterEmail,
   servers,
   expiresAtLabel,
}: ServerInviteEmailProps) => {
   const inviter = plainLabel(inviterName, "a member");
   const single = servers.length === 1 ? servers[0] : undefined;
   const server = single
      ? plainLabel(single.serverName, "a server")
      : `${servers.length} servers`;
   return {
      title: `You're invited to ${server}`,
      lead: single
         ? `You've been invited to join ${server} on ${PRODUCT_NAME} with ${single.roleLabel} access.`
         : `${inviter} invited you to ${server} on ${PRODUCT_NAME}.`,
      lines: single
         ? []
         : servers.map(
              ({ serverName, roleLabel }) =>
                 `${plainLabel(serverName, "a server")} · ${roleLabel}`
           ),
      invitedBy: `Invited by ${inviter} (${inviterEmail})`,
      cta: single ? "View invitation" : "View invitations",
      expiry: single
         ? `This invitation expires ${expiresAtLabel}.`
         : `These invitations expire ${expiresAtLabel}.`,
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
         {copy.lines.length > 0 && (
            <ul style={list}>
               {copy.lines.map((line, index) => (
                  <li key={index} style={listItem}>
                     {line}
                  </li>
               ))}
            </ul>
         )}
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
      ...(copy.lines.length > 0 ? [...copy.lines, ""] : []),
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
export type { InvitedServer, ServerInviteEmailProps };
