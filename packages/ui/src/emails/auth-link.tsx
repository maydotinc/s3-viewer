import { Button, Heading, Link, Section, Text } from "@react-email/components";
import { PRODUCT_NAME } from "@s3-viewer/types";
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

type AuthLinkIntent = "verify" | "reset";

type AuthLinkEmailProps = {
   intent: AuthLinkIntent;
   url: string;
   expiresInHours: number;
};

const COPY: Record<
   AuthLinkIntent,
   { subject: string; title: string; lead: string; cta: string; footer: string }
> = {
   verify: {
      subject: `Verify your email for ${PRODUCT_NAME}`,
      title: "Verify your email",
      lead: `Confirm this address to share servers and accept invites on ${PRODUCT_NAME}.`,
      cta: "Verify email",
      footer:
         "If you didn't create an account, you can safely ignore this email.",
   },
   reset: {
      subject: `Reset your ${PRODUCT_NAME} password`,
      title: "Reset your password",
      lead: "Use the button below to choose a new password.",
      cta: "Reset password",
      footer:
         "If you didn't ask to reset your password, you can safely ignore this email. Your password won't change.",
   },
};

const authLinkEmailSubject = (intent: AuthLinkIntent): string =>
   COPY[intent].subject;

const expiry = (hours: number): string =>
   `This link expires in ${hours} ${hours === 1 ? "hour" : "hours"}.`;

const AuthLinkEmail = ({ intent, url, expiresInHours }: AuthLinkEmailProps) => {
   const copy = COPY[intent];
   return (
      <EmailLayout preview={copy.title}>
         <Heading style={h1}>{copy.title}</Heading>
         <Text style={text}>{copy.lead}</Text>
         <Section style={buttonWrapper}>
            <Button href={url} style={button}>
               {copy.cta}
            </Button>
         </Section>
         <Text style={mutedText}>
            Or open this link:{" "}
            <Link href={url} style={link}>
               {url}
            </Link>
         </Text>
         <Text style={text}>{expiry(expiresInHours)}</Text>
         <Text style={footerText}>{copy.footer}</Text>
      </EmailLayout>
   );
};

const authLinkEmailText = ({
   intent,
   url,
   expiresInHours,
}: AuthLinkEmailProps): string => {
   const copy = COPY[intent];
   return [
      copy.title,
      "",
      copy.lead,
      "",
      `${copy.cta}: ${url}`,
      "",
      expiry(expiresInHours),
      "",
      copy.footer,
      "",
      emailSignatureText(),
   ].join("\n");
};

export { AuthLinkEmail, authLinkEmailSubject, authLinkEmailText };
export type { AuthLinkEmailProps };
