const fontStack =
   "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const colors = {
   page: "#f7f7f7",
   card: "#ffffff",
   border: "#e1e4ea",
   heading: "#0e121b",
   body: "#525866",
   muted: "#636c7e",
   brand: "#3658c1",
   onBrand: "#ffffff",
};

const main = {
   backgroundColor: colors.page,
   fontFamily: fontStack,
   margin: "0",
   padding: "24px 0",
};

const container = {
   backgroundColor: colors.card,
   border: `1px solid ${colors.border}`,
   borderRadius: "12px",
   margin: "0 auto",
   maxWidth: "520px",
   padding: "32px",
};

const h1 = {
   color: colors.heading,
   fontFamily: fontStack,
   fontSize: "24px",
   fontWeight: 600,
   letterSpacing: "-0.01em",
   lineHeight: "32px",
   margin: "0 0 16px",
};

const text = {
   color: colors.body,
   fontFamily: fontStack,
   fontSize: "16px",
   lineHeight: "28px",
   margin: "0 0 16px",
};

const mutedText = {
   ...text,
   color: colors.muted,
   fontSize: "14px",
   lineHeight: "20px",
   margin: "0 0 8px",
};

const list = {
   ...text,
   padding: "0 0 0 24px",
};

const listItem = {
   margin: "0",
};

const buttonWrapper = {
   margin: "0 0 24px",
};

const button = {
   backgroundColor: colors.brand,
   borderRadius: "8px",
   color: colors.onBrand,
   display: "inline-block",
   fontFamily: fontStack,
   fontSize: "16px",
   fontWeight: 600,
   lineHeight: "20px",
   padding: "12px 24px",
   textDecoration: "none",
};

const link = {
   color: colors.brand,
};

const code = {
   backgroundColor: colors.page,
   border: `1px solid ${colors.border}`,
   borderRadius: "8px",
   color: colors.heading,
   fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
   fontSize: "32px",
   fontWeight: 600,
   letterSpacing: "0.3em",
   lineHeight: "40px",
   margin: "0 0 24px",
   padding: "16px 24px",
   textAlign: "center" as const,
};

const mutedLink = {
   color: colors.muted,
};

const footerText = {
   ...text,
   color: colors.muted,
   fontSize: "12px",
   lineHeight: "18px",
   margin: "24px 0 0",
};

const signatureText = {
   ...footerText,
   margin: "16px 0 0",
};

export {
   button,
   buttonWrapper,
   code,
   container,
   footerText,
   signatureText,
   h1,
   link,
   list,
   listItem,
   main,
   mutedLink,
   mutedText,
   text,
};
