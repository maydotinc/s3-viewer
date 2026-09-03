const localPart = (email: string): string => {
   const trimmed = email.trim();
   const at = trimmed.indexOf("@");
   const local = at > 0 ? trimmed.slice(0, at) : trimmed;
   return local || trimmed;
};

export { localPart };
