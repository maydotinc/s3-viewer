const fontStack =
   "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const main = {
   backgroundColor: "#f7f7f7",
   fontFamily: fontStack,
   margin: "0",
   padding: "24px 0",
};

const container = {
   backgroundColor: "#ffffff",
   border: "1px solid #e1e4ea",
   borderRadius: "12px",
   margin: "0 auto",
   maxWidth: "520px",
   padding: "32px",
};

const h1 = {
   color: "#0e121b",
   fontFamily: fontStack,
   fontSize: "24px",
   fontWeight: 600,
   letterSpacing: "-0.01em",
   lineHeight: "32px",
   margin: "0 0 16px",
};

const text = {
   color: "#525866",
   fontFamily: fontStack,
   fontSize: "16px",
   lineHeight: "28px",
   margin: "0 0 16px",
};

const mutedText = {
   ...text,
   color: "#99a0ae",
   fontSize: "14px",
   lineHeight: "20px",
   margin: "0 0 8px",
};

const list = {
   color: "#525866",
   fontFamily: fontStack,
   fontSize: "16px",
   lineHeight: "28px",
   margin: "0 0 16px",
   padding: "0 0 0 24px",
};

const listItem = {
   margin: "0",
};

const buttonWrapper = {
   margin: "0 0 24px",
};

const button = {
   backgroundColor: "#3658c1",
   borderRadius: "8px",
   color: "#ffffff",
   display: "inline-block",
   fontFamily: fontStack,
   fontSize: "16px",
   fontWeight: 600,
   lineHeight: "20px",
   padding: "12px 24px",
   textDecoration: "none",
};

const footerText = {
   ...text,
   color: "#99a0ae",
   fontSize: "12px",
   lineHeight: "18px",
   margin: "24px 0 0",
};

export {
   button,
   buttonWrapper,
   container,
   footerText,
   h1,
   list,
   listItem,
   main,
   mutedText,
   text,
};
