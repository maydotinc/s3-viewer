import { Link, Text } from "@react-email/components";
import { COMPANY_NAME, COMPANY_URL, PRODUCT_NAME } from "@s3-viewer/types";
import { mutedLink, signatureText } from "./styles";

const EMAIL_SIGNATURE = `${PRODUCT_NAME} by ${COMPANY_NAME}`;
const COMPANY_HOST = new URL(COMPANY_URL).host;

const EmailSignature = () => (
   <Text style={signatureText}>
      {EMAIL_SIGNATURE} ·{" "}
      <Link href={COMPANY_URL} style={mutedLink}>
         {COMPANY_HOST}
      </Link>
   </Text>
);

const emailSignatureText = (): string => `${EMAIL_SIGNATURE} · ${COMPANY_URL}`;

export { EmailSignature, emailSignatureText };
