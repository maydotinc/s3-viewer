import {
   Body,
   Container,
   Head,
   Heading,
   Html,
   Link,
   Text,
} from "@react-email/components";

type S3ViewerServerInviteEmailProps = {
   serverName: string;
   role: string;
   invitedByEmail: string;
   invitedByName?: string;
   expiresAtIso: string;
   invitesUrl: string;
};

const S3ViewerServerInviteEmail = ({
   serverName,
   role,
   invitedByEmail,
   invitedByName,
   expiresAtIso,
   invitesUrl,
}: S3ViewerServerInviteEmailProps) => {
   const inviterLabel =
      invitedByName && invitedByName.trim().length > 0
         ? `${invitedByName} (${invitedByEmail})`
         : invitedByEmail;

   return (
      <Html>
         <Head />
         <Body style={main}>
            <Container style={container}>
               <Heading style={h1}>You&apos;re invited to {serverName}</Heading>
               <Text style={{ ...text, marginBottom: "14px" }}>
                  {inviterLabel} invited you to join <b>{serverName}</b> with{" "}
                  <b>{role}</b> access.
               </Text>
               <Text style={{ ...text, marginTop: "0", marginBottom: "14px" }}>
                  This invite expires at{" "}
                  <code style={inlineCode}>{expiresAtIso}</code>.
               </Text>
               <Text style={{ ...text, marginTop: "0", marginBottom: "16px" }}>
                  Open your invites page to accept or reject:
               </Text>
               <Link href={invitesUrl} style={link}>
                  View invites
               </Link>
               <Text
                  style={{
                     ...text,
                     color: "#ababab",
                     marginTop: "18px",
                     marginBottom: "0",
                  }}
               >
                  If you weren&apos;t expecting this invite, you can safely
                  ignore this email.
               </Text>
            </Container>
         </Body>
      </Html>
   );
};

S3ViewerServerInviteEmail.PreviewProps = {
   serverName: "Prod Storage",
   role: "read",
   invitedByEmail: "admin@example.com",
   invitedByName: "Admin User",
   expiresAtIso: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
   invitesUrl: "http://localhost:3000/invites",
} as S3ViewerServerInviteEmailProps;

const main = {
   backgroundColor: "#ffffff",
};

const container = {
   paddingLeft: "12px",
   paddingRight: "12px",
   margin: "0 auto",
};

const h1 = {
   color: "#333",
   fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
   fontSize: "24px",
   fontWeight: "bold",
   padding: "0",
};

const text = {
   color: "#333",
   fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
   fontSize: "14px",
   margin: "24px 0",
};

const inlineCode = {
   backgroundColor: "#f4f4f4",
   borderRadius: "4px",
   border: "1px solid #eee",
   color: "#333",
   padding: "2px 6px",
   fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
};

const link = {
   display: "inline-block",
   padding: "12px 14px",
   backgroundColor: "#1d4ed8",
   borderRadius: "8px",
   color: "#ffffff",
   textDecoration: "none",
   fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
   fontSize: "14px",
   fontWeight: 600,
};

export default S3ViewerServerInviteEmail;
