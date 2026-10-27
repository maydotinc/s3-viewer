const localPart = (email: string): string => {
   const trimmed = email.trim();
   const at = trimmed.indexOf("@");
   return at > 0 ? trimmed.slice(0, at) : trimmed;
};

export { localPart };
