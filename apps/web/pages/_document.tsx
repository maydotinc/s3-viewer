import { NONCE_HEADER } from "@/lib/csp";
import NextDocument, {
   Head,
   Html,
   Main,
   NextScript,
   type DocumentContext,
   type DocumentInitialProps,
} from "next/document";

type DocumentProps = DocumentInitialProps & { nonce?: string };

const Document = ({ nonce }: DocumentProps) => (
   <Html lang="en">
      <Head nonce={nonce} />
      <body className="antialiased">
         <Main />
         <NextScript nonce={nonce} />
      </body>
   </Html>
);

Document.getInitialProps = async (
   context: DocumentContext
): Promise<DocumentProps> => {
   const initialProps = await NextDocument.getInitialProps(context);
   const nonce = context.req?.headers[NONCE_HEADER];
   return {
      ...initialProps,
      ...(typeof nonce === "string" && nonce ? { nonce } : {}),
   };
};

export default Document;
