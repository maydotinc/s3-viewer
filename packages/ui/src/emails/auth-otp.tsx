import {
   Body,
   Container,
   Head,
   Heading,
   Html,
   Text,
} from "@react-email/components";
import * as React from "react";

interface S3ViewerEmailOTPProps {
   loginCode?: string;
}

export const S3ViewerEmailOTP = ({ loginCode }: S3ViewerEmailOTPProps) => (
   <Html>
      <Head />
      <Body style={main}>
         <Container style={container}>
            <Heading style={h1}>Sign in to s3-viewer</Heading>
            <Text style={{ ...text, marginBottom: "14px" }}>
               This code will expire in 10 minutes and can only be used once.
            </Text>
            <code style={code}>{loginCode}</code>
            <Text
               style={{
                  ...text,
                  color: "#ababab",
                  marginTop: "14px",
                  marginBottom: "16px",
               }}
            >
               If you didn&apos;t try to login, you can safely ignore this
               email.
            </Text>
         </Container>
      </Body>
   </Html>
);

S3ViewerEmailOTP.PreviewProps = {
   loginCode: "this-is-a-test-code",
} as S3ViewerEmailOTPProps;

export default S3ViewerEmailOTP;

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

const code = {
   display: "inline-block",
   padding: "16px 4.5%",
   width: "90.5%",
   backgroundColor: "#f4f4f4",
   borderRadius: "5px",
   border: "1px solid #eee",
   color: "#333",
};
