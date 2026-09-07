const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const localPart = (email: string): string => {
   const trimmed = email.trim();
   const at = trimmed.indexOf("@");
   const local = at > 0 ? trimmed.slice(0, at) : trimmed;
   return local || trimmed;
};

// name and message only: a transport error's full object can carry the
// recipient address or a request body, and the auth package has no scrubbing
// logger of its own
const describeFailure = (error: unknown): string =>
   error instanceof Error ? `${error.name}: ${error.message}` : String(error);

export { describeFailure, localPart, normalizeEmail };
